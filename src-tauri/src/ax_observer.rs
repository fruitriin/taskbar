//! AXObserver によるウィンドウ単位の変化検知（タイトル変化・ウィンドウ増減など）
//!
//! window_observer.rs の NSWorkspace 通知はアプリ単位（activate/launch/terminate）
//! のため、前面アプリ内のタブ切替・背面アプリのタイトル変化・Cmd+N / Cmd+W を
//! 検知できない。本モジュールは pid ごとに AXObserver を作り、アプリ要素に
//! 通知を登録する（アプリ要素に登録すると子要素の通知もまとめて届く。yabai と同方式）。
//!
//! 通知は window_observer のデバウンスチャンネルへのシグナル送信にのみ使い、
//! ウィンドウ情報の正は従来どおり CGWindowList とする（フロント・IPC 契約は無変更）。
//! ウィンドウの生成・移動・リサイズは overlap.rs（タスクバーとの重なり回避）にも送る。
//! 設計の経緯は .claude/addf/plans/ax-title-observer.md を参照。
//!
//! スレッド構成:
//! - AX 専用スレッドを1本立て、そのスレッドの CFRunLoop に observer の
//!   RunLoopSource を載せる。AXObserverAddNotification や AX 属性取得は対象プロセスとの
//!   IPC で、無応答アプリ相手だとブロックし得るため、メインスレッドから分離する
//! - observer の生成・破棄・コールバックはすべて AX スレッド上で起きる。
//!   他スレッドからの指示（pid の追加・削除）は std の mpsc チャンネル経由のみ
//! - RunLoop は 250ms ずつ回し、合間にチャンネルの指示と登録の再試行を処理する
//!   （カスタム RunLoopSource で即時起床させるより単純で、遅延は最大 250ms）

use std::collections::{HashMap, HashSet};
use std::ffi::c_void;
use std::ptr::{self, NonNull};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use objc2_application_services::{AXError, AXIsProcessTrusted, AXObserver, AXUIElement};
use objc2_core_foundation::{
    kCFRunLoopDefaultMode, CFRetained, CFRunLoop, CFRunLoopSource, CFString, CFType,
};
use tokio::sync::mpsc::UnboundedSender;

/// AX スレッドへの指示
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Command {
    /// pid の監視を始める（起動済みアプリの初期登録・didLaunch・didActivate）。
    /// 登録済み・再試行待ちなら何もしない。登録を諦めた pid は再登録を試みる
    Add(libc::pid_t),
    /// pid の監視をやめる（didTerminate）
    Remove(libc::pid_t),
}

/// AX スレッドへの指示を送るハンドル。Clone して NSWorkspace 通知ブロックへ渡す
#[derive(Clone)]
pub struct AxObserverHandle {
    tx: Sender<Command>,
}

impl AxObserverHandle {
    pub fn send(&self, cmd: Command) {
        // AX スレッドが終了している場合は送信失敗するが、監視が止まるだけなので無視する
        let _ = self.tx.send(cmd);
    }
}

/// 購読する AX 通知。ヘッダでは CFSTR マクロ定義で Rust バインディングに
/// 定数が生成されないため文字列で持つ（window_actions.rs と同じ扱い）
const AX_TITLE_CHANGED: &str = "AXTitleChanged";
const AX_WINDOW_CREATED: &str = "AXWindowCreated";
const AX_WINDOW_MOVED: &str = "AXWindowMoved";
const AX_WINDOW_RESIZED: &str = "AXWindowResized";
/// 先頭は必ず AXTitleChanged（register はこれの失敗で打ち切る）
const NOTIFICATIONS: [&str; 8] = [
    AX_TITLE_CHANGED,
    AX_WINDOW_CREATED,
    AX_WINDOW_MOVED,
    AX_WINDOW_RESIZED,
    "AXUIElementDestroyed",
    "AXWindowMiniaturized",
    "AXWindowDeminiaturized",
    "AXFocusedWindowChanged",
];

const AX_ROLE: &str = "AXRole";
const AX_WINDOW_ROLE: &str = "AXWindow";

