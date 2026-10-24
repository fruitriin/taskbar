//! タスクバーと重なるウィンドウの自動回避（Plan: .claude/addf/plans/window-overlap-avoidance.md）
//!
//! macOS には Windows のようにタスクバーの分だけ作業領域を予約する公開 API が無く、
//! 最大化やドラッグでウィンドウがタスクバーの下に潜り込む。重なったウィンドウを
//! AX で移動・リサイズして避けさせる。
//!
//! 流れ:
//! - ax_observer がウィンドウの生成・移動・リサイズ（AXWindowCreated / AXWindowMoved /
//!   AXWindowResized）を受けると、本モジュールのチャンネルにシグナルを送る
//! - 500ms 静穏になったら（ドラッグ中は動かさないよう max_wait は付けない）、
//!   CGWindowList を取り直して全ウィンドウを判定し、必要なものだけ調整する。
//!   アニメーションの終了後に通知が来ないことがあるため、1.5 秒後にもう一度判定する
//!
//! 調整ルール（オーナー確定 2026-10-24）:
//! - 大きさに余裕があれば移動を優先し、足りなければ使える領域いっぱいに縮める
//! - タスクバー側にあるウィンドウの外側の辺が、タスクバーの外側の辺（= 作業領域の端）を
//!   越えていれば「突き抜け」＝意図的とみなして触らない
//! - 縮めた結果が MIN_SIZE 未満になるなら触らない
//!
//! 座標系: CGWindowList の kCGWindowBounds と、Tauri の Monitor / ウィンドウ位置を
//! 論理 px に変換した値は、どちらも左上原点のグローバルなポイント座標で一致する。

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};
use tokio::sync::mpsc::{self, UnboundedSender};

use crate::display_manager;
use crate::filter;
use crate::store::{self, Layout};
use crate::window_actions::{self, Frame, SetFrameOutcome};
use crate::window_manager::{self, MacWindow};
use crate::window_observer::debounce_loop;

/// 移動・リサイズが落ち着いたとみなすまでの静穏時間
const SETTLE: Duration = Duration::from_millis(500);

/// 端にぴったり合わせたウィンドウを「突き抜け」と誤判定しないための許容幅（pt）
const EDGE_TOLERANCE: f64 = 4.0;

/// 1 回目の判定のあと、もう一度判定するまでの時間。フルスクリーン化・拡大などの
/// アニメーションは通知の時点ではまだ途中で、終わったあとに通知が来ないことがあるため
const RECHECK_AFTER: Duration = Duration::from_millis(1500);

/// 縮めた結果がこれ未満なら調整しない（pt）
const MIN_SIZE: f64 = 200.0;

/// 同じウィンドウを調整してよい回数と、その数え直しまでの時間。調整に従わずに
/// 元へ戻すアプリとの綱引き（無限ループ）を、この回数で打ち切る。
/// 時間だけのクールダウンにしないのは、調整直後にユーザーが重ね直した場合も避けさせるため
const MAX_ATTEMPTS: u32 = 3;
const ATTEMPT_WINDOW: Duration = Duration::from_secs(30);

/// マウスボタンが押されている間（ドラッグ中）に判定を保留したとき、再判定までの間隔
const MOUSE_RETRY: Duration = Duration::from_millis(300);

/// 矩形（左上原点のグローバルなポイント座標）
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Rect {
    fn right(&self) -> f64 {
        self.x + self.width
    }
    fn bottom(&self) -> f64 {
        self.y + self.height
    }
    fn intersects(&self, other: &Rect) -> bool {
        self.x < other.right()
            && other.x < self.right()
            && self.y < other.bottom()
            && other.y < self.bottom()
    }
    fn contains_point(&self, x: f64, y: f64) -> bool {
        x >= self.x && x < self.right() && y >= self.y && y < self.bottom()
    }
}

/// タスクバー1枚分の判定材料
#[derive(Debug, Clone, Copy)]
pub struct TaskbarArea {
    /// タスクバーウィンドウの矩形
    pub taskbar: Rect,
    /// タスクバーが載っているディスプレイの作業領域（メニューバー・Dock を除く）
    pub work_area: Rect,
    /// ディスプレイ全体（ウィンドウがどのディスプレイに属するかの判定に使う）
    pub display: Rect,
}

