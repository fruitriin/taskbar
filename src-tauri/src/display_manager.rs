//! マルチディスプレイ対応（タスクバーウィンドウの動的生成・配置・displayInfo）
//!
//! Electron 原本: src/main/funcs/windows.ts
//! - recreateAllWindows（windows.ts:38-61）… 全ディスプレイ分のウィンドウ生成
//! - createWindow（windows.ts:63-120）… タスクバーウィンドウの属性と
//!   windowReady → 'displayInfo'（自分のディスプレイの workArea）送信
//! - windowPosition（windows.ts:122-133）… layout に応じた位置・サイズ計算
//! - ディスプレイ増減・メトリクス変更の検知（events.ts:50-52 の
//!   Screen.on('display-added'/'display-removed'/'display-metrics-changed')）
//!
//! ウィンドウ生成方式の判断:
//! - tauri.conf.json の静的 taskbar ウィンドウ定義は削除し、setup での動的生成に
//!   一本化した。静的定義を残すとモニタ台数と無関係な固定1枚が必ず生まれ、
//!   ラベル体系（taskbar-<index>）とも衝突するため
//! - Electron 原本の recreateAllWindows は「全ディスプレイ分を新規作成 → 新 ID に
//!   含まれない旧ウィンドウを閉じる」方式だが、Tauri のウィンドウラベルは固定
//!   識別子で同名の並存ができない。そのため Rust 版は
//!   「あるものは再配置・足りない分は生成・余った分は破棄」のリコンサイル方式に
//!   変更した（WebView の再ロードが不要になる副次効果もある）
//!
//! モニタ変更検知の判断:
//! Tauri v2 にはモニタ構成変更の RunEvent / WindowEvent が無い
//! （WindowEvent::ScaleFactorChanged はウィンドウ単位のみ）ため、AppKit の
//! NSApplicationDidChangeScreenParametersNotification を購読する。
//! 1回の構成変更で複数回 post されることがあるため、window_observer.rs と同じ
//! trailing デバウンス（500ms）でまとめてから再同期する。

use std::ptr::NonNull;
use std::time::Duration;

use block2::RcBlock;
use objc2_app_kit::NSApplicationDidChangeScreenParametersNotification;
use objc2_foundation::{NSNotification, NSNotificationCenter};
use serde::Serialize;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Monitor, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};
use tokio::sync::mpsc;

use crate::store::{self, Layout};
use crate::window_observer::debounce_loop;

/// タスクバーウィンドウのラベル接頭辞（taskbar-0, taskbar-1, ...）
pub const TASKBAR_LABEL_PREFIX: &str = "taskbar-";

/// タスクバーの太さ（windows.ts:128-131 の定数。left/right は 210px、bottom は 60px）
const SIDE_WIDTH: f64 = 210.0;
const BOTTOM_HEIGHT: f64 = 60.0;

/// スクリーン構成変更のデバウンス（window_observer.rs の DEBOUNCE と同じ 500ms。
/// Electron 原本はデバウンスなしで recreateAllWindows していたが、
/// 解像度変更時に通知が連発するため Rust 版でまとめる）
const SCREEN_DEBOUNCE: Duration = Duration::from_millis(500);

/// 'displayInfo' イベントの形。Electron 原本（windows.ts:105-109）の
/// { label, id, workArea } に対応する。id は Tauri の Monitor に安定した数値 ID が
/// 無いため省略（フロントは workArea のみ参照: src/renderer/src/pages/index.vue:127-140）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayInfo {
    pub label: String,
    pub work_area: WorkArea,
}

