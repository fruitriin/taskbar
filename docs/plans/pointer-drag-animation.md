# Plan: タスクバー D&D の Pointer Events 化と「滑って避ける」アニメーション

**実装状況**: 実装済み（2026-07-05。実機確認項目の消化が残）
**作成日**: 2026-07-05
**前提計画**: [app-window-grouping.md](app-window-grouping.md)（実装済み）

## 目的

タスクバーのアプリグループ並び替え D&D を、vue.draggable.next の transition デモのような
「ドラッグ中に他アイテムがリアルタイムに滑って場所を空ける」体験にする。

参考実装: fruitriin/misskey の MkDraggable（Pointer Events 化コミット
https://github.com/fruitriin/misskey/commit/3dfe8185447525b4e4b112adc4cdf8d5844721e1 ）

## 決定事項（2026-07-05 オーナー決定）

1. **クロスディスプレイ D&D は廃止する**。将来の復活も予定しない
   - 根拠: 各ディスプレイのタスクバーには、そのディスプレイに見えているウィンドウしか
     表示されない想定のため、ディスプレイをまたいで並び替える動機が発生しない
   - 既存の dataTransfer ベースのクロスウィンドウ対応コードは撤去する
2. **HTML5 Drag and Drop API を捨て、Pointer Events に統一する**
   - ドラッグ開始のネイティブ D&D との衝突を避けるため併存はしない
3. **MkDraggable はエッセンス移植とし、コードのコピーはしない**
   - 元ファイルが misskey（AGPL-3.0）配下のため、taskbar 向けに書き直す
   - Pointer Events 実装部の設計（下記）を参考にする
4. **flat な grid レイアウトは維持**し、コンポーネント化（グループのネスト構造化）はしない
   - 並び替え単位はアプリグループ。ヒットしたボタンのアプリ名をターゲットに
     既存純関数 `moveApp` / `buildAppOrder` を流用する

## MkDraggable から移植するエッセンス

| 要素 | 内容 |
|---|---|
| ドラッグ開始 | pointerdown（`button === 0` のみ）→ 8px 移動で開始（MOVE_THRESHOLD_PX = 8） |
| リアルタイム避け | pointermove 中にローカルの並び順 ref へ `moveApp` を随時適用 → TransitionGroup FLIP（`.flip-list-move`）が滑りを演出 |
| 振動対策 | 入れ替えクールダウン（REORDER_COOLDOWN_MS = 150）＋ ゴーストとターゲットの重なり率しきい値（OVERLAP_RATIO = 0.3、進行方向認識） |
| ゴースト | Vue 管理（`position: fixed` + transform 追従、元グループは `opacity: 0.4`）。elementFromPoint 時はゴーストを一時 `display: none` |
| リスナー | document で pointermove / pointerup / pointercancel / visibilitychange を監視し、cleanup を一元化 |
| 確定 | pointerup で `setOptions`（appOrder 永続化）。キャンセル時は元の並びへ FLIP で戻る |

## taskbar 固有の適応（MkDraggable に無いもの / 削るもの）

- **足す**: ドラッグ中は Helper からの `process` 更新の反映を保留し、dragend で flush する
  ガード（並びの土台がドラッグ中に動くと崩れるため。必須）
- **削る**: auto-scroll（タスクバーはスクロールしない）、タッチ長押し・contextmenu
  suppressor（マウス前提）、インスタンス間 dropHandlers レジストリ（リストは1つ）、
  forward/backward ドロップエリア（同一リスト内のリアルタイム入れ替えのみで完結）
- **共存**: 右クリックメニュー（`contextTask`）は `button !== 0` ガードで従来どおり動作させる

## 実装ステップ

1. 既存 HTML5 D&D コード（draggable 属性、dragstart/dragover/drop/dragend、dataTransfer）を撤去
2. Pointer Events ドラッグセッション実装（pending → threshold → dragActive → cleanup の状態機械）
3. ドラッグ中並び順のローカル ref ＋ `moveApp` 随時適用＋クールダウン/重なり率判定
4. `<TransitionGroup>` ラップと `.flip-list-move` CSS、ゴースト表示、元グループの減光
5. process 更新保留ガード
6. 純関数として切り出せる判定ロジック（重なり率・入れ替え可否）に bun test を追加
7. 品質ゲート（Stage 1 → Stage 2）、実機確認（下記）

## 実機確認項目

- [x] ドラッグ中に他グループが滑って避ける（左右両方向）— 2026-07-05 オーナー確認済み。
  体感調整: duration 0.15s（クールダウンと同値で完走保証）＋ cubic-bezier(0.2, 0, 0, 1)
- [ ] 離した位置で確定し、再起動後も並びが保持される（appOrder 永続化）
- [ ] タスクバー外で離す・ESC 相当（pointercancel）で元の並びへアニメーションで戻る
- [ ] ドラッグ中にウィンドウの増減が起きても崩れない（保留ガード）
- [ ] 右クリックメニューが従来どおり動く
- [ ] left / right レイアウト（縦方向）でも避け方向が正しい

## 未決事項

- ドラッグ開始をつまみ持ち（即時）にするか 8px 閾値にするか → 初版は 8px 閾値（クリックとの共存優先）
- ゴーストの見た目（グループ全体を掴むか、掴んだボタン1個か）→ 初版は掴んだボタン1個（実装が軽く、視覚的にも十分）

## レビューからの残課題（先送り分）

- 状態機械のコンポーネントテスト → 独立計画 [drag-state-machine-tests.md](drag-state-machine-tests.md)
- setOptions → updateOptions echo の理論的競合（連続ドラッグ時に古い並びの echo が後着しうる。
  リクエストにバージョンが無いため。既存パターン由来で実害は未観測。将来 appOrder に
  リビジョンを持たせる等を検討）
- onPointerMove 内の elementFromPoint / getBoundingClientRect の rAF 間引き（優先度低）
