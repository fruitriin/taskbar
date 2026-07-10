//! ウィンドウリスト取得（CGWindowListCopyWindowInfo のラッパー）
//!
//! Swift 原本: nativeSrc/taskbar.helper/main.swift:798-871
//! （windowListProvider / getWindowInfoListData の移植）
//!
//! CF パース手段の選定メモ:
//! - objc2-core-graphics 0.3 の CGWindowListCopyWindowInfo は
//!   objc2-core-foundation の CFRetained<CFArray> を返すため、
//!   同エコシステムの objc2-core-foundation 0.3 でパースする
//!   （core-foundation crate を混ぜると生ポインタのキャストが必要になり
//!   かえって煩雑になるため不採用）。
//! - unsafe 境界を最小にするため、CFDictionary はいったん serde_json::Value に
//!   変換し、Value → MacWindow の変換は純関数 parse_window_info() として
//!   切り出してユニットテスト可能にしている。

use std::time::Duration;

use objc2_core_foundation::{CFBoolean, CFDictionary, CFNumber, CFRetained, CFString, CFType};
use objc2_core_graphics::{kCGNullWindowID, CGWindowListCopyWindowInfo, CGWindowListOption};
use serde::Serialize;
use serde_json::Value;

/// kCGWindowBounds の中身。フロントの TS 型（src/main/type.d.ts）と
/// キー名を完全一致させる（X / Y / Width / Height）
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct WindowBounds {
    #[serde(rename = "X")]
    pub x: f64,
    #[serde(rename = "Y")]
    pub y: f64,
    #[serde(rename = "Width")]
    pub width: f64,
    #[serde(rename = "Height")]
    pub height: f64,
}

/// CGWindowListCopyWindowInfo の1エントリ。
/// フィールド名はフロントの TS 型 MacWindow（src/main/type.d.ts）と完全一致
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct MacWindow {
    #[serde(rename = "kCGWindowLayer")]
    pub layer: i64,
    #[serde(rename = "kCGWindowName", skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(rename = "kCGWindowMemoryUsage")]
    pub memory_usage: i64,
    #[serde(
        rename = "kCGWindowIsOnscreen",
        skip_serializing_if = "Option::is_none"
    )]
    pub is_onscreen: Option<i64>,
    #[serde(rename = "kCGWindowSharingState")]
    pub sharing_state: i64,
    #[serde(rename = "kCGWindowOwnerPID")]
    pub owner_pid: i64,
    #[serde(rename = "kCGWindowOwnerName")]
    pub owner_name: String,
    #[serde(rename = "kCGWindowNumber")]
    pub window_number: i64,
    #[serde(rename = "kCGWindowStoreType", skip_serializing_if = "Option::is_none")]
    pub store_type: Option<i64>,
    #[serde(rename = "kCGWindowBounds")]
    pub bounds: WindowBounds,
    /// 現段階では常に空文字（アイコン取得は 3.3 icon_manager.rs で実装予定）
    #[serde(rename = "appIcon")]
    pub app_icon: String,
}

/// オンスクリーンのウィンドウ一覧を取得する。
///
/// Swift 原本: main.swift:804-843（windowListProvider）
/// UE 対策の移植: Swift 版は WatchdogTimer(5.0s) だったが、Rust 版では
/// spawn_blocking + tokio::time::timeout(5秒) で包む。
/// タイムアウト時は blocking スレッドが残る（WindowServer とのカーネルレベルの
/// ブロックは中断できない）が、呼び出し側にはエラーを即時返却する。
pub async fn get_window_list() -> Result<Vec<MacWindow>, String> {
    tokio::time::timeout(
        Duration::from_secs(5),
        tokio::task::spawn_blocking(fetch_window_list_blocking),
    )
    .await
    .map_err(|_| "CGWindowListCopyWindowInfo timed out (5s)".to_string())?
    .map_err(|e| format!("Thread error: {e}"))?
}