/// 個々の AX メッセージ（プロセス間通信）のタイムアウト秒（window_actions.rs と同値）
const AX_MESSAGING_TIMEOUT_SECS: f32 = 1.0;

/// RunLoop を1回に回す時間。指示・再試行の処理はこの間隔で行う
const RUN_LOOP_SLICE: Duration = Duration::from_millis(250);

/// アクセシビリティ権限がないときの再確認間隔
const TRUST_RECHECK_INTERVAL: Duration = Duration::from_secs(5);

/// コールバックからのシグナル送信先。AX スレッドは1本だけなので static で持ち、
/// AXObserverAddNotification の refcon には何も渡さない（refcon の寿命管理を不要にする）
static SIGNAL_TX: OnceLock<UnboundedSender<()>> = OnceLock::new();

/// ウィンドウの生成・移動・リサイズの送信先（overlap.rs の重なり回避）
static ADJUST_TX: OnceLock<UnboundedSender<()>> = OnceLock::new();

/// AX 専用スレッドを起動し、指示用のハンドルを返す。
/// `signal_tx` には window_observer のデバウンスチャンネル、`adjust_tx` には
/// overlap.rs のチャンネルの送信端を渡す
pub fn start(signal_tx: UnboundedSender<()>, adjust_tx: UnboundedSender<()>) -> AxObserverHandle {
    let (tx, rx) = mpsc::channel();
    let _ = ADJUST_TX.set(adjust_tx);
    if SIGNAL_TX.set(signal_tx).is_err() {
        log::warn!("ax_observer::start called more than once; ignoring");
        return AxObserverHandle { tx };
    }
    let spawned = std::thread::Builder::new()
        .name("ax-observer".into())
        .spawn(move || AxThread::new(rx).run());
    if let Err(e) = spawned {
        // スレッドが立たなければ従来の NSWorkspace 通知のみで動作する
        log::warn!("failed to spawn ax-observer thread: {e}");
    }
    AxObserverHandle { tx }
}

/// 登録済み observer。drop で RunLoopSource と observer が解放される
struct Registered {
    // observer を解放すると通知登録も解除される（AXObserverGetRunLoopSource の注記）
    _observer: CFRetained<AXObserver>,
    _app: CFRetained<AXUIElement>,
    source: CFRetained<CFRunLoopSource>,
}

/// 登録の再試行待ち
struct Pending {
    attempt: u32,
    next_at: Instant,
}

struct AxThread {
    rx: Receiver<Command>,
    run_loop: CFRetained<CFRunLoop>,
    own_pid: libc::pid_t,
    /// 監視すべき pid（権限が後から付与されたときの再登録に使う）
    desired: HashSet<libc::pid_t>,
    registered: HashMap<libc::pid_t, Registered>,
    pending: HashMap<libc::pid_t, Pending>,
    trusted: bool,
    next_trust_check: Instant,
}

impl AxThread {
    fn new(rx: Receiver<Command>) -> Self {
        // CFRunLoopGetCurrent はスレッドごとの RunLoop を必要に応じて生成するため None にならない
        let run_loop = CFRunLoop::current().expect("CFRunLoopGetCurrent returned NULL");
        // SAFETY: 引数なしの読み取り専用 API
        let trusted = unsafe { AXIsProcessTrusted() };
        if !trusted {
            log::info!("accessibility not trusted; AX observer waits for permission");
        }
        Self {
            rx,
            run_loop,
            own_pid: std::process::id() as libc::pid_t,
            desired: HashSet::new(),
            registered: HashMap::new(),
            pending: HashMap::new(),
            trusted,
            next_trust_check: Instant::now() + TRUST_RECHECK_INTERVAL,
        }
    }

