# Plan: 仮想デスクトップ（Spaces）切替時にタスクバーが2枚目以降に表示されない問題の調査と修正

## 実装状況: 実装完了・オーナー実機確認待ち（2026-07-16）

> 出典: オーナー報告（2026-07-16）。仮想デスクトップを切り替えると、Mac 側オプション
> （Dock アイコン右クリック → オプション → 割り当て先 → すべてのデスクトップ）を
> 選択していても、2枚目以降のデスクトップにタスクバーが表示されない

## 目的

仮想デスクトップ（Mission Control の Space）をいくつ切り替えても、
タスクバーが常に表示されている状態にする。Windows のタスクバーと同じく、
**Mac 側の Dock 割り当てに依存せず、アプリ自身が全 Space 表示を保証する**。

## 現状の挙動

- タスクバーウィンドウは Space 1（生成時にアクティブだった Space）にのみ表示され、
  Ctrl+→ 等で Space を切り替えると消える
- Mac 側の「割り当て先 > すべてのデスクトップ」を選択しても効果がない（オーナー確認済み）

### コード調査で判明している事実（2026-07-16 調査）

- `create_taskbar_window`（src-tauri/src/display_manager.rs:182-203）は
  `visible_on_all_workspaces` を**指定していない** → `NSWindowCollectionBehavior.canJoinAllSpaces` が立っていない
- Tauri v2.11.5 には `WebviewWindowBuilder::visible_on_all_workspaces(bool)` が存在する。
  tao-0.35.3 の実装は collectionBehavior に `CanJoinAllSpaces` ビットを立て下ろしするだけの素直なもの
- Electron 旧実装（tag `v2-electron-final` の src/main/funcs/windows.ts）にも
  `setVisibleOnAllWorkspaces` は無かった。旧版で全デスクトップ表示できていたなら
  Mac 側 Dock 割り当てが効いていたことになる（Tauri 版で効かなくなった差分が争点）

## 仮説（確度順）

### H1（本命）: アプリが canJoinAllSpaces を立てておらず、Mac 側 Dock 割り当ても Tauri ウィンドウには効いていない

Dock の「すべてのデスクトップ」割り当てが効かない理由の候補:

- **H1a**: `always_on_top(true)` により NSFloatingWindowLevel 相当となったウィンドウは、
  Dock / WindowServer の Space 割り当て（通常のドキュメントウィンドウ向け機構）の適用外になる
- **H1b**: `decorations(false)` + `skip_taskbar` 等の補助ウィンドウ的属性により
  Mission Control の管理対象外と判定され、割り当てが適用されない
- H1a/H1b の切り分けまでは必須ではない（対処は同じ）。**対処**: アプリ側で
  `.visible_on_all_workspaces(true)` を指定すれば Mac 側オプションに依存せず解決する

### H2: Space 切替時にスクリーン構成変更通知が誤発火し、sync_taskbar_windows が状態を壊している

- `NSApplicationDidChangeScreenParametersNotification`（display_manager.rs:272-309）が
  Space 切替でも発火し、再配置・destroy/再生成で表示が乱れる可能性
- 確度は低い（発火しても同一モニタ構成なら位置再設定のみで無害なはず）が、
  H1 修正後も症状が残る場合の第二容疑者

### H3: フルスクリーンアプリの Space に限って見えない

- `canJoinAllSpaces` はフルスクリーン Space には表示されない
  （表示するには `fullScreenAuxiliary` が別途必要）
- オーナーの言う「2枚目以降のデスクトップ」が通常デスクトップなら本件とは別問題だが、
  実機確認時に切り分けておく（対応するかはオーナー判断 → 要オーナー確認）

## 検証方法

### 修正前の診断（任意・軽量）