/// ブロッキング呼び出し本体。spawn_blocking 内で実行される。
fn fetch_window_list_blocking() -> Result<Vec<MacWindow>, String> {
    // Swift 原本: main.swift:838 は .optionAll だが、計画書 3.2 の指定どおり
    // OnScreenOnly | ExcludeDesktopElements を使う（Swift 側では後段の
    // filterWindows がデスクトップ要素等を除外していたため実質同等）
    let options =
        CGWindowListOption::OptionOnScreenOnly | CGWindowListOption::ExcludeDesktopElements;
    let array = CGWindowListCopyWindowInfo(options, kCGNullWindowID)
        .ok_or_else(|| "CGWindowListCopyWindowInfo returned NULL".to_string())?;

    // SAFETY: CGWindowListCopyWindowInfo は「CFDictionary の CFArray」を返すと
    // API 契約で保証されている（Apple ドキュメント参照）
    let array: CFRetained<objc2_core_foundation::CFArray<CFDictionary>> =
        unsafe { CFRetained::cast_unchecked(array) };

    let windows = array
        .iter()
        .filter_map(|dict| {
            let value = cf_dictionary_to_json(&dict);
            // 必須キー（kCGWindowOwnerName 等）が無いエントリはスキップ
            parse_window_info(&value)
        })
        .collect();

    Ok(windows)
}

/// CFDictionary → serde_json::Value（Object）への変換。
/// unsafe 境界はここまでで、以降のパースは純関数で行う。
fn cf_dictionary_to_json(dict: &CFDictionary) -> Value {
    // SAFETY: CGWindowListCopyWindowInfo が返すディクショナリのキーは
    // すべて CFString（kCGWindow* 定数）。値は任意の CF 型なので CFType で受ける
    let dict: &CFDictionary<CFString, CFType> = unsafe { dict.cast_unchecked() };
    let (keys, values) = dict.to_vecs();

    let map = keys
        .iter()
        .zip(values.iter())
        .filter_map(|(key, value)| Some((key.to_string(), cf_value_to_json(value)?)))
        .collect();

    Value::Object(map)
}

/// CF 型の値を JSON 値へ変換する。未対応の型（CFData 等）は None（キーごと除外）
fn cf_value_to_json(value: &CFType) -> Option<Value> {
    if let Some(number) = value.downcast_ref::<CFNumber>() {
        // kCGWindowBounds 内の座標は倍精度、それ以外は整数として格納されている
        return if number.is_float_type() {
            number.as_f64().map(Value::from)
        } else {
            number.as_i64().map(Value::from)
        };
    }
    if let Some(string) = value.downcast_ref::<CFString>() {
        return Some(Value::from(string.to_string()));
    }
    if let Some(boolean) = value.downcast_ref::<CFBoolean>() {
        // kCGWindowIsOnscreen は CFBoolean。TS 型では number なので 0/1 に変換
        // （Swift 版では NSNumber 経由で 0/1 になっていた挙動に合わせる）
        return Some(Value::from(i64::from(boolean.as_bool())));
    }
    if let Some(inner) = value.downcast_ref::<CFDictionary>() {
        // kCGWindowBounds がネストした CFDictionary で来る
        return Some(cf_dictionary_to_json(inner));
    }
    None
}

