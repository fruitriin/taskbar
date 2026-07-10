//! 設定ストア（tauri-plugin-store）ヘルパー
//!
//! Electron 原本: src/main/funcs/store.ts（electron-store の defaults / キー構成）
//! 計画書: docs/plans/rearch-phase3.md 3.3 store.rs 節
//!
//! ストアファイルは `config.json`（electron-store と同名）。キーは
//! - `options` … layout / windowSortByPositionInApp / appOrder / headers / footers
//! - `labeledFilters` … ウィンドウフィルタ設定（filter.rs の LabeledFilters と同型）
//!
//! デフォルト値は store.ts の defaults（store.ts:58-138）と一致させる。
//! electron-store の migrations（store.ts:39-57）は移植しない
//! （旧 config.json からのワンショット移行は 3.4 で計画。計画書「鮮度更新」節参照）。
//!
//! 設定の主管はフロントエンド（tauri-plugin-store の JS API）で、
//! Rust 側は同じストアインスタンスを共有して読み書きする。

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::{Store, StoreExt};

use crate::filter::{Filter, FilterValue, LabeledFilters};

/// ストアファイル名（electron-store の config.json と同名。
/// 保存先は tauri-plugin-store 既定の app_data_dir 配下）
pub const STORE_FILE: &str = "config.json";

/// options キー（store.ts:59）
pub const KEY_OPTIONS: &str = "options";
/// labeledFilters キー（store.ts:69）
pub const KEY_LABELED_FILTERS: &str = "labeledFilters";

/// タスクバーのレイアウト位置。TS 型 LayoutType（store.ts:36）と JSON 互換
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Layout {
    Right,
    Left,
    Bottom,
}

/// アプリ設定。TS 型 Options（store.ts:140、defaults は store.ts:59-65）と JSON 互換
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Options {
    pub layout: Layout,
    pub window_sort_by_position_in_app: bool,
    pub app_order: Vec<String>,
    pub headers: Vec<String>,
    pub footers: Vec<String>,
}

impl Default for Options {
    /// store.ts:59-65 の defaults.options と同値
    fn default() -> Self {
        Self {
            layout: Layout::Bottom,
            window_sort_by_position_in_app: false,
            app_order: Vec::new(),
            headers: Vec::new(),
            footers: Vec::new(),
        }
    }
}

/// デフォルトのフィルタ設定。store.ts:69-137 の defaults.labeledFilters と同値
pub fn default_labeled_filters() -> Vec<LabeledFilters> {
    fn owner(is: &str) -> Filter {
        Filter {
            property: "kCGWindowOwnerName".to_string(),
            is: FilterValue::Str(is.to_string()),
        }
    }
    fn name(is: &str) -> Filter {
        Filter {
            property: "kCGWindowName".to_string(),
            is: FilterValue::Str(is.to_string()),
        }
    }
    fn group(label: &str, filters: Vec<Filter>) -> LabeledFilters {
        LabeledFilters {
            label: label.to_string(),
            filters,
        }
    }

    vec![
        group(
            "オフスクリーンウィンドウを除外",
            vec![Filter {
                property: "kCGWindowIsOnscreen".to_string(),
                is: FilterValue::Bool(false),
            }],
        ),
        group("名無しを除外", vec![name("")]),
        group("Dockを除外", vec![owner("Dock")]),
        group("DockHelperを除外", vec![owner("DockHelper")]),
        group("スクリーンキャプチャを除外", vec![owner("screencapture")]),
        group(
            "スクリーンショットアプリを除外",
            vec![owner("スクリーンショット")],
        ),
        group("通知センターを除外", vec![name("Notification Center")]),
        group("通知センター（日本語）を除外", vec![owner("通知センター")]),
        group("Item-0を除外", vec![name("Item-0")]),
        group("Window Serverを除外", vec![owner("Window Server")]),
        group(
            "コントロールセンターを除外",
            vec![owner("コントロールセンター")],
        ),
        group("Spotlightを除外", vec![owner("Spotlight")]),
        group(
            "Google日本語入力を除外",
            vec![owner("GoogleJapaneseInputRenderer")],
        ),
        group("Taskbar.fmアプリを除外", vec![owner("taskbar.fm")]),
        group("Taskbar.fmウィンドウを除外", vec![name("taskbar.fm")]),
        group(
            "空のFinderウィンドウを除外",
            vec![owner("Finder"), name("")],
        ),
    ]
}

/// addFilter の追記ロジック（純関数）。
/// Electron 原本: events.ts:143-149 — 既存ラベルとの重複判定はせず、
/// 常に「1条件だけ持つ新しいグループ」を末尾に追加する
pub fn push_filter_group(
    mut current: Vec<LabeledFilters>,
    label: String,
    filter: Filter,
) -> Vec<LabeledFilters> {
    current.push(LabeledFilters {
        label,
        filters: vec![filter],
    });
    current
}