/// ウィンドウの調整先を計算する（純関数）。調整不要・対象外なら None。
pub fn adjustment(window: Rect, area: &TaskbarArea, layout: Layout) -> Option<Rect> {
    let taskbar = area.taskbar;
    let work = area.work_area;
    if !window.intersects(&taskbar) {
        return None;
    }

    let mut result = window;
    match layout {
        Layout::Bottom => {
            // 突き抜け: 下端がタスクバーの下端（作業領域の下端）を越えている
            if window.bottom() > taskbar.bottom() + EDGE_TOLERANCE {
                return None;
            }
            let available = taskbar.y - work.y;
            if window.height <= available {
                result.y = taskbar.y - window.height;
            } else {
                result.y = work.y;
                result.height = available;
            }
        }
        Layout::Right => {
            if window.right() > taskbar.right() + EDGE_TOLERANCE {
                return None;
            }
            let available = taskbar.x - work.x;
            if window.width <= available {
                result.x = taskbar.x - window.width;
            } else {
                result.x = work.x;
                result.width = available;
            }
        }
        Layout::Left => {
            if window.x < taskbar.x - EDGE_TOLERANCE {
                return None;
            }
            let available = work.right() - taskbar.right();
            result.x = taskbar.right();
            if window.width > available {
                result.width = available;
            }
        }
    }

    if result.width < MIN_SIZE || result.height < MIN_SIZE {
        return None;
    }
    (result != window).then_some(result)
}

/// ウィンドウの中心が属するタスクバー領域を選ぶ
fn area_for<'a>(window: &Rect, areas: &'a [TaskbarArea]) -> Option<&'a TaskbarArea> {
    let cx = window.x + window.width / 2.0;
    let cy = window.y + window.height / 2.0;
    areas.iter().find(|a| a.display.contains_point(cx, cy))
}

/// 同じウィンドウへの調整回数の記録
#[derive(Debug, Clone, Copy)]
struct Attempts {
    count: u32,
    since: Instant,
}

/// 調整してよいか判定し、よければ回数を記録する（純関数）。
/// ATTEMPT_WINDOW の間に MAX_ATTEMPTS 回まで許し、時間が過ぎたら数え直す
fn allow_attempt(attempts: &mut HashMap<i64, Attempts>, number: i64, now: Instant) -> bool {
    attempts.retain(|_, a| now.duration_since(a.since) < ATTEMPT_WINDOW);
    let entry = attempts.entry(number).or_insert(Attempts {
        count: 0,
        since: now,
    });
    if entry.count >= MAX_ATTEMPTS {
        return false;
    }
    entry.count += 1;
    true
}

/// マウスボタンが押されているか（ドラッグ・リサイズ操作の途中か）
fn mouse_pressed() -> bool {
    objc2_app_kit::NSEvent::pressedMouseButtons() != 0
}

/// 重なり回避の監視を開始し、シグナル送信端を返す（ax_observer に渡す）。
/// lib.rs の setup から呼ぶ
pub fn start(app: AppHandle) -> UnboundedSender<()> {
    let (tx, rx) = mpsc::unbounded_channel::<()>();
    let retry_tx = tx.clone();
    // window_number → 調整回数。action は直列に実行されるが、
    // Future に可変参照を持ち出せないため Arc<Mutex> で共有する
    let attempts: Arc<Mutex<HashMap<i64, Attempts>>> = Arc::default();
    tauri::async_runtime::spawn(async move {
        debounce_loop(rx, SETTLE, None, move || {
            let app = app.clone();
            let attempts = Arc::clone(&attempts);
            let retry_tx = retry_tx.clone();
            async move {
                // ドラッグ中にマウスを止めただけなら、掴んでいるウィンドウを動かさない。
                // 離されるまで短い間隔で判定をやり直す
                if mouse_pressed() {
                    tokio::spawn(async move {
                        tokio::time::sleep(MOUSE_RETRY).await;
                        let _ = retry_tx.send(());
                    });
                    return;
                }
                adjust_all(&app, &attempts).await;
                // この間に届いたシグナルはチャンネルに溜まり、次のサイクルで処理される
                tokio::time::sleep(RECHECK_AFTER).await;
                if !mouse_pressed() {
                    adjust_all(&app, &attempts).await;
                }
            }
        })
        .await;
    });
    tx
}