    fn run(mut self) {
        loop {
            if self.registered.is_empty() {
                // RunLoop にソースが無いと CFRunLoopRunInMode は即座に返るため、
                // その間はチャンネル待ちで眠る（空回り防止）
                match self.rx.recv_timeout(RUN_LOOP_SLICE) {
                    Ok(cmd) => self.handle(cmd),
                    Err(RecvTimeoutError::Timeout) => {}
                    Err(RecvTimeoutError::Disconnected) => return,
                }
            } else {
                // SAFETY: kCFRunLoopDefaultMode は CoreFoundation の静的定数
                let mode = unsafe { kCFRunLoopDefaultMode };
                CFRunLoop::run_in_mode(mode, RUN_LOOP_SLICE.as_secs_f64(), false);
            }
            loop {
                match self.rx.try_recv() {
                    Ok(cmd) => self.handle(cmd),
                    Err(mpsc::TryRecvError::Empty) => break,
                    Err(mpsc::TryRecvError::Disconnected) => return,
                }
            }
            self.check_trust();
            self.retry_pending();
        }
    }

    fn handle(&mut self, cmd: Command) {
        match cmd {
            Command::Add(pid) => {
                if pid == self.own_pid || pid <= 0 {
                    return;
                }
                self.desired.insert(pid);
                if self.registered.contains_key(&pid) || self.pending.contains_key(&pid) {
                    return;
                }
                // 起動が遅く再試行を使い切ったアプリも、アクティブ化のたびに再登録を試みる
                if self.trusted {
                    self.try_register(pid, 0);
                }
            }
            Command::Remove(pid) => {
                self.desired.remove(&pid);
                self.pending.remove(&pid);
                self.unregister(pid);
            }
        }
    }

    /// 権限なし → ありへの変化を検知したら、監視すべき pid をまとめて登録する
    fn check_trust(&mut self) {
        if self.trusted || Instant::now() < self.next_trust_check {
            return;
        }
        self.next_trust_check = Instant::now() + TRUST_RECHECK_INTERVAL;
        // SAFETY: 引数なしの読み取り専用 API
        if unsafe { AXIsProcessTrusted() } {
            log::info!("accessibility trusted; starting AX observers");
            self.trusted = true;
            let pids: Vec<_> = self.desired.iter().copied().collect();
            for pid in pids {
                self.try_register(pid, 0);
            }
        }
    }

    fn retry_pending(&mut self) {
        let now = Instant::now();
        let due: Vec<_> = self
            .pending
            .iter()
            .filter(|(_, p)| p.next_at <= now)
            .map(|(pid, p)| (*pid, p.attempt))
            .collect();
        for (pid, attempt) in due {
            self.pending.remove(&pid);
            self.try_register(pid, attempt);
        }
    }

    /// observer を作って通知を登録する。起動直後で AX が未準備なら再試行を予約する
    fn try_register(&mut self, pid: libc::pid_t, attempt: u32) {
        if self.registered.contains_key(&pid) {
            return;
        }
        match register(pid) {
            Ok(reg) => {
                self.run_loop.add_source(Some(&reg.source), unsafe {
                    // SAFETY: CoreFoundation の静的定数
                    kCFRunLoopDefaultMode
                });
                log::debug!("AX observer registered: pid={pid} attempt={attempt}");
                self.registered.insert(pid, reg);
            }
            Err(err) => match retry_delay(attempt) {
                Some(delay) => {
                    log::debug!(
                        "AX observer retry scheduled: pid={pid} err={} in {delay:?}",
                        err.0
                    );
                    self.pending.insert(
                        pid,
                        Pending {
                            attempt: attempt + 1,
                            next_at: Instant::now() + delay,
                        },
                    );
                }
                None => {
                    // AX 非対応アプリ等。NSWorkspace 通知による更新のみになる
                    log::debug!("AX observer gave up: pid={pid} err={}", err.0);
                }
            },
        }
    }

    fn unregister(&mut self, pid: libc::pid_t) {
        if let Some(reg) = self.registered.remove(&pid) {
            self.run_loop.remove_source(Some(&reg.source), unsafe {
                // SAFETY: CoreFoundation の静的定数
                kCFRunLoopDefaultMode
            });
            log::debug!("AX observer removed: pid={pid}");
            // reg の drop で observer・アプリ要素・source が解放される
        }
    }
}

