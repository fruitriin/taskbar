# Plan: アプリグループの D&D 高速交互入れ替え（フリッカー）修正

## 実装状況: 実装完了・bottomレイアウトは実機確認済み（left/right実機確認は未実施）

> 出典: オーナー報告「タスクが複数ウィンドウでグルーピングされているときに、その上をドラッグで並び替えようとすると高速で交互に入れ替わってしまう」（2026-07-15）。Explore エージェントによる調査（drag-session.ts / utils.ts / index.vue 読解）で原因を特定。

## 関連 Plan

- [app-window-grouping.md](app-window-grouping.md) — アプリグルーピング機能の初版計画。「グループ内ウィンドウ単位の D&D は初版スコープ外、アプリ単位ロジックをそのまま流用」と明記した張本人。本計画はその流用が引き起こした副作用を修正する
- [pointer-drag-animation.md](pointer-drag-animation.md) — D&D 本体の実装計画。「onPointerMove 内の elementFromPoint/getBoundingClientRect の rAF 間引き（優先度低）」を先送りにしたレビュー残課題があり、本計画で合わせて解消する

## 目的

同一アプリの複数ウィンドウがグループ化されているとき、そのグループをドラッグで並び替えようとすると高速に交互スワップしてしまう不具合を修正する。あわせて、以前見送られていた pointermove の rAF 間引きも解消する。

## 現状の挙動

`shouldSwap()`（`src-renderer/src/utils.ts`）には振動対策として2段のヒステリシス（150ms クールダウン＋進行方向側 30% 食い込み判定）が実装済みだが、それでも今回の不具合が起きる。原因は**判定の単位と幾何情報取得の単位がズレている**ことにある:

- 並び替えの管理単位（`order` 配列 = `buildAppOrder`）は「アプリ名1つにつき1エントリ」。グループが3ウィンドウでも配列上は1個
- 一方 DOM 側は `centerWindows`（グルーピング済みの**フラットな**配列）を `v-for` でそのまま個別の `<button data-app="...">` として並べているだけで、グループ全体をまとめるラッパー要素が存在しない（`index.vue` 22-64行目）
- ドラッグ中の当たり判定 `hitTest`（`index.vue` 216-225行目）は `elementFromPoint().closest('button[data-app]')` で**カーソル直下にたまたまあった1個のサブボタン**の矩形を返す
- `shouldSwap` の閾値 `threshold = min(ghostRect, targetRect) * 0.3` の `targetRect` が「グループ全体の見た目の幅」ではなく「グループ内の1ウィンドウ分の狭い幅」になり、閾値が実態より小さくなりすぎて過敏に反転する

加えて `onPointerMove`（`index.vue` 311-318行目）は rAF 間引きなしで毎イベント同期的に `hitTest`（`elementFromPoint` + `getBoundingClientRect`）を呼んでおり、過渡的な（アニメーション中の）矩形を高頻度に読み取ってしまう点も振動を増幅させていると考えられる。

## 変更内容（項目・フェーズ）

### フェーズ1: テンプレート構造の変更（グループを wrapper div でまとめる）

- **対象**: `src-renderer/src/pages/index.vue`（テンプレート・`<style>`）、`src-renderer/src/utils.ts`（`groupWindowsByApp` の戻り値）
- `centerWindows` を「フラットな `MacWindow[]`」から「グループ単位の構造（例: `{ app: string; windows: MacWindow[] }[]`）」に変更する
- テンプレート側は `TransitionGroup` の `v-for` をグループ単位に変更し、各グループを1つの `<div class="task-group" :data-app="...">` でラップする。グループ内の複数ウィンドウは、その wrapper 内側で（レイアウト方向に応じて）横並び/縦並びに描画する
- 単一ウィンドウのアプリも同じ wrapper 構造で統一する（グループの有無で描画ロジックを分岐させない。分岐させると「単一→複数に増えた瞬間」「複数→単一に減った瞬間」に別コードパスへ切り替わり、そこでまた不整合が起きるリスクがあるため）
- **レイアウト3方向（bottom=grid横並び／left・right=flex縦並び）それぞれで wrapper 導入後の見た目が崩れないことを確認する**（過去に一度この方向で試みてレイアウト崩れにより見送った経緯があるため、最優先の検証ポイント）。現在は Vue3 Composition API + UnoCSS へのリアーキ（Phase 1〜3）が完了しており、以前とはレンダリング構造・スタイル基盤が変わっているため再挑戦する
- `headerWindows`/`footerWindows` は今回グルーピング対象外（既存どおりフラット表示のまま）。`centerWindows` のみ変更する