/// Electron の display.workArea（DIP 座標 = 論理ピクセル）に一致する形
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct WorkArea {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// タスクバーウィンドウの位置・サイズ（論理ピクセル）
#[derive(Debug, Clone, PartialEq)]
pub struct TaskbarBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// layout に応じたタスクバーの位置・サイズ計算（純関数）。
///
/// Electron 原本: windows.ts:122-133（windowPosition）の忠実な移植
/// - right: 画面右端から 210px
/// - bottom: 画面下端から 60px、幅いっぱい
/// - left: 左端に 210px、高さいっぱい
pub fn taskbar_bounds(work_area: &WorkArea, layout: Layout) -> TaskbarBounds {
    TaskbarBounds {
        x: if layout == Layout::Right {
            work_area.x + work_area.width - SIDE_WIDTH
        } else {
            work_area.x
        },
        y: if layout == Layout::Bottom {
            work_area.height + work_area.y - BOTTOM_HEIGHT
        } else {
            work_area.y
        },
        width: if layout == Layout::Bottom {
            work_area.width
        } else {
            SIDE_WIDTH
        },
        height: if layout != Layout::Bottom {
            work_area.height
        } else {
            BOTTOM_HEIGHT
        },
    }
}

/// タスクバーウィンドウのラベル（純関数）
pub fn taskbar_label(index: usize) -> String {
    format!("{TASKBAR_LABEL_PREFIX}{index}")
}

/// ラベルからタスクバーのインデックスを取り出す（純関数）。
/// taskbar-* 以外のウィンドウ（option / menu / fullWindowList）は None
pub fn parse_taskbar_index(label: &str) -> Option<usize> {
    label.strip_prefix(TASKBAR_LABEL_PREFIX)?.parse().ok()
}

/// Tauri の Monitor（物理ピクセル）から Electron 互換の workArea（論理ピクセル）を組む
fn monitor_work_area(monitor: &Monitor) -> WorkArea {
    let scale = monitor.scale_factor();
    let position = monitor.work_area().position.to_logical::<f64>(scale);
    let size = monitor.work_area().size.to_logical::<f64>(scale);
    WorkArea {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    }
}

/// モニタ構成とタスクバーウィンドウを一致させる（生成・再配置・破棄）。
/// setup 時の初期生成と、スクリーン構成変更時の再同期の両方から呼ばれる。
///
/// Electron 原本: recreateAllWindows（windows.ts:38-61）。方式の違いは
/// ファイル冒頭の判断コメント参照
pub fn sync_taskbar_windows(app: &AppHandle) -> Result<(), String> {
    let layout = store::get_options(app)?.layout;
    let monitors = app
        .available_monitors()
        .map_err(|e| format!("failed to get monitors: {e}"))?;

    for (index, monitor) in monitors.iter().enumerate() {
        let label = taskbar_label(index);
        let bounds = taskbar_bounds(&monitor_work_area(monitor), layout);
        match app.get_webview_window(&label) {
            Some(window) => position_taskbar(&window, &bounds)?,
            None => {
                create_taskbar_window(app, &label, &bounds)?;
            }
        }
    }

    // モニタが減った場合の余剰ウィンドウを破棄（windows.ts:47-57 の close 相当。
    // close() は close-requested を経由するため、確実に消える destroy() を使う）
    for (label, window) in app.webview_windows() {
        if let Some(index) = parse_taskbar_index(&label) {
            if index >= monitors.len() {
                if let Err(e) = window.destroy() {
                    log::warn!("failed to destroy taskbar window '{label}': {e}");
                }
            }
        }
    }

    Ok(())
}

/// タスクバーウィンドウを1枚生成する。
///
/// 属性は削除した tauri.conf.json の静的 taskbar 定義＋ Electron 原本
/// createWindow（windows.ts:64-79）に合わせる。原本の movable/maximizable/
/// minimizable=false は Tauri では resizable/maximizable/minimizable で対応
/// （skip_taskbar は macOS 非対応の no-op だが、他 OS 対応時のため原本どおり指定）
fn create_taskbar_window(
    app: &AppHandle,
    label: &str,
    bounds: &TaskbarBounds,
) -> Result<WebviewWindow, String> {
    WebviewWindowBuilder::new(app, label, WebviewUrl::App("/?view=taskbar".into()))
        .title("taskbar.fm")
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        // タスクバーが非アクティブでも最初のクリックをボタンに届ける
        // （macOS は既定で first click をアクティブ化に消費し、2クリック必要になる）
        .accept_first_mouse(true)
        .skip_taskbar(true)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .position(bounds.x, bounds.y)
        .inner_size(bounds.width, bounds.height)
        .build()
        .map_err(|e| format!("failed to create taskbar window '{label}': {e}"))
}

/// タスクバーウィンドウを指定の位置・サイズへ動かす
/// （Electron 原本 events.ts:94 の setBounds(windowPosition(...)) に対応）
fn position_taskbar(window: &WebviewWindow, bounds: &TaskbarBounds) -> Result<(), String> {
    window
        .set_position(LogicalPosition::new(bounds.x, bounds.y))
        .map_err(|e| format!("failed to set position of '{}': {e}", window.label()))?;
    window
        .set_size(LogicalSize::new(bounds.width, bounds.height))
        .map_err(|e| format!("failed to set size of '{}': {e}", window.label()))
}

/// 各タスクバーへ「そのウィンドウが乗っているモニタ」の workArea を emit する。
///
/// Electron 原本: windows.ts:102-112 — どのウィンドウの windowReady でも、
/// 各タスクバーが「自分のディスプレイ」の displayInfo を受け取る
/// （リスナーがタスクバーごとに登録され、全リスナーが発火する構造）。
/// Rust 版は emit_to でウィンドウ個別に送ることで同じ結果にする
pub fn emit_display_info(app: &AppHandle) {
    for (label, window) in app.webview_windows() {
        if parse_taskbar_index(&label).is_none() {
            continue;
        }
        let monitor = match window.current_monitor() {
            Ok(Some(monitor)) => monitor,
            Ok(None) => continue,
            Err(e) => {
                log::warn!("failed to get monitor of '{label}': {e}");
                continue;
            }
        };
        let info = DisplayInfo {
            label: monitor.name().cloned().unwrap_or_default(),
            work_area: monitor_work_area(&monitor),
        };
        if let Err(e) = app.emit_to(&label, "displayInfo", &info) {
            log::warn!("failed to emit 'displayInfo' to '{label}': {e}");
        }
    }
}

/// layout 変更時に全タスクバーを再配置する。
///
/// Electron 原本: events.ts:86-95（setOptions で layout が変わったとき
/// setBounds(windowPosition(targetDisplay, newLayout))）。
/// workArea 自体は layout で変わらないため displayInfo の再送はしない（原本同様）
pub fn apply_layout(app: &AppHandle, layout: Layout) -> Result<(), String> {
    for (label, window) in app.webview_windows() {
        if parse_taskbar_index(&label).is_none() {
            continue;
        }
        let Ok(Some(monitor)) = window.current_monitor() else {
            log::warn!("failed to get monitor of '{label}', skipping reposition");
            continue;
        };
        let bounds = taskbar_bounds(&monitor_work_area(&monitor), layout);
        position_taskbar(&window, &bounds)?;
    }
    Ok(())
}

/// スクリーン構成変更（モニタ増減・解像度変更）の監視を開始する。
/// lib.rs の setup（メインスレッド）から呼ぶ。
///
/// Electron 原本: events.ts:50-52（display-added / display-removed /
/// display-metrics-changed → recreateAllWindows）。
/// 通知登録の方式は window_observer.rs の start_observation と同じ
/// （ブロック内はチャンネル送信のみ、実処理は tokio 側のデバウンスループ）
pub fn start_screen_observation(app: AppHandle) {
    let (tx, rx) = mpsc::unbounded_channel::<()>();

    let block = RcBlock::new(move |_notification: NonNull<NSNotification>| {
        let _ = tx.send(());
    });
    let center = NSNotificationCenter::defaultCenter();
    // SAFETY: 通知名は AppKit の静的定数、block は 'static クロージャ。
    // queue=None でも中身はチャンネル送信のみでスレッド安全
    let token = unsafe {
        center.addObserverForName_object_queue_usingBlock(
            Some(NSApplicationDidChangeScreenParametersNotification),
            None,
            None,
            &block,
        )
    };
    // アプリ寿命いっぱい監視し続けるため observer トークンは意図的にリークする
    // （window_observer.rs と同じ判断）
    std::mem::forget(token);

    tauri::async_runtime::spawn(async move {
        let app_for_action = app.clone();
        debounce_loop(rx, SCREEN_DEBOUNCE, move || {
            let app = app_for_action.clone();
            async move {
                if let Err(e) = sync_taskbar_windows(&app) {
                    log::warn!("failed to sync taskbar windows: {e}");
                }
                // 再配置後の workArea をフロントへ再送（Electron 原本では
                // ウィンドウ再作成 → windowReady 再送 → displayInfo 再送の流れが
                // 暗黙に担っていた部分。リコンサイル方式では明示的に送る）
                emit_display_info(&app);
            }
        })
        .await;
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    /// メインモニタ相当の workArea（メニューバー 25px 除外済みを模す）
    fn main_work_area() -> WorkArea {
        WorkArea {
            x: 0.0,
            y: 25.0,
            width: 1920.0,
            height: 1055.0,
        }
    }

    /// 左側に縦置きされたサブモニタ相当（負の座標を持つ）
    fn negative_work_area() -> WorkArea {
        WorkArea {
            x: -1080.0,
            y: -500.0,
            width: 1080.0,
            height: 1920.0,
        }
    }

    #[test]
    fn bottomレイアウトは画面下端に幅いっぱい() {
        // windows.ts:122-133 と同値になること
        let bounds = taskbar_bounds(&main_work_area(), Layout::Bottom);
        assert_eq!(
            bounds,
            TaskbarBounds {
                x: 0.0,
                y: 1055.0 + 25.0 - 60.0, // workArea.height + workArea.y - 60
                width: 1920.0,
                height: 60.0,
            }
        );
    }

    #[test]
    fn rightレイアウトは右端から210px() {
        let bounds = taskbar_bounds(&main_work_area(), Layout::Right);
        assert_eq!(
            bounds,
            TaskbarBounds {
                x: 1920.0 - 210.0, // workArea.x + workArea.width - 210
                y: 25.0,
                width: 210.0,
                height: 1055.0,
            }
        );
    }

    #[test]
    fn leftレイアウトは左端に210px() {
        let bounds = taskbar_bounds(&main_work_area(), Layout::Left);
        assert_eq!(
            bounds,
            TaskbarBounds {
                x: 0.0,
                y: 25.0,
                width: 210.0,
                height: 1055.0,
            }
        );
    }

    #[test]
    fn 負の座標を持つサブモニタでも原本と同じ式で計算される() {
        // マルチディスプレイでは workArea が負座標になる（プライマリ左上が原点）
        let wa = negative_work_area();
        let bottom = taskbar_bounds(&wa, Layout::Bottom);
        assert_eq!(bottom.x, -1080.0);
        assert_eq!(bottom.y, 1920.0 + (-500.0) - 60.0);
        assert_eq!(bottom.width, 1080.0);

        let right = taskbar_bounds(&wa, Layout::Right);
        assert_eq!(right.x, -1080.0 + 1080.0 - 210.0);
        assert_eq!(right.y, -500.0);
        assert_eq!(right.height, 1920.0);
    }

    #[test]
    fn タスクバーラベルの生成と解析が対になる() {
        assert_eq!(taskbar_label(0), "taskbar-0");
        assert_eq!(taskbar_label(12), "taskbar-12");
        assert_eq!(parse_taskbar_index("taskbar-0"), Some(0));
        assert_eq!(parse_taskbar_index("taskbar-12"), Some(12));
        // taskbar-* 以外のウィンドウは対象外
        assert_eq!(parse_taskbar_index("option"), None);
        assert_eq!(parse_taskbar_index("menu"), None);
        assert_eq!(parse_taskbar_index("fullWindowList"), None);
        assert_eq!(parse_taskbar_index("taskbar-"), None);
        assert_eq!(parse_taskbar_index("taskbar-abc"), None);
    }

    #[test]
    fn displayinfoのjson形はelectron版と互換() {
        // フロント（index.vue:434-438）は { workArea: { x, y, width, height } } を参照
        let info = DisplayInfo {
            label: "Built-in Display".to_string(),
            work_area: main_work_area(),
        };
        let value = serde_json::to_value(&info).unwrap();
        assert_eq!(value["label"], "Built-in Display");
        assert_eq!(value["workArea"]["x"], 0.0);
        assert_eq!(value["workArea"]["y"], 25.0);
        assert_eq!(value["workArea"]["width"], 1920.0);
        assert_eq!(value["workArea"]["height"], 1055.0);
    }
}