/// pid の observer を作り、アプリ要素に通知を登録する。
/// 本命の AXTitleChanged が登録できなければ失敗とする（他の通知の可否は問わない）
fn register(pid: libc::pid_t) -> Result<Registered, AXError> {
    let mut raw: *mut AXObserver = ptr::null_mut();
    // SAFETY: callback は下の extern 関数、out_observer は有効なローカル変数へのポインタ
    let err = unsafe { AXObserver::create(pid, Some(on_notification), NonNull::from(&mut raw)) };
    if err != AXError::Success {
        return Err(err);
    }
    let Some(raw) = NonNull::new(raw) else {
        return Err(AXError::Failure);
    };
    // SAFETY: AXObserverCreate は Create 規則で +1 の参照を返す
    let observer = unsafe { CFRetained::from_raw(raw) };

    // SAFETY: 不正な pid でも要素は作られ、後続の AX メッセージがエラーを返すだけ
    let app = unsafe { AXUIElement::new_application(pid) };
    // 無応答アプリへの通知登録でスレッドが長く止まらないよう上限を設ける
    // SAFETY: app は有効な AXUIElement
    unsafe { app.set_messaging_timeout(AX_MESSAGING_TIMEOUT_SECS) };

    // NOTIFICATIONS の先頭は AXTitleChanged。これが失敗したら残りは登録せずに返す
    // （無応答アプリ相手に通知の数だけメッセージタイムアウトを待たないため）
    for name in NOTIFICATIONS {
        let cf_name = CFString::from_static_str(name);
        // SAFETY: refcon は使わないため null（コールバックは SIGNAL_TX を参照する）
        let err = unsafe { observer.add_notification(&app, &cf_name, ptr::null_mut()) };
        if name == AX_TITLE_CHANGED && !is_registered(err) {
            return Err(err);
        }
    }

    // SAFETY: observer は有効な AXObserver
    let source = unsafe { observer.run_loop_source() };
    Ok(Registered {
        _observer: observer,
        _app: app,
        source,
    })
}

/// AXObserver のコールバック。AX スレッドの RunLoop 上で呼ばれる。
/// 中身は「必要なら role 判定 → シグナル送信」だけに留める
unsafe extern "C-unwind" fn on_notification(
    _observer: NonNull<AXObserver>,
    element: NonNull<AXUIElement>,
    notification: NonNull<CFString>,
    _refcon: *mut c_void,
) {
    // SAFETY: AX が渡す notification / element はコールバック中は有効
    let notification = unsafe { notification.as_ref() }.to_string();
    let role = if notification == AX_TITLE_CHANGED {
        let element = unsafe { element.as_ref() };
        copy_role(element)
    } else {
        None
    };
    let route = route(&notification, role.as_deref());
    if route.refresh || route.adjust {
        log::debug!("AX notification: {notification}");
    }
    if route.refresh {
        if let Some(tx) = SIGNAL_TX.get() {
            let _ = tx.send(());
        }
    }
    if route.adjust {
        if let Some(tx) = ADJUST_TX.get() {
            let _ = tx.send(());
        }
    }
}

/// 要素の AXRole を文字列で取得する。取得できなければ None
fn copy_role(element: &AXUIElement) -> Option<String> {
    // SAFETY: element は有効な AXUIElement
    unsafe { element.set_messaging_timeout(AX_MESSAGING_TIMEOUT_SECS) };
    let mut value: *const CFType = ptr::null();
    // SAFETY: value は有効なローカル変数へのポインタ
    let err = unsafe {
        element.copy_attribute_value(
            &CFString::from_static_str(AX_ROLE),
            NonNull::from(&mut value),
        )
    };
    if err != AXError::Success {
        return None;
    }
    let value = NonNull::new(value as *mut CFType)?;
    // SAFETY: Copy 規則で +1 の参照が返る
    let value = unsafe { CFRetained::from_raw(value) };
    value.downcast_ref::<CFString>().map(|s| s.to_string())
}