### フェーズ2: hitTest とドラッグ判定をグループ単位に揃える

- **対象**: `src-renderer/src/pages/index.vue`（`hitTest`）
- `hitTest` の `closest()` 対象を `button[data-app]` から `.task-group[data-app]`（wrapper 要素）に変更し、グループ全体の外接矩形を `targetRect` として返すようにする
- `shouldSwap`/`moveApp`（`utils.ts`）自体はアプリ単位のロジックのままで変更不要なはず（矩形の出所が正しくなることで解消される想定）。もし追加の考慮が必要であれば本フェーズで対応する

#### フェーズ2.5: 振動の追加対策（当初計画になかった、実機確認後の追加分）

- フェーズ2適用後もオーナー実機確認で「以前より遅くなったが依然として振動する」ことが判明
- 原因: 入れ替え直後、ゴーストが入れ替えた相手の近くに留まり続けると、クールダウン明けに同じ相手へ即座に逆方向の再入れ替えが成立してしまう（thrashing）
- 対策: `utils.ts` に `rectsSeparated(ghostRect, targetRect, horizontal)` を追加し、`drag-session.ts` に `blockedApp` 状態を追加。直前に入れ替えた相手とは、ゴーストの矩形が完全に離れる（重なりゼロ以下）までは再入れ替えを禁止する
- あわせて `REORDER_COOLDOWN_MS`（＝ `.flip-list-move` の transition duration）を 150ms → 220ms → 800ms に段階調整（オーナー実機確認で「アニメーションが早すぎる」との指摘）
- **コードレビュー指摘の追加修正**: 当初実装は `hit.app === app`（自分自身へのホバー）で `blockedApp` を無条件リセットしていたが、FLIP アニメーション中にドラッグ元の実要素が相手の旧位置へ滑り込む過程で一時的に自分自身へのホバーを経由することがあり、そこで誤って block が解除される欠陥があった。解除を `rectsSeparated` による確認経由のみに限定し、回帰テスト2本を追加して修正した

#### フェーズ2.6: 末尾ドロップ・スクロールバー対応（オーナー実機確認後の追加分）

- `hitTest` がタスクバー領域の外（縦にはみ出した・末尾を通り過ぎた等）へのオーバーシュートに対応していなかったため、進行軸の座標に基づいてどのグループの範囲に該当するか探し、該当なしなら先頭/末尾グループへフォールバックするよう拡張
- `.tasks` の `overflow-y: auto`（bottomレイアウトでも常に有効だった）が、FLIP の transform アニメーション中に一時的な描画範囲をコンテナの overflow 判定に含めてしまい、スワップ中だけスクロールバーが出る不具合があったため、bottomレイアウトでは `overflow: hidden` に変更（left/rightは元々の用途どおり `overflow-y: auto` を維持）

### フェーズ3: pointermove の rAF 間引き（**実装後に撤回**）

- **対象**: `src-renderer/src/pages/index.vue`（`onPointerMove`）
- 当初計画: `pointermove` イベント自体は今まで通り受けつつ、`session.pointerMove()` の実呼び出しを `requestAnimationFrame` で1フレームに1回へ間引く
- **撤回理由**（オーナー実機確認）: Vue の `TransitionGroup` が FLIP（並び替えアニメーション）内部で使う rAF ベースの measure/apply シーケンスと競合し、**ドラッグ中だけ**アニメーションが効かなくなる副作用が判明した（ドロップ後は正常に動く＝pointermove リスナー解除後は競合が消えるという症状と整合）。振動対策はフェーズ2（グループ矩形の統一）＋ shouldSwap の2段ヒステリシス＋後述の `blockedApp`（完全分離待ち）で十分だったため、rAF 間引きは撤回し同期呼び出しに戻した

