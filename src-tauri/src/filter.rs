//! ウィンドウフィルタリング（純関数）
//!
//! Swift 原本: nativeSrc/taskbar.helper/main.swift:123-459
//! （FilterRule / FilterValue / LabeledFilter / filterWindows の移植。
//! FilterManager のファイル監視部分は tauri-plugin-store 連携の後続タスクで
//! 置き換えるため移植しない）
//!
//! JSON 互換性: フロントの TS 型（src/renderer/src/types.ts の
//! LabeledFilters / Filter）と同じ形を serde で受ける。
//! `{ "label": string, "filters": [{ "property": string, "is": string|number|boolean }] }`
//!
//! # フィルタ判定セマンティクス（main.swift:393-459 から読み取った判定表）
//!
//! 前段: サイズフィルタ（main.swift:397-405）
//!   kCGWindowBounds の Height または Width の整数部が 40 未満 → 無条件に除外
//!   （NSNumber.intValue 相当の切り捨て比較。ラベル付きフィルタより先に評価）
//!
//! 本段: ラベル付きフィルタ（main.swift:415-455）
//!   - グループ内の全条件が一致（AND）したグループが1つでもあれば除外（グループ間 OR）
//!   - 条件が空のグループは何も除外しない（main.swift:452 の `!matches.isEmpty`）
//!
//! 1条件の判定表（main.swift:420-448）:
//!
//! | フィルタ値型 ＼ ウィンドウ値 | 文字列        | 数値               | キー欠落 |
//! |------------------------------|---------------|--------------------|----------|
//! | 文字列                       | 等値比較      | 不一致             | 不一致※ |
//! | 整数                         | 不一致        | i64 等値           | 不一致   |
//! | 真偽値                       | 不一致        | (値 != 0) == 期待  | 不一致   |
//!
//! ※特別処理（main.swift:420-429）: property が "kCGWindowName" かつフィルタ値が
//!   空文字列のとき、ウィンドウ名が「空文字列またはキー欠落」なら一致とする
//!   （スクリーン録画権限が無いと kCGWindowName 自体が返らないための救済）。
//!
//! 補足:
//! - Swift 原本の window[property] はトップレベルキーの参照なので、
//!   TS 型 NumberFilter にある X/Y/Width/Height（kCGWindowBounds 内のネスト値）は
//!   原本でも常に不一致＝除外効果なし。本実装も同じ挙動にする
//! - kCGWindowBounds 自体を property に指定した場合、原本では CFDictionary の
//!   String/NSNumber キャストが失敗して不一致。本実装では「欠落」扱いで同結果
//! - 真偽値フィルタと数値の比較は NSNumber.boolValue 相当（0 → false、非 0 → true）。
//!   kCGWindowIsOnscreen は数値（0/1）で来るため、これで bool フィルタと突き合う
//! - フィルタ値が小数の場合、Swift 原本は FilterValue のデコードに失敗して
//!   設定ファイル全体が無効（デフォルトフィルタへフォールバック）になるが、
//!   Rust 版は数値として受理し等値比較する（TS 型 `is: number` との互換を優先）

use serde::{Deserialize, Serialize};

use crate::window_manager::MacWindow;

/// フィルタ1条件。TS 型 Filter（src/renderer/src/types.ts:26）と JSON 互換。
/// Swift 原本: FilterRule（main.swift:126-134）
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Filter {
    pub property: String,
    /// JSON キーは "is"（TS: `is: string | number | boolean`）
    pub is: FilterValue,
}

/// フィルタ条件値。Swift 原本: FilterValue（main.swift:136-165）
/// untagged なので JSON の string / number / boolean をそのまま受ける
/// （整数優先: 40 → Int、40.5 → Float）
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum FilterValue {
    Str(String),
    Int(i64),
    Float(f64),
    Bool(bool),
}

/// ラベル付きフィルタグループ。TS 型 LabeledFilters（types.ts:28-31）と JSON 互換。
/// Swift 原本: LabeledFilter（main.swift:167-170）
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LabeledFilters {
    pub label: String,
    pub filters: Vec<Filter>,
}

/// ウィンドウをフィルタリングし、(通過リスト, 除外リスト) を返す純関数。
///
/// Swift 原本: filterWindows（main.swift:393-459）は通過リストのみ返すが、
/// `exclude` コマンド（main.swift:1116-1128）が差集合で除外リストを再計算していた。
/// Rust 版は partition で両方を一度に返し、除外リストを
/// 'catchExcludeWindow' イベント / getExcludeWindows コマンド用に保持できるようにする。
pub fn filter_windows(
    windows: Vec<MacWindow>,
    filters: &[LabeledFilters],
) -> (Vec<MacWindow>, Vec<MacWindow>) {
    windows.into_iter().partition(|w| !is_excluded(w, filters))
}

