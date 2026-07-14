//! アプリアイコンの取得・キャッシュ・段階ロード（'iconUpdate' emit）
//!
//! Swift 原本: nativeSrc/taskbar.helper/main.swift:461-526（getIconBase64）＋
//! main.swift:623-796（ProgressiveIconLoader）
//! Electron 原本: src/main/funcs/helper.ts:32-68（handleIconUpdate /
//! updateProcessIcons）、helper.ts:513-529（applyProcessChange のアイコン適用）、
//! src/main/funcs/icon-cache.ts（icons.json の永続化）
//!
//! ペイロード契約（原本確認済み）:
//! - 'iconUpdate' イベント: `Record<置換済みowner名, 生base64>`（data: プレフィックス
//!   なし。helper.ts:45 の webContents.send('iconUpdate', icons) と同形）。
//!   受け側のフロント（src/renderer/src/pages/index.vue:400-410 updateWindowIcons）が
//!   `data:image/png;base64,` を付与して appIcon に代入する
//! - owner 名の置換規則: 空なら "unknown" → "/" を "_" に → 半角スペース除去
//!   （index.vue:404 / helper.ts:62,524 / main.swift:664 の3箇所で同一）
//! - 'process' 内の appIcon: こちらは `data:image/png;base64,` プレフィックス付き
//!   （helper.ts:526）
//!
//! キャッシュ方式の変更（計画書 3.3 icon_manager.rs 節）:
//! 原本の icons.json 1ファイル方式（破損リトライ・バックアップ機構込み:
//! icon-cache.ts:70-136）から、1アプリ1ファイルの
//! `~/Library/Application Support/taskbar.fm/icons/<置換名>.png` に簡素化。
//! ファイル単位なので部分破損が全キャッシュを道連れにしない。
//!
//! 段階ロードの簡素化（判断コメント）:
//! Swift 原本の ProgressiveIconLoader は 100ms タイマーで pendingUpdates を
//! 逐次 flush していた（main.swift:669-704）が、Rust 版は対象アイコンを並列取得して
//! 1回の 'iconUpdate' にまとめる。1アイコンの取得は 50ms タイムアウトで抑えられ、
//! リフレッシュ自体も 500ms デバウンス済みのため、逐次通知の複雑さに見合う
//! 体感差がないと判断。取得成功分は FS キャッシュへ保存されるため、次回以降の
//! 'process' には appIcon 適用済みで載る（＝「送信済み owner」の常駐 State も不要）。

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use objc2::AnyThread;
use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSRunningApplication};
use objc2_foundation::{NSDictionary, NSPoint, NSRect, NSSize};
use tauri::{AppHandle, Emitter};

use crate::window_manager::MacWindow;

/// アイコン取得のタイムアウト（Swift 原本 main.swift:513-516 の 50ms セマフォに対応）
const ICON_FETCH_TIMEOUT: Duration = Duration::from_millis(50);

/// 取得アイコンの一辺サイズ（Swift 原本 main.swift:649 の `size: 32` に対応）
const ICON_SIZE: f64 = 32.0;

/// owner 名の置換（純関数）。キャッシュファイル名と 'iconUpdate' のキーに使う。
///
/// フロント側 updateWindowIcons（index.vue:404）の
/// `(kCGWindowOwnerName || 'unknown').replace(/\//g, '_').replace(/ /g, '')`
/// と完全一致させる（一致しないとフロントがアイコンを引けない）
pub fn safe_owner_name(owner: &str) -> String {
    let owner = if owner.is_empty() { "unknown" } else { owner };
    owner.replace('/', "_").replace(' ', "")
}

/// アイコンキャッシュのファイルパス（純関数）: `<base>/icons/<置換名>.png`
pub fn icon_cache_path(base_dir: &Path, owner: &str) -> PathBuf {
    base_dir
        .join("icons")
        .join(format!("{}.png", safe_owner_name(owner)))
}

/// キャッシュのベースディレクトリ `~/Library/Application Support/taskbar.fm`。
///
/// Electron 原本 icon-cache.ts:15 の `app.getPath('appData')/taskbar.fm`、
/// Swift 原本 main.swift:756 の applicationSupportDirectory/taskbar.fm と同じ場所。
/// Tauri の app_data_dir は identifier ベース（space.riinswork.taskbar）の
/// 別パスになるため使わず、旧版とキャッシュ置き場を揃える判断
fn cache_base_dir() -> Option<PathBuf> {
    let home = std::env::var_os("HOME")?;
    Some(PathBuf::from(home).join("Library/Application Support/taskbar.fm"))
}