/// JSON Object → MacWindow への変換（純関数・ユニットテスト対象）。
///
/// Swift 原本ではディクショナリをそのまま JSONSerialization に渡していたが
/// （main.swift:846-871 getWindowInfoListData）、Rust 版では型付き構造体へ
/// 変換する。必須キーが欠けているエントリは None を返してスキップする
/// （例: kCGWindowOwnerName が無いウィンドウは "不明" 等で埋めずに除外）。
fn parse_window_info(value: &Value) -> Option<MacWindow> {
    let bounds = value.get("kCGWindowBounds")?;
    Some(MacWindow {
        layer: value.get("kCGWindowLayer")?.as_i64()?,
        name: value
            .get("kCGWindowName")
            .and_then(Value::as_str)
            .map(String::from),
        memory_usage: value.get("kCGWindowMemoryUsage")?.as_i64()?,
        is_onscreen: value.get("kCGWindowIsOnscreen").and_then(Value::as_i64),
        sharing_state: value.get("kCGWindowSharingState")?.as_i64()?,
        owner_pid: value.get("kCGWindowOwnerPID")?.as_i64()?,
        owner_name: value.get("kCGWindowOwnerName")?.as_str()?.to_string(),
        window_number: value.get("kCGWindowNumber")?.as_i64()?,
        store_type: value.get("kCGWindowStoreType").and_then(Value::as_i64),
        bounds: WindowBounds {
            // 整数で来ても f64 として受ける（as_f64 は整数値も変換できる）
            x: bounds.get("X")?.as_f64()?,
            y: bounds.get("Y")?.as_f64()?,
            width: bounds.get("Width")?.as_f64()?,
            height: bounds.get("Height")?.as_f64()?,
        },
        app_icon: String::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// 全キーが揃ったエントリのフィクスチャ
    fn full_window_json() -> Value {
        json!({
            "kCGWindowLayer": 0,
            "kCGWindowName": "無題",
            "kCGWindowMemoryUsage": 1264,
            "kCGWindowIsOnscreen": 1,
            "kCGWindowSharingState": 1,
            "kCGWindowOwnerPID": 4242,
            "kCGWindowOwnerName": "TextEdit",
            "kCGWindowNumber": 118,
            "kCGWindowStoreType": 1,
            "kCGWindowBounds": { "X": 100, "Y": 50.5, "Width": 800.0, "Height": 600 }
        })
    }

    #[test]
    fn 全キーが揃ったエントリを変換できる() {
        let window = parse_window_info(&full_window_json()).expect("should parse");
        assert_eq!(window.layer, 0);
        assert_eq!(window.name.as_deref(), Some("無題"));
        assert_eq!(window.owner_name, "TextEdit");
        assert_eq!(window.owner_pid, 4242);
        assert_eq!(window.window_number, 118);
        assert_eq!(window.is_onscreen, Some(1));
        assert_eq!(window.store_type, Some(1));
        // 整数で来た座標も f64 として読める
        assert_eq!(window.bounds.x, 100.0);
        assert_eq!(window.bounds.y, 50.5);
        assert_eq!(window.app_icon, "");
    }

    #[test]
    fn 必須キー欠落時はスキップされる() {
        // kCGWindowOwnerName 欠落 → None（"不明" 等で埋めない）
        let mut value = full_window_json();
        value.as_object_mut().unwrap().remove("kCGWindowOwnerName");
        assert!(parse_window_info(&value).is_none());

        // kCGWindowBounds 欠落 → None
        let mut value = full_window_json();
        value.as_object_mut().unwrap().remove("kCGWindowBounds");
        assert!(parse_window_info(&value).is_none());

        // オプショナルキー（name / isOnscreen / storeType）欠落 → None にならない
        let mut value = full_window_json();
        let obj = value.as_object_mut().unwrap();
        obj.remove("kCGWindowName");
        obj.remove("kCGWindowIsOnscreen");
        obj.remove("kCGWindowStoreType");
        let window = parse_window_info(&value).expect("optional keys may be absent");
        assert_eq!(window.name, None);
        assert_eq!(window.is_onscreen, None);
        assert_eq!(window.store_type, None);
    }

    /// 実機での疎通確認用（WindowServer にアクセスするため CI では不安定になり得る。
    /// `cargo test -- --ignored` で手動実行する）
    #[test]
    #[ignore = "実際の WindowServer にアクセスするため手動実行"]
    fn 実機でウィンドウリストを取得できる() {
        let windows = fetch_window_list_blocking().expect("should fetch");
        assert!(!windows.is_empty(), "オンスクリーンのウィンドウが1つも無い");
    }

    #[test]
    fn シリアライズ時のキー名がフロントのts型と一致する() {
        let window = parse_window_info(&full_window_json()).unwrap();
        let serialized = serde_json::to_value(&window).unwrap();
        // src/main/type.d.ts の MacWindow と同じキー名で出力されること
        assert_eq!(serialized["kCGWindowOwnerName"], "TextEdit");
        assert_eq!(serialized["kCGWindowBounds"]["Width"], 800.0);
        assert_eq!(serialized["appIcon"], "");

        // オプショナルキーは None のとき出力されない（TS の `?:` に対応）
        let mut value = full_window_json();
        value.as_object_mut().unwrap().remove("kCGWindowName");
        let window = parse_window_info(&value).unwrap();
        let serialized = serde_json::to_value(&window).unwrap();
        assert!(serialized.get("kCGWindowName").is_none());
    }
}