/// 1ウィンドウが除外対象かどうか
fn is_excluded(window: &MacWindow, filters: &[LabeledFilters]) -> bool {
    // サイズフィルタ（main.swift:397-405）: 高さ/幅の整数部が 40 未満は常に除外
    if (window.bounds.height as i64) < 40 || (window.bounds.width as i64) < 40 {
        return true;
    }

    // ラベル付きフィルタ: グループ内 AND、グループ間 OR（main.swift:415-455）。
    // 条件が空のグループは除外しない（main.swift:452 の `!matches.isEmpty`）
    filters.iter().any(|group| {
        !group.filters.is_empty() && group.filters.iter().all(|r| rule_matches(window, r))
    })
}

/// ウィンドウのトップレベルプロパティ値（Swift 原本の window[property] 相当）
enum WindowValue<'a> {
    Int(i64),
    Str(&'a str),
}

/// property 名 → ウィンドウの値。キー欠落（Option が None のフィールド、
/// 未知のキー、ネストされた X/Y/Width/Height）は None
fn window_property<'a>(window: &'a MacWindow, property: &str) -> Option<WindowValue<'a>> {
    match property {
        "kCGWindowLayer" => Some(WindowValue::Int(window.layer)),
        "kCGWindowName" => window.name.as_deref().map(WindowValue::Str),
        "kCGWindowMemoryUsage" => Some(WindowValue::Int(window.memory_usage)),
        "kCGWindowIsOnscreen" => window.is_onscreen.map(WindowValue::Int),
        "kCGWindowSharingState" => Some(WindowValue::Int(window.sharing_state)),
        "kCGWindowOwnerPID" => Some(WindowValue::Int(window.owner_pid)),
        "kCGWindowOwnerName" => Some(WindowValue::Str(&window.owner_name)),
        "kCGWindowNumber" => Some(WindowValue::Int(window.window_number)),
        "kCGWindowStoreType" => window.store_type.map(WindowValue::Int),
        // kCGWindowBounds（CFDictionary）は原本でもキャスト失敗で不一致、
        // X/Y/Width/Height はトップレベルキーでないため原本でも常に不一致。
        // どちらも None（→ 不一致）で同じ結果になる
        _ => None,
    }
}