/// 全ウィンドウを判定して、必要なものを調整する
async fn adjust_all(app: &AppHandle, attempts: &Mutex<HashMap<i64, Attempts>>) {
    let options = match store::get_options(app) {
        Ok(o) => o,
        Err(e) => {
            log::warn!("overlap: failed to load options: {e}");
            return;
        }
    };
    if !options.auto_avoid_taskbar_overlap {
        log::debug!("overlap: disabled by option");
        return;
    }
    let areas = taskbar_areas(app);
    if areas.is_empty() {
        log::debug!("overlap: no taskbar area");
        return;
    }
    let windows = match window_manager::get_window_list().await {
        Ok(w) => w,
        Err(e) => {
            log::warn!("overlap: get_window_list failed: {e}");
            return;
        }
    };
    // フィルタで除外されたウィンドウ（パネル・常駐 UI 等）は対象外。
    // 通過リストはレイヤー 0 の通常ウィンドウ
    let filters = store::get_labeled_filters(app).unwrap_or_default();
    let (passed, _) = filter::filter_windows(windows, &filters);
    log::debug!(
        "overlap: checking {} windows against {} taskbar(s)",
        passed.len(),
        areas.len()
    );

    let own_pid = i64::from(std::process::id());

    for win in passed {
        if win.owner_pid == own_pid || win.layer != 0 {
            continue;
        }
        let rect = rect_of(&win);
        let Some(area) = area_for(&rect, &areas) else {
            continue;
        };
        let Some(target) = adjustment(rect, area, options.layout) else {
            continue;
        };
        let number = win.window_number;
        let label = format!("{} ({number})", win.owner_name);
        let allowed = attempts
            .lock()
            .map(|mut a| allow_attempt(&mut a, number, Instant::now()))
            .unwrap_or(false);
        if !allowed {
            log::debug!("overlap: gave up {label} (adjusted {MAX_ATTEMPTS} times recently)");
            continue;
        }
        let frame = Frame {
            x: target.x,
            y: target.y,
            width: target.width,
            height: target.height,
        };
        match window_actions::set_frame(win, frame, options.exit_full_screen_to_avoid_taskbar).await
        {
            Ok(SetFrameOutcome::Applied) => {
                log::debug!("overlap: adjusted {label} {rect:?} -> {target:?}")
            }
            Ok(SetFrameOutcome::ExitedFullScreen) => {
                // 解除後の再判定（RECHECK_AFTER）で改めて重なりを判定する
                log::debug!("overlap: exited full screen {label}");
            }
            Ok(SetFrameOutcome::Skipped(reason)) => {
                log::debug!("overlap: skipped {label}: {reason}")
            }
            Err(e) => log::debug!("overlap: failed {label}: {e}"),
        }
    }
}

fn rect_of(win: &MacWindow) -> Rect {
    Rect {
        x: win.bounds.x,
        y: win.bounds.y,
        width: win.bounds.width,
        height: win.bounds.height,
    }
}