/// アイコンを生 base64（data: プレフィックスなし）で返す。
///
/// 1. FS キャッシュにヒットすればそれを base64 化して返す
/// 2. ミスなら NSRunningApplication から取得（50ms タイムアウト）し、
///    PNG をキャッシュ保存してから返す（保存失敗は無視 — Swift 原本
///    main.swift:790-794 の try? と同じく、キャッシュは失っても再取得可能）
pub async fn get_icon(pid: i64, owner: &str) -> Option<String> {
    let base = cache_base_dir()?;
    let path = icon_cache_path(&base, owner);

    if let Ok(bytes) = tokio::fs::read(&path).await {
        return Some(BASE64.encode(bytes));
    }

    let png = fetch_icon_from_process(pid).await?;

    if let Some(dir) = path.parent() {
        let _ = tokio::fs::create_dir_all(dir).await;
    }
    let _ = tokio::fs::write(&path, &png).await;

    Some(BASE64.encode(png))
}

/// NSRunningApplication API 経由でアイコン PNG を取得する。
///
/// Swift 原本: main.swift:498-516（バックグラウンドキュー＋セマフォ 50ms）。
/// Rust 版は spawn_blocking + tokio::time::timeout で同じ意味論を再現する。
/// タイムアウト時は blocking スレッドが残り得るが（ゾンビプロセス等での
/// カーネルレベルのブロックは中断できない）、呼び出し側には即時 None を返す
/// （window_manager.rs の UE 対策と同方針）
async fn fetch_icon_from_process(pid: i64) -> Option<Vec<u8>> {
    let pid = i32::try_from(pid).ok()?;
    tokio::time::timeout(
        ICON_FETCH_TIMEOUT,
        tokio::task::spawn_blocking(move || fetch_icon_png_blocking(pid)),
    )
    .await
    .ok()? // タイムアウト
    .ok()? // JoinError
}

/// ブロッキング呼び出し本体。spawn_blocking 内で実行される。
///
/// PNG 化の手段（判断コメント）: Swift 原本は NSImage を 32x32 に描画リサイズ
/// （resized(to:) → NSBitmapImageRep.png()、main.swift:86-121）していたが、
/// アプリアイコンは通常 32x32 の表現を内蔵しているため、Rust 版は
/// CGImageForProposedRect で 32x32 に最適な表現を選ばせて PNG 化する方式に簡素化
/// （描画コンテキスト不要でバックグラウンドスレッドでの安全性も明快）
fn fetch_icon_png_blocking(pid: libc::pid_t) -> Option<Vec<u8>> {
    // NSRunningApplication はスレッドセーフ（Apple ドキュメント明記）
    let app = NSRunningApplication::runningApplicationWithProcessIdentifier(pid)?;
    let icon = app.icon()?;

    let mut rect = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(ICON_SIZE, ICON_SIZE));
    // SAFETY: rect は有効な NSRect へのポインタ。context / hints は不要なので None
    let cg_image = unsafe { icon.CGImageForProposedRect_context_hints(&mut rect, None, None) }?;

    let rep = NSBitmapImageRep::initWithCGImage(NSBitmapImageRep::alloc(), &cg_image);
    // SAFETY: properties は空辞書（PNG 出力に追加プロパティは不要）
    let data = unsafe {
        rep.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new())
    }?;
    Some(data.to_vec())
}

/// ウィンドウリストへ FS キャッシュ済みアイコンを適用する（emit 前に呼ぶ）。
///
/// Electron 原本: helper.ts:513-529（applyProcessChange。icons.json を読み、
/// appIcon が空のプロセスへ `data:image/png;base64,` 付きで代入）。
/// 同一 owner の重複読み込みはメモ化で避ける
pub async fn apply_cached_icons(windows: &mut [MacWindow]) {
    let Some(base) = cache_base_dir() else {
        return;
    };

    // safe_owner_name → base64（キャッシュミスは None を記録して再読を防ぐ）
    let mut memo: HashMap<String, Option<String>> = HashMap::new();

    for win in windows.iter_mut() {
        if !win.app_icon.is_empty() {
            continue;
        }
        let key = safe_owner_name(&win.owner_name);
        let cached = match memo.get(&key) {
            Some(cached) => cached.clone(),
            None => {
                let loaded = tokio::fs::read(icon_cache_path(&base, &win.owner_name))
                    .await
                    .ok()
                    .map(|bytes| BASE64.encode(bytes));
                memo.insert(key, loaded.clone());
                loaded
            }
        };
        if let Some(b64) = cached {
            win.app_icon = format!("data:image/png;base64,{b64}");
        }
    }
}