/// config.json ストアを開く（未ロードなら defaults 込みで生成、ロード済みなら共有
/// インスタンスを返す）。defaults は electron-store と同じく
/// 「トップレベルキーが無いときだけ」補われる
pub fn open<R: Runtime>(app: &AppHandle<R>) -> Result<Arc<Store<R>>, String> {
    app.store_builder(STORE_FILE)
        .default(
            KEY_OPTIONS,
            serde_json::to_value(Options::default()).map_err(|e| e.to_string())?,
        )
        .default(
            KEY_LABELED_FILTERS,
            serde_json::to_value(default_labeled_filters()).map_err(|e| e.to_string())?,
        )
        .build()
        .map_err(|e| format!("failed to open store {STORE_FILE}: {e}"))
}

/// options を読み取る。キー欠落・型不正時はデフォルト値
/// （electron-store の defaults フォールバックに相当。型不正は warn ログ付き）
pub fn get_options<R: Runtime>(app: &AppHandle<R>) -> Result<Options, String> {
    let store = open(app)?;
    Ok(read_or_default(store.get(KEY_OPTIONS), KEY_OPTIONS))
}

/// options を保存する（events.ts:82 の store.set('options', value) に対応）
pub fn set_options<R: Runtime>(app: &AppHandle<R>, options: &Options) -> Result<(), String> {
    let store = open(app)?;
    store.set(
        KEY_OPTIONS,
        serde_json::to_value(options).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())
}

/// labeledFilters を読み取る。キー欠落・型不正時はデフォルト値
pub fn get_labeled_filters<R: Runtime>(app: &AppHandle<R>) -> Result<Vec<LabeledFilters>, String> {
    let store = open(app)?;
    Ok(read_labeled_filters(store.get(KEY_LABELED_FILTERS)))
}

/// labeledFilters を保存する（events.ts:133-135 の store.set('labeledFilters', value) に対応）
pub fn set_labeled_filters<R: Runtime>(
    app: &AppHandle<R>,
    filters: &[LabeledFilters],
) -> Result<(), String> {
    let store = open(app)?;
    store.set(
        KEY_LABELED_FILTERS,
        serde_json::to_value(filters).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())
}

/// ストアを全消去して保存する（events.ts:114-116 の store.clear() に対応。
/// reset ではなく clear なので、次回 open 時に defaults が補われる）
pub fn clear<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let store = open(app)?;
    store.clear();
    store.save().map_err(|e| e.to_string())
}

/// options 値のデシリアライズ（欠落・不正はデフォルトへフォールバック）
fn read_or_default(value: Option<Value>, key: &str) -> Options {
    match value {
        None => Options::default(),
        Some(v) => serde_json::from_value(v).unwrap_or_else(|e| {
            log::warn!("store key '{key}' has invalid shape, falling back to defaults: {e}");
            Options::default()
        }),
    }
}