/// 表示中のタスクバーウィンドウごとに、矩形・作業領域・ディスプレイ範囲を集める
fn taskbar_areas(app: &AppHandle) -> Vec<TaskbarArea> {
    let mut areas = Vec::new();
    for (label, window) in app.webview_windows() {
        // 非表示のタスクバー（ディスプレイ取り外し中の残骸など）は判定に使わない
        if display_manager::parse_taskbar_index(&label).is_none()
            || !window.is_visible().unwrap_or(false)
        {
            continue;
        }
        let (Ok(Some(monitor)), Ok(pos), Ok(size)) = (
            window.current_monitor(),
            window.outer_position(),
            window.outer_size(),
        ) else {
            continue;
        };
        let scale = monitor.scale_factor();
        let pos = pos.to_logical::<f64>(scale);
        let size = size.to_logical::<f64>(scale);
        let work_pos = monitor.work_area().position.to_logical::<f64>(scale);
        let work_size = monitor.work_area().size.to_logical::<f64>(scale);
        let mon_pos = monitor.position().to_logical::<f64>(scale);
        let mon_size = monitor.size().to_logical::<f64>(scale);
        areas.push(TaskbarArea {
            taskbar: Rect {
                x: pos.x,
                y: pos.y,
                width: size.width,
                height: size.height,
            },
            work_area: Rect {
                x: work_pos.x,
                y: work_pos.y,
                width: work_size.width,
                height: work_size.height,
            },
            display: Rect {
                x: mon_pos.x,
                y: mon_pos.y,
                width: mon_size.width,
                height: mon_size.height,
            },
        });
    }
    areas
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rect(x: f64, y: f64, width: f64, height: f64) -> Rect {
        Rect {
            x,
            y,
            width,
            height,
        }
    }

    /// 3440x1440 のディスプレイ。メニューバー 25pt、Dock は隠している想定
    fn area(layout: Layout) -> TaskbarArea {
        let work = rect(0.0, 25.0, 3440.0, 1415.0);
        let taskbar = match layout {
            Layout::Bottom => rect(0.0, 1380.0, 3440.0, 60.0),
            Layout::Right => rect(3230.0, 25.0, 210.0, 1415.0),
            Layout::Left => rect(0.0, 25.0, 210.0, 1415.0),
        };
        TaskbarArea {
            taskbar,
            work_area: work,
            display: rect(0.0, 0.0, 3440.0, 1440.0),
        }
    }

    #[test]
    fn 重なっていなければ調整しない() {
        let a = area(Layout::Bottom);
        assert_eq!(
            adjustment(rect(100.0, 100.0, 800.0, 600.0), &a, Layout::Bottom),
            None
        );
    }

    #[test]
    fn bottom_少し重なったら大きさを保って上へ移動する() {
        let a = area(Layout::Bottom);
        // 下端 1400（タスクバー 1380〜1440 の帯の中）
        let got = adjustment(rect(100.0, 800.0, 800.0, 600.0), &a, Layout::Bottom);
        assert_eq!(got, Some(rect(100.0, 780.0, 800.0, 600.0)));
    }

    #[test]
    fn bottom_使える高さより大きければ作業領域いっぱいに縮める() {
        let a = area(Layout::Bottom);
        // 最大化相当（作業領域いっぱい: y=25, 高さ 1415）
        let got = adjustment(rect(0.0, 25.0, 3440.0, 1415.0), &a, Layout::Bottom);
        assert_eq!(got, Some(rect(0.0, 25.0, 3440.0, 1355.0)));
    }

    #[test]
    fn bottom_画面の下端を越えて突き抜けていれば触らない() {
        let a = area(Layout::Bottom);
        let got = adjustment(rect(100.0, 1000.0, 800.0, 600.0), &a, Layout::Bottom);
        assert_eq!(got, None, "下端 1600 は画面外");
    }

    #[test]
    fn bottom_下端ぴったりは許容幅の内側として調整する() {
        let a = area(Layout::Bottom);
        // 下端 1442（端から 2pt はみ出し）は許容幅 4pt の内側
        let got = adjustment(rect(100.0, 842.0, 800.0, 600.0), &a, Layout::Bottom);
        assert_eq!(got, Some(rect(100.0, 780.0, 800.0, 600.0)));
    }

    #[test]
    fn right_少し重なったら左へ移動する() {
        let a = area(Layout::Right);
        let got = adjustment(rect(2600.0, 100.0, 800.0, 600.0), &a, Layout::Right);
        assert_eq!(got, Some(rect(2430.0, 100.0, 800.0, 600.0)));
    }

    #[test]
    fn right_使える幅より大きければ縮める() {
        let a = area(Layout::Right);
        let got = adjustment(rect(0.0, 25.0, 3440.0, 1415.0), &a, Layout::Right);
        assert_eq!(got, Some(rect(0.0, 25.0, 3230.0, 1415.0)));
    }

    #[test]
    fn right_画面の右端を越えていれば触らない() {
        let a = area(Layout::Right);
        assert_eq!(
            adjustment(rect(3000.0, 100.0, 800.0, 600.0), &a, Layout::Right),
            None
        );
    }

    #[test]
    fn left_少し重なったら右へ移動する() {
        let a = area(Layout::Left);
        let got = adjustment(rect(100.0, 100.0, 800.0, 600.0), &a, Layout::Left);
        assert_eq!(got, Some(rect(210.0, 100.0, 800.0, 600.0)));
    }

    #[test]
    fn left_使える幅より大きければ右へ寄せて縮める() {
        let a = area(Layout::Left);
        let got = adjustment(rect(0.0, 25.0, 3440.0, 1415.0), &a, Layout::Left);
        assert_eq!(got, Some(rect(210.0, 25.0, 3230.0, 1415.0)));
    }

    #[test]
    fn left_画面の左端を越えていれば触らない() {
        let a = area(Layout::Left);
        assert_eq!(
            adjustment(rect(-300.0, 100.0, 800.0, 600.0), &a, Layout::Left),
            None
        );
    }

    #[test]
    fn 縮めた結果が下限未満なら触らない() {
        // 作業領域が狭いディスプレイ（高さ 240）で bottom タスクバー 60 → 使える高さ 180
        let a = TaskbarArea {
            taskbar: rect(0.0, 180.0, 1000.0, 60.0),
            work_area: rect(0.0, 0.0, 1000.0, 240.0),
            display: rect(0.0, 0.0, 1000.0, 240.0),
        };
        assert_eq!(
            adjustment(rect(0.0, 0.0, 800.0, 230.0), &a, Layout::Bottom),
            None
        );
    }

    #[test]
    fn ウィンドウの中心が属するディスプレイのタスクバーを選ぶ() {
        let main = area(Layout::Bottom);
        let sub = TaskbarArea {
            taskbar: rect(3440.0, 1020.0, 1920.0, 60.0),
            work_area: rect(3440.0, 0.0, 1920.0, 1080.0),
            display: rect(3440.0, 0.0, 1920.0, 1080.0),
        };
        let areas = [main, sub];
        let on_sub = rect(4000.0, 500.0, 800.0, 560.0);
        assert_eq!(area_for(&on_sub, &areas).map(|a| a.display.x), Some(3440.0));
        let on_main = rect(100.0, 100.0, 800.0, 600.0);
        assert_eq!(area_for(&on_main, &areas).map(|a| a.display.x), Some(0.0));
    }

    #[test]
    fn 副ディスプレイの負の座標でも同じ規則で調整する() {
        // メインの左に置いた 1920x1080 のディスプレイ（x = -1920）
        let a = TaskbarArea {
            taskbar: rect(-1920.0, 1020.0, 1920.0, 60.0),
            work_area: rect(-1920.0, 0.0, 1920.0, 1080.0),
            display: rect(-1920.0, 0.0, 1920.0, 1080.0),
        };
        let got = adjustment(rect(-1500.0, 500.0, 800.0, 540.0), &a, Layout::Bottom);
        assert_eq!(got, Some(rect(-1500.0, 480.0, 800.0, 540.0)));
    }

    #[test]
    fn 同じウィンドウの調整は一定時間に3回までで打ち切る() {
        let mut attempts = HashMap::new();
        let t0 = Instant::now();
        assert!(allow_attempt(&mut attempts, 1, t0));
        assert!(allow_attempt(&mut attempts, 1, t0 + Duration::from_secs(1)));
        assert!(allow_attempt(&mut attempts, 1, t0 + Duration::from_secs(2)));
        assert!(
            !allow_attempt(&mut attempts, 1, t0 + Duration::from_secs(3)),
            "綱引きは4回目で打ち切る"
        );
        assert!(
            allow_attempt(&mut attempts, 2, t0 + Duration::from_secs(3)),
            "別ウィンドウは別勘定"
        );
        assert!(
            allow_attempt(
                &mut attempts,
                1,
                t0 + ATTEMPT_WINDOW + Duration::from_secs(1)
            ),
            "時間が過ぎたら数え直す"
        );
    }
}