/// 1条件がウィンドウに一致するか（モジュール冒頭の判定表を参照）
fn rule_matches(window: &MacWindow, rule: &Filter) -> bool {
    // 特別処理（main.swift:420-429）: kCGWindowName × 空文字フィルタは
    // 「名前が空文字またはキー欠落」を一致として扱う
    if rule.property == "kCGWindowName" {
        if let FilterValue::Str(s) = &rule.is {
            if s.is_empty() && window.name.as_deref().unwrap_or("").is_empty() {
                return true;
            }
        }
    }

    // プロパティ欠落は不一致（main.swift:431-435）
    let Some(value) = window_property(window, &rule.property) else {
        return false;
    };

    // 型ごとの比較（main.swift:437-448）
    match (&rule.is, value) {
        (FilterValue::Str(f), WindowValue::Str(w)) => w == f,
        (FilterValue::Int(f), WindowValue::Int(w)) => w == *f,
        // Swift 原本は小数フィルタ値を表現できない（モジュール冒頭コメント参照）
        (FilterValue::Float(f), WindowValue::Int(w)) => (w as f64) == *f,
        // NSNumber.boolValue 相当: 0 → false、非 0 → true（main.swift:444-445）
        (FilterValue::Bool(f), WindowValue::Int(w)) => (w != 0) == *f,
        // 型不一致（文字列 vs 数値など）は不一致
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::window_manager::WindowBounds;

    /// テスト用ウィンドウのビルダー
    fn window(owner: &str, name: Option<&str>) -> MacWindow {
        MacWindow {
            layer: 0,
            name: name.map(String::from),
            memory_usage: 1264,
            is_onscreen: Some(1),
            sharing_state: 1,
            owner_pid: 4242,
            owner_name: owner.to_string(),
            window_number: 118,
            store_type: Some(1),
            bounds: WindowBounds {
                x: 0.0,
                y: 0.0,
                width: 800.0,
                height: 600.0,
            },
            app_icon: String::new(),
        }
    }

    fn group(label: &str, filters: Vec<Filter>) -> LabeledFilters {
        LabeledFilters {
            label: label.to_string(),
            filters,
        }
    }

    fn rule(property: &str, is: FilterValue) -> Filter {
        Filter {
            property: property.to_string(),
            is,
        }
    }

    #[test]
    fn 文字列フィルタの一致で除外される() {
        let filters = [group(
            "Dockを除外",
            vec![rule("kCGWindowOwnerName", FilterValue::Str("Dock".into()))],
        )];
        let windows = vec![
            window("Dock", Some("Dock")),
            window("TextEdit", Some("無題")),
        ];
        let (passed, excluded) = filter_windows(windows, &filters);
        assert_eq!(passed.len(), 1);
        assert_eq!(passed[0].owner_name, "TextEdit");
        assert_eq!(excluded.len(), 1);
        assert_eq!(excluded[0].owner_name, "Dock");
    }

    #[test]
    fn 型不一致では除外されない() {
        // 数値プロパティに文字列フィルタ → 不一致
        let str_on_number = [group(
            "型不一致1",
            vec![rule("kCGWindowNumber", FilterValue::Str("118".into()))],
        )];
        // 文字列プロパティに整数フィルタ → 不一致
        let int_on_string = [group(
            "型不一致2",
            vec![rule("kCGWindowOwnerName", FilterValue::Int(118))],
        )];
        // 文字列プロパティに真偽値フィルタ → 不一致
        let bool_on_string = [group(
            "型不一致3",
            vec![rule("kCGWindowOwnerName", FilterValue::Bool(true))],
        )];
        let w = || vec![window("TextEdit", Some("無題"))];
        assert_eq!(filter_windows(w(), &str_on_number).1.len(), 0);
        assert_eq!(filter_windows(w(), &int_on_string).1.len(), 0);
        assert_eq!(filter_windows(w(), &bool_on_string).1.len(), 0);
    }

    #[test]
    fn 整数フィルタは数値プロパティと等値比較される() {
        let filters = [group(
            "ウィンドウ番号118を除外",
            vec![rule("kCGWindowNumber", FilterValue::Int(118))],
        )];
        let (passed, excluded) = filter_windows(vec![window("TextEdit", None)], &filters);
        assert_eq!(passed.len(), 0);
        assert_eq!(excluded.len(), 1);

        let miss = [group(
            "不一致",
            vec![rule("kCGWindowNumber", FilterValue::Int(999))],
        )];
        assert_eq!(
            filter_windows(vec![window("TextEdit", None)], &miss)
                .1
                .len(),
            0
        );
    }

    #[test]
    fn 複数条件はand判定() {
        // Swift 原本デフォルトの「空のFinderウィンドウを除外」（main.swift:385-388）と同じ構成
        let filters = [group(
            "空のFinderウィンドウを除外",
            vec![
                rule("kCGWindowOwnerName", FilterValue::Str("Finder".into())),
                rule("kCGWindowName", FilterValue::Str("".into())),
            ],
        )];
        let windows = vec![
            window("Finder", Some("")),        // 両方一致 → 除外
            window("Finder", Some("Desktop")), // owner のみ一致 → 通過
            window("TextEdit", Some("")),      // name のみ一致 → 通過
        ];
        let (passed, excluded) = filter_windows(windows, &filters);
        assert_eq!(excluded.len(), 1);
        assert_eq!(excluded[0].owner_name, "Finder");
        assert_eq!(passed.len(), 2);
    }

    #[test]
    fn グループ間はor判定() {
        let filters = [
            group(
                "Dockを除外",
                vec![rule("kCGWindowOwnerName", FilterValue::Str("Dock".into()))],
            ),
            group(
                "Spotlightを除外",
                vec![rule(
                    "kCGWindowOwnerName",
                    FilterValue::Str("Spotlight".into()),
                )],
            ),
        ];
        let windows = vec![
            window("Dock", Some("Dock")),
            window("Spotlight", Some("Spotlight")),
            window("TextEdit", Some("無題")),
        ];
        let (passed, excluded) = filter_windows(windows, &filters);
        assert_eq!(excluded.len(), 2);
        assert_eq!(passed.len(), 1);
        assert_eq!(passed[0].owner_name, "TextEdit");
    }

    #[test]
    fn 空フィルタでは何も除外されない() {
        // フィルタグループ自体が無い
        let (passed, excluded) = filter_windows(vec![window("Dock", Some("Dock"))], &[]);
        assert_eq!(passed.len(), 1);
        assert_eq!(excluded.len(), 0);

        // 条件が空のグループは除外しない（main.swift:452 の `!matches.isEmpty`）
        let empty_group = [group("空のグループ", vec![])];
        let (passed, excluded) = filter_windows(vec![window("Dock", Some("Dock"))], &empty_group);
        assert_eq!(passed.len(), 1);
        assert_eq!(excluded.len(), 0);
    }

    #[test]
    fn ウィンドウ名の空文字フィルタは欠落も一致扱い() {
        // Swift 原本の特別処理（main.swift:420-429）
        let filters = [group(
            "名無しを除外",
            vec![rule("kCGWindowName", FilterValue::Str("".into()))],
        )];
        let windows = vec![
            window("A", None),             // キー欠落 → 一致（除外）
            window("B", Some("")),         // 空文字 → 一致（除外）
            window("C", Some("タイトル")), // 名前あり → 通過
        ];
        let (passed, excluded) = filter_windows(windows, &filters);
        assert_eq!(excluded.len(), 2);
        assert_eq!(passed.len(), 1);
        assert_eq!(passed[0].owner_name, "C");
    }

    #[test]
    fn 真偽値フィルタは数値の0と非0で判定される() {
        // Swift 原本デフォルトの「オフスクリーンウィンドウを除外」（main.swift:340-342）:
        // kCGWindowIsOnscreen は数値 0/1 で来るため NSNumber.boolValue 相当で比較
        let filters = [group(
            "オフスクリーンを除外",
            vec![rule("kCGWindowIsOnscreen", FilterValue::Bool(false))],
        )];
        let mut offscreen = window("A", Some("a"));
        offscreen.is_onscreen = Some(0);
        let mut onscreen = window("B", Some("b"));
        onscreen.is_onscreen = Some(1);
        let mut missing = window("C", Some("c"));
        missing.is_onscreen = None; // キー欠落は不一致 → 通過

        let (passed, excluded) = filter_windows(vec![offscreen, onscreen, missing], &filters);
        assert_eq!(excluded.len(), 1);
        assert_eq!(excluded[0].owner_name, "A");
        assert_eq!(passed.len(), 2);
    }

    #[test]
    fn サイズフィルタで小さいウィンドウは常に除外される() {
        // main.swift:397-405（フィルタ設定に関係なく、幅/高さの整数部 40 未満は除外）
        let mut small_h = window("A", Some("a"));
        small_h.bounds.height = 39.9; // intValue 相当で 39 < 40 → 除外
        let mut small_w = window("B", Some("b"));
        small_w.bounds.width = 10.0;
        let mut border = window("C", Some("c"));
        border.bounds.height = 40.0; // 40 は除外されない

        let (passed, excluded) = filter_windows(vec![small_h, small_w, border], &[]);
        assert_eq!(excluded.len(), 2);
        assert_eq!(passed.len(), 1);
        assert_eq!(passed[0].owner_name, "C");
    }

    #[test]
    fn 存在しないプロパティやネストプロパティは不一致() {
        // TS 型 NumberFilter の X/Width 等は Swift 原本でもトップレベルキーでないため無効
        let filters = [
            group("X指定", vec![rule("X", FilterValue::Int(0))]),
            group("Width指定", vec![rule("Width", FilterValue::Int(800))]),
            group(
                "bounds指定",
                vec![rule("kCGWindowBounds", FilterValue::Str("x".into()))],
            ),
        ];
        let (passed, excluded) = filter_windows(vec![window("A", Some("a"))], &filters);
        assert_eq!(excluded.len(), 0);
        assert_eq!(passed.len(), 1);
    }

    #[test]
    fn tsのjson形式をデシリアライズできる() {
        // src/renderer/src/types.ts の LabeledFilters[] と同じ形
        let json = r#"[
            {
                "label": "空のFinderウィンドウを除外",
                "filters": [
                    { "property": "kCGWindowOwnerName", "is": "Finder" },
                    { "property": "kCGWindowName", "is": "" }
                ]
            },
            { "label": "オフスクリーン", "filters": [{ "property": "kCGWindowIsOnscreen", "is": false }] },
            { "label": "番号", "filters": [{ "property": "kCGWindowNumber", "is": 118 }] },
            { "label": "小数", "filters": [{ "property": "kCGWindowMemoryUsage", "is": 1264.0 }] }
        ]"#;
        let filters: Vec<LabeledFilters> = serde_json::from_str(json).expect("should deserialize");
        assert_eq!(filters.len(), 4);
        assert_eq!(filters[0].filters[0].is, FilterValue::Str("Finder".into()));
        assert_eq!(filters[1].filters[0].is, FilterValue::Bool(false));
        assert_eq!(filters[2].filters[0].is, FilterValue::Int(118));
        // 1264.0 は JSON 上は小数表記 → Float で受ける
        assert_eq!(filters[3].filters[0].is, FilterValue::Float(1264.0));

        // デシリアライズしたフィルタが実際に機能する
        let (passed, excluded) = filter_windows(
            vec![window("Finder", Some("")), window("TextEdit", Some("x"))],
            &filters,
        );
        // Finder は AND グループで除外、TextEdit は memory_usage=1264 が Float(1264.0) と一致して除外
        assert_eq!(excluded.len(), 2);
        assert_eq!(passed.len(), 0);
    }
}