/// labeledFilters 値のデシリアライズ（欠落・不正はデフォルトへフォールバック）
fn read_labeled_filters(value: Option<Value>) -> Vec<LabeledFilters> {
    match value {
        None => default_labeled_filters(),
        Some(v) => serde_json::from_value(v).unwrap_or_else(|e| {
            log::warn!(
                "store key '{KEY_LABELED_FILTERS}' has invalid shape, falling back to defaults: {e}"
            );
            default_labeled_filters()
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn optionsのデフォルトはelectron版storeのdefaultsと一致する() {
        // store.ts:59-65 の defaults.options の JSON 形と突き合わせる
        let value = serde_json::to_value(Options::default()).unwrap();
        assert_eq!(
            value,
            json!({
                "layout": "bottom",
                "windowSortByPositionInApp": false,
                "appOrder": [],
                "headers": [],
                "footers": []
            })
        );
    }

    #[test]
    fn optionsはtsのjson形式とラウンドトリップできる() {
        // フロント（src/renderer/src/types.ts の Options）が送る形
        let json = r#"{
            "layout": "right",
            "windowSortByPositionInApp": true,
            "appOrder": ["Finder", "Safari"],
            "headers": ["Terminal"],
            "footers": []
        }"#;
        let options: Options = serde_json::from_str(json).unwrap();
        assert_eq!(options.layout, Layout::Right);
        assert!(options.window_sort_by_position_in_app);
        assert_eq!(options.app_order, vec!["Finder", "Safari"]);
        assert_eq!(options.headers, vec!["Terminal"]);

        let back = serde_json::to_value(&options).unwrap();
        assert_eq!(back["layout"], "right");
        assert_eq!(back["windowSortByPositionInApp"], true);
    }

    #[test]
    fn 不正なlayoutはデシリアライズエラーになる() {
        // 'top' は Electron 版にも存在しない不正値（LayoutType は right/left/bottom）
        let json = r#"{
            "layout": "top",
            "windowSortByPositionInApp": false,
            "appOrder": [], "headers": [], "footers": []
        }"#;
        assert!(serde_json::from_str::<Options>(json).is_err());
    }

    #[test]
    fn 型不正なストア値はデフォルトにフォールバックする() {
        assert_eq!(read_or_default(None, KEY_OPTIONS), Options::default());
        assert_eq!(
            read_or_default(Some(json!("broken")), KEY_OPTIONS),
            Options::default()
        );
        assert_eq!(read_labeled_filters(None), default_labeled_filters());
        assert_eq!(
            read_labeled_filters(Some(json!(42))),
            default_labeled_filters()
        );
    }

    #[test]
    fn デフォルトフィルタはstore_tsのdefaultsと同じ構成() {
        let filters = default_labeled_filters();
        // store.ts:69-137 は 16 グループ
        assert_eq!(filters.len(), 16);
        assert_eq!(filters[0].label, "オフスクリーンウィンドウを除外");
        assert_eq!(filters[0].filters[0].is, FilterValue::Bool(false));
        // 最後のグループだけ AND 2条件（空のFinderウィンドウ）
        let finder = filters.last().unwrap();
        assert_eq!(finder.label, "空のFinderウィンドウを除外");
        assert_eq!(finder.filters.len(), 2);

        // JSON 形も TS 側と互換（"is" キー、値は string/bool のリテラル）
        let value = serde_json::to_value(&filters).unwrap();
        assert_eq!(
            value[2],
            json!({
                "label": "Dockを除外",
                "filters": [{ "property": "kCGWindowOwnerName", "is": "Dock" }]
            })
        );
    }

    #[test]
    fn push_filter_groupは常に新しいグループを末尾に追加する() {
        // events.ts:143-149: 既存ラベルと重複してもマージせず追記
        let filter = Filter {
            property: "kCGWindowOwnerName".to_string(),
            is: FilterValue::Str("MyApp".to_string()),
        };
        let once = push_filter_group(Vec::new(), "MyAppを除外".to_string(), filter.clone());
        assert_eq!(once.len(), 1);
        assert_eq!(once[0].label, "MyAppを除外");
        assert_eq!(once[0].filters, vec![filter.clone()]);

        // 同じラベルでもう一度 → グループが2つになる（マージされない）
        let twice = push_filter_group(once, "MyAppを除外".to_string(), filter.clone());
        assert_eq!(twice.len(), 2);
        assert_eq!(twice[1].filters, vec![filter]);
    }
}

// --- Electron 版からのワンショット移行（Phase 3.4） ---
// 旧 electron-store の設定ファイル（~/Library/Application Support/taskbar.fm/config.json）から
// options / labeledFilters を取り込む。Tauri ストアに options が既にあれば何もしない（冪等）。

/// 旧 electron-store の JSON から移行対象を抽出する純関数
pub fn extract_electron_config(
    raw: &serde_json::Value,
) -> (Option<serde_json::Value>, Option<serde_json::Value>) {
    let options = raw.get("options").cloned();
    let filters = raw.get("labeledFilters").cloned();
    (options, filters)
}

/// 旧 Electron 版の設定ファイルパス（productName "taskbar.fm" の userData 直下）
fn electron_config_path() -> Option<std::path::PathBuf> {
    dirs_home().map(|h| h.join("Library/Application Support/taskbar.fm/config.json"))
}

fn dirs_home() -> Option<std::path::PathBuf> {
    std::env::var_os("HOME").map(std::path::PathBuf::from)
}

/// 初回起動時の移行。Tauri ストアが未初期化（options キーなし）かつ旧ファイルが
/// 存在する場合のみ取り込む。失敗は起動を止めずログに留める
pub fn migrate_from_electron<R: Runtime>(app: &AppHandle<R>) {
    let store = match open(app) {
        Ok(s) => s,
        Err(e) => {
            log::warn!("移行スキップ（store open 失敗）: {e}");
            return;
        }
    };
    if store.get("options").is_some() {
        return; // 既に初期化済み
    }
    let Some(path) = electron_config_path() else {
        return;
    };
    let Ok(raw_text) = std::fs::read_to_string(&path) else {
        return; // 旧ファイルなし = 新規ユーザー
    };
    let Ok(raw) = serde_json::from_str::<serde_json::Value>(&raw_text) else {
        log::warn!(
            "移行スキップ（旧 config.json のパース失敗）: {}",
            path.display()
        );
        return;
    };
    let (options, filters) = extract_electron_config(&raw);
    if let Some(o) = options {
        store.set("options", o);
    }
    if let Some(f) = filters {
        store.set("labeledFilters", f);
    }
    if let Err(e) = store.save() {
        log::warn!("移行結果の保存に失敗: {e}");
        return;
    }
    log::info!("Electron 版の設定を移行しました: {}", path.display());
}

#[cfg(test)]
mod migration_tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn 旧設定から_options_と_labeled_filters_を抽出する() {
        let raw = json!({
            "options": { "layout": "left", "appOrder": ["A"] },
            "labeledFilters": [{ "label": "x", "filters": [] }],
            "filters_backup": []
        });
        let (o, f) = extract_electron_config(&raw);
        assert_eq!(o.unwrap()["layout"], "left");
        assert_eq!(f.unwrap()[0]["label"], "x");
    }

    #[test]
    fn キーが無ければ_none_を返す() {
        let (o, f) = extract_electron_config(&json!({}));
        assert!(o.is_none() && f.is_none());
    }
}