/// キャッシュミスだったアイコン（appIcon が空のウィンドウ）を非同期で取得し、
/// まとめて 'iconUpdate' を全ウィンドウへ emit する（段階ロード）。
///
/// Electron 原本: helper.ts:32-56（handleIconUpdate が Swift からの逐次通知を
/// タスクバー＋fullWindowList へ中継）。Rust 版は Swift 側の役割ごと取り込み、
/// refresh_and_emit（window_observer.rs）の 'process' 送信直後に呼ばれる。
/// app.emit のブロードキャストが原本の「全タスクバー＋fullWindowList へ send」に対応。
///
/// 取得に失敗した owner（アイコンなし・50ms タイムアウト等）はキャッシュされず、
/// 次回リフレッシュで再試行される（Swift 原本もリスト生成のたびに再試行していた）
pub fn load_missing_icons_and_emit(app: AppHandle, windows: &[MacWindow]) {
    // 置換名 → (pid, 元 owner 名) で重複排除（同一アプリの複数ウィンドウ分をまとめる。
    // Swift 原本 main.swift:642 の uniquePids に対応）
    let mut targets: HashMap<String, (i64, String)> = HashMap::new();
    for win in windows {
        if win.app_icon.is_empty() {
            targets
                .entry(safe_owner_name(&win.owner_name))
                .or_insert((win.owner_pid, win.owner_name.clone()));
        }
    }
    if targets.is_empty() {
        return;
    }

    tauri::async_runtime::spawn(async move {
        // 並列取得（Swift 原本 main.swift:639-653 の concurrent queue に対応。
        // 各タスクの実体は spawn_blocking なので tokio の blocking プールが並列度を持つ）
        let mut join_set = tokio::task::JoinSet::new();
        for (safe_owner, (pid, owner)) in targets {
            join_set.spawn(async move { (safe_owner, get_icon(pid, &owner).await) });
        }

        let mut icons: HashMap<String, String> = HashMap::new();
        while let Some(result) = join_set.join_next().await {
            if let Ok((safe_owner, Some(b64))) = result {
                icons.insert(safe_owner, b64);
            }
        }

        if icons.is_empty() {
            return;
        }
        if let Err(e) = app.emit("iconUpdate", &icons) {
            log::warn!("failed to emit 'iconUpdate': {e}");
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn owner名の置換規則がフロントと一致する() {
        // index.vue:404 の replace(/\//g, '_').replace(/ /g, '') と同じ結果になること
        assert_eq!(safe_owner_name("Google Chrome"), "GoogleChrome");
        assert_eq!(safe_owner_name("Visual Studio Code"), "VisualStudioCode");
        assert_eq!(safe_owner_name("a/b/c"), "a_b_c");
        assert_eq!(safe_owner_name("A / B"), "A_B");
        // 置換不要な名前はそのまま
        assert_eq!(safe_owner_name("Finder"), "Finder");
        // 空文字は 'unknown'（index.vue:404 の `|| 'unknown'` に対応）
        assert_eq!(safe_owner_name(""), "unknown");
        // 全角スペースは対象外（JS の / /g は半角のみ）
        assert_eq!(safe_owner_name("通知　センター"), "通知　センター");
    }

    #[test]
    fn キャッシュパスは置換名のpngになる() {
        let base = Path::new("/tmp/taskbar.fm");
        assert_eq!(
            icon_cache_path(base, "Google Chrome"),
            PathBuf::from("/tmp/taskbar.fm/icons/GoogleChrome.png")
        );
        assert_eq!(
            icon_cache_path(base, "a/b"),
            PathBuf::from("/tmp/taskbar.fm/icons/a_b.png")
        );
        assert_eq!(
            icon_cache_path(base, ""),
            PathBuf::from("/tmp/taskbar.fm/icons/unknown.png")
        );
    }

    #[tokio::test]
    async fn キャッシュミス時はアイコンが空のままになる() {
        // 一時ディレクトリに直接キャッシュファイルを置いて経路検証したいところだが、
        // cache_base_dir が HOME 固定のため、ここでは「キャッシュミス時に
        // appIcon が空のまま」であることだけを検証する（純関数部は上のテストで担保）
        let mut windows = vec![test_window("存在しないアプリ名テスト用xyzw")];
        apply_cached_icons(&mut windows).await;
        assert_eq!(windows[0].app_icon, "");
    }

    fn test_window(owner: &str) -> MacWindow {
        // parse_window_info 経由だと冗長なので直接組み立てる
        serde_json::from_value(serde_json::json!({
            "kCGWindowLayer": 0,
            "kCGWindowMemoryUsage": 1024,
            "kCGWindowSharingState": 1,
            "kCGWindowOwnerPID": 99999,
            "kCGWindowOwnerName": owner,
            "kCGWindowNumber": 1,
            "kCGWindowBounds": { "X": 0, "Y": 0, "Width": 100, "Height": 100 }
        }))
        .unwrap()
    }
}
