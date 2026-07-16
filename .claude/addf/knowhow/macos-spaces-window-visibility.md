---
title: macOS Spaces（仮想デスクトップ）とTauriウィンドウの全デスクトップ表示・ネイティブ実測プローブ
created: 2026-07-16
last_verified: 2026-07-16
depends_on: []
status: active
---

# macOS Spaces（仮想デスクトップ）とTauriウィンドウの全デスクトップ表示・ネイティブ実測プローブ

## 発見した知見

### 1. Tauri ウィンドウを全 Space に表示するにはアプリ側で明示する

- `WebviewWindowBuilder::visible_on_all_workspaces(true)`（tauri 2.11.x）が正解。
  tao 側（0.35.3）の実装は `NSWindowCollectionBehavior::CanJoinAllSpaces` ビットを
  立て下ろしするだけの素直なもの
- **Mac 側の Dock 割り当て（オプション → 割り当て先 → すべてのデスクトップ）は
  Tauri の枠なし・floating レベルのウィンドウには効かない**。診断は
  `defaults read com.apple.spaces app-bindings` — taskbar.fm の割り当ては
  `":no-bundle:????" = AllSpaces` と記録され、バンドル ID に紐付いていなかった
  （正常な例: `"com.google.chrome" = AllSpaces`）。Dock がウィンドウの所属アプリを
  解決できない場合、ユーザーが割り当てても無効になる
- `canJoinAllSpaces` は**フルスクリーン Space には表示されない**。表示したければ
  `fullScreenAuxiliary` が別途必要（Tauri の builder には無く、`ns_window()` から
  objc2 で直接 collectionBehavior を触る必要がある）。taskbar.fm では
  「フルスクリーン中は隠れる」がオーナー判断で仕様
- builder 指定は新規生成時のみ適用されるが、NSWindow はアプリ再起動をまたいで
  復元されないため、生成関数に書けば漏れは生じない（`set_position`/`set_size` は
  collectionBehavior に触れないので後から属性が失われることもない）

### 2. Space 切替の挙動はネイティブプローブで機械検証できる（体感に頼らない）

ウィンドウが「今の Space で見えているか」は CGWindowList で機械判定できる:

- **判定**: Swift スクリプト（`swift probe.swift` で直接実行可、コンパイル不要）で
  `CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)`
  を叩き、`kCGWindowOwnerName` の部分一致でターゲットの有無を出力する。
  owner 名はスクリーン収録権限なしで取れる（ウィンドウタイトルは権限が要る）
- **Space 切替の自動再現**: `osascript -e 'tell application "System Events" to key code 124 using control down'`
  （Ctrl+→。123 で戻る）。切替アニメーションを待つため `sleep 2` を挟む
- **A/B 検証パターン**: 修正前バイナリ（インストール済み）でバグ再現 →
  修正版 dev ビルドで解消、を同一プローブで確認すると証拠力が高い
- **対照群を設計する**: 「Space 固有のウィンドウ（VSCode 等）が消えたこと」で
  切替が本当に起きたことを、「Mac 側 AllSpaces 割り当てが有効なアプリ（Chrome 等）が
  残ったこと」で判定機構の妥当性を、同じ出力から確認できる
- **注意**: dev ビルドの owner 名は productName ではなく Cargo の bin 名（taskbar.fm では
  `app`）になる。オーナーの作業中デスクトップを実際に切り替えるため、
  切替→判定→復帰を1シーケンスで素早く行い、検証後は環境を復元する
  （終了させたアプリの再起動まで含めて）

プローブ本体（~30行）はセッションの scratchpad に書き捨てで十分。骨格は
Plan `.claude/addf/plans/spaces-all-desktops-visibility.md` の検証記録を参照。

## 関連

- [cdp-headless-e2e-probe.md](cdp-headless-e2e-probe.md) — 同じ「主観フィードバックを
  実測に置き換える」系譜の Web レンダラー側プローブ。本記事はそのネイティブ
  （WindowServer）側の対
- [multi-display-renderer-state.md](multi-display-renderer-state.md) — タスクバー
  ウィンドウの生成・再構成まわりの既存知見