1. **Mac 側割り当ての記録確認**: `defaults read com.apple.spaces app-bindings` に
   `space.riinswork.taskbar` が記録されているか（記録されているのに効かない → H1a/H1b 裏付け）
   → **実施結果（2026-07-16）**: `":no-bundle:????" = AllSpaces` — 割り当ては記録されたが
   バンドル ID に紐付いていない（Chrome は `com.google.chrome` = AllSpaces と正しく記録）。
   Dock がタスクバーウィンドウの所属アプリを解決できておらず、H1 を裏付け
2. **collectionBehavior の実測**: 一時的な診断コード（`window.ns_window()` から
   objc2 で `collectionBehavior` を読んでログ出力）で、起動直後・Dock 割り当て後の値を確認

### 修正の実装と客観的検証

3. `create_taskbar_window` に `.visible_on_all_workspaces(true)` を追加して `bun run dev`
4. **Space 切替の自動再現＋on-screen 判定**（体感に頼らない実測。
   knowhow「主観フィードバックが収束しないときは早めに実測へ」の教訓を先取り）:
   - Space 切替: `osascript -e 'tell application "System Events" to key code 124 using control down'`
     （Ctrl+→。dev 機はアクセシビリティ許可済みの前提）
   - 判定: `CGWindowListCopyWindowInfo(optionOnScreenOnly)` を叩く小スクリプト
     （Swift ワンライナー or 本体の window_manager と同等の Rust 例）で、切替後に
     taskbar.fm のウィンドウが on-screen リストに残っているかを機械判定
5. **オーナー実機確認**（複数往復前提）: 通常デスクトップ2以降での表示 / マルチモニタ併用時 /
   フルスクリーン Space の挙動（H3 の切り分け）

## 変更内容（見込み）

### 項目1: タスクバーウィンドウの全 Space 表示

- **対象**: `src-tauri/src/display_manager.rs` の `create_taskbar_window`
- `.visible_on_all_workspaces(true)` を追加（数行の変更）

### 項目2（クローズ — オーナー回答 2026-07-16）

- ~~`fullScreenAuxiliary`（フルスクリーン Space でも表示）や `stationary` の追加検討~~
- オーナー回答: **「フルスクリーン中は隠すでよい」** → 項目2は実施しない

## 影響範囲

- タスクバーウィンドウ（taskbar-*）のみ。option / menu / fullWindowList ウィンドウは対象外
- Mac 側 Dock 割り当てとの併用でも競合しない（同じ collectionBehavior ビットを立てるだけ）

## テスト方針

- OS の Space 挙動そのものはユニットテスト不能。検証方法 4 の機械判定＋オーナー実機確認で担保
- 既存の品質ゲート（cargo check / clippy / test / fmt、bun run lint / typecheck / test / build）を全通し

## 破壊的変更の許容範囲

なし（表示挙動の修正のみ）

## 要オーナー確認

- ~~フルスクリーン Space でもタスクバーを表示したいか（H3 / 項目2 の採否）~~
  → **回答済み（2026-07-16）: フルスクリーン中は隠すでよい**（fullScreenAuxiliary 非対応で確定）

## 完了条件

- [x] `.visible_on_all_workspaces(true)` 適用後、Space 切替の自動再現＋CGWindowList 判定で
      タスクバーが on-screen に残ることを機械確認
      （2026-07-16 実施。A/B 検証: 修正前のインストール済み v3.0.0 は Space 2 で
      TARGET_NOT_ONSCREEN、修正版 dev は TARGET_ONSCREEN・同座標。対照群として
      Space 固有ウィンドウの消失と Chrome（Mac 側 AllSpaces 割り当て有効）の残存も確認）
- [x] 品質ゲート全通過（lint / typecheck / test / build、cargo check / clippy / test / fmt --check）
- [ ] オーナー実機確認: 通常デスクトップ2以降でタスクバーが表示される <!-- human-judgment -->
- [x] フルスクリーン Space の扱いについてオーナーの採否判断を得る（回答: 隠すでよい） <!-- human-judgment -->

## AI 実装時間見積もり

修正自体は数行のため1セッション以内。実機確認往復（Space 切替検証）を含めても1〜2セッション