/// 通知の送り先
#[derive(Debug, PartialEq, Eq)]
struct Route {
    /// window_observer（'process' の再取得）
    refresh: bool,
    /// overlap.rs（タスクバーとの重なり回避）
    adjust: bool,
}

/// 通知の送り先を決める。
/// - AXTitleChanged はボタン・タブ等のウィンドウ以外の要素でも発火するため、
///   role が AXWindow のものだけを再取得に回す
/// - 移動・リサイズは重なり回避だけに回す（ドラッグ中に連発するため、'process' の
///   再取得には回さない。位置の変化は従来どおり他の通知のついでに反映される）
/// - ウィンドウ生成は両方に回す
fn route(notification: &str, role: Option<&str>) -> Route {
    match notification {
        AX_TITLE_CHANGED => Route {
            refresh: role == Some(AX_WINDOW_ROLE),
            adjust: false,
        },
        AX_WINDOW_MOVED | AX_WINDOW_RESIZED => Route {
            refresh: false,
            adjust: true,
        },
        AX_WINDOW_CREATED => Route {
            refresh: true,
            adjust: true,
        },
        _ => Route {
            refresh: true,
            adjust: false,
        },
    }
}

/// 通知登録の結果を「登録済み」とみなすか
fn is_registered(err: AXError) -> bool {
    err == AXError::Success || err == AXError::NotificationAlreadyRegistered
}

/// 登録失敗時の再試行までの待ち時間。`attempt` は失敗した試行の回数（0 始まり）。
/// 起動直後のアプリは AX が未準備なことがあるため 250ms → 500ms → 1s → 2s と延ばし、
/// 4 回再試行しても駄目なら諦める（None）
fn retry_delay(attempt: u32) -> Option<Duration> {
    (attempt < 4).then(|| Duration::from_millis(250 << attempt))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn タイトル変化はウィンドウ要素のものだけを再取得に回す() {
        assert!(route(AX_TITLE_CHANGED, Some("AXWindow")).refresh);
        assert!(!route(AX_TITLE_CHANGED, Some("AXButton")).refresh);
        assert!(!route(AX_TITLE_CHANGED, None).refresh);
        assert!(!route(AX_TITLE_CHANGED, Some("AXWindow")).adjust);
    }

    #[test]
    fn その他の通知は再取得だけに回す() {
        for n in [
            "AXUIElementDestroyed",
            "AXFocusedWindowChanged",
            "AXWindowMiniaturized",
        ] {
            assert_eq!(
                route(n, None),
                Route {
                    refresh: true,
                    adjust: false
                },
                "{n}"
            );
        }
    }

    #[test]
    fn 移動とリサイズは重なり回避だけに回す() {
        for n in [AX_WINDOW_MOVED, AX_WINDOW_RESIZED] {
            assert_eq!(
                route(n, None),
                Route {
                    refresh: false,
                    adjust: true
                },
                "{n}"
            );
        }
    }

    #[test]
    fn ウィンドウ生成は両方に回す() {
        assert_eq!(
            route(AX_WINDOW_CREATED, None),
            Route {
                refresh: true,
                adjust: true
            }
        );
    }

    #[test]
    fn 通知リストの先頭はタイトル変化() {
        assert_eq!(NOTIFICATIONS[0], AX_TITLE_CHANGED);
    }

    #[test]
    fn 登録済み判定は成功と登録済みエラーを受け入れる() {
        assert!(is_registered(AXError::Success));
        assert!(is_registered(AXError::NotificationAlreadyRegistered));
        assert!(!is_registered(AXError::CannotComplete));
        assert!(!is_registered(AXError::APIDisabled));
    }

    #[test]
    fn 再試行はバックオフしつつ4回で打ち切る() {
        let delays: Vec<_> = (0..6).map(retry_delay).collect();
        assert_eq!(
            delays,
            vec![
                Some(Duration::from_millis(250)),
                Some(Duration::from_millis(500)),
                Some(Duration::from_secs(1)),
                Some(Duration::from_secs(2)),
                None,
                None,
            ]
        );
    }
}