### フェーズ4: テスト追加

- **対象**: `src-renderer/tests/window-sort.test.ts`、`src-renderer/tests/drag-session.test.ts`
- グループ（同一 `data-app` を持つ複数ウィンドウ）に対する `shouldSwap` の閾値判定ケースを追加（グループの外接矩形が正しく渡された場合に閾値が適切になることを検証）
- `hitTest` がグループ内のどのサブ要素にヒットしても wrapper の矩形が返ることを検証するケースを追加
- 可能であれば「連続した pointermove イベントに対して rAF 間引きにより判定呼び出しが1回に収束する」ことを検証するケースを追加（drag-session 側のモックで rAF をスタブ化）

## 影響範囲

- `src-renderer/src/pages/index.vue`（テンプレート・`<style>`・`hitTest`・`onPointerMove`）
- `src-renderer/src/utils.ts`（`groupWindowsByApp` の戻り値型）
- `src-renderer/src/drag-session.ts`（型シグネチャの調整が必要になる場合）
- `src-renderer/tests/window-sort.test.ts` / `drag-session.test.ts`
- ダウンストリーム配布への影響なし（アプリ本体のみの変更）

## テスト方針

- 単体テスト: フェーズ4のとおり `window-sort.test.ts` / `drag-session.test.ts` にケース追加
- 実機確認（`bun run dev` または `bun run dev:web` + Playwright MCP）:
  1. レイアウト3方向（bottom / left / right）それぞれで、グループの見た目（複数ウィンドウの配置・アイコン・ラベル）が崩れていないこと
  2. グループを跨いだドラッグ並び替えが1回の操作で1回だけ入れ替わり、高速な交互入れ替えが起きないこと（本バグの再現条件）
  3. 単一ウィンドウのアプリ同士の並び替えが従来どおり機能すること（回帰確認）
  4. グループの境界付近でカーソルを小刻みに動かしても入れ替わりが振動しないこと

## 破壊的変更の許容範囲

- `groupWindowsByApp` の戻り値の型変更は内部実装の変更であり、外部（Rust側・永続化オプション）に影響しない
- DOM構造の変更（wrapper div 導入）に伴う CSS 微調整は許容する

## 要オーナー確認

- グループ内ウィンドウの並び順自体（`sortWindowsInApp` によるソート）は本計画のスコープ外で変更しない想定でよいか <!-- human-judgment -->
- left/rightレイアウトの実機確認（bottomのみ確認済み） <!-- human-judgment -->

## 今回は対応しなかった改善候補（コードレビュー Suggestion、実害なしと判断し先送り）

- `hitTest` のオーバーシュート・フォールバック（`querySelectorAll` + 全グループ分の `getBoundingClientRect()`）が、rAF間引き撤回後は毎 pointermove で同期実行されうる。ウィンドウ数が少ない現状では体感問題になりにくいが、タスク数が多い環境で気になるようならグループ矩形のキャッシュ化を検討する
- `.tasks { overflow: hidden }`（bottomレイアウト）は `.task { height: 2.5em }` 固定＋`-webkit-line-clamp:1` を前提にした対策。将来 `.task` の高さやアイコンサイズを可変にする変更が入る場合はこの前提が崩れていないか確認すること

## 完了条件

- [x] `bun run test` 全通過（既存テスト回帰なし・新規ケース追加分含む。74件全通過）
- [x] `bun run lint` / `bun run typecheck` 通過
- [x] `bun run build` 通過
- [x] bottomレイアウトでグループ表示が崩れていないことを実機確認（オーナー確認済み）
- [ ] left/rightレイアウトでグループ表示が崩れていないことを実機確認（**未確認** — bottomのみ確認済み） <!-- human-judgment -->
- [x] グループを跨いだドラッグで高速交互入れ替えが再現しないことを実機確認（オーナー確認済み。振動防止の追加対策・アニメーション時間調整・末尾ドロップ対応・スクロールバー対応を経て「完璧」との確認を得た）

## AI 実装時間見積もり

1セッション以内（フェーズ1のレイアウト崩れ有無で調整が長引く可能性はあるが、通し切り想定）
