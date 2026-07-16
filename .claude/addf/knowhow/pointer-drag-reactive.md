---
title: Pointer Events + Vue リアクティブで Sortable 的 D&D を再現する
created: 2026-07-05
last_verified: 2026-07-15
depends_on:
  - file: src-renderer/src/drag-session.ts
  - file: src-renderer/src/utils.ts
  - file: src-renderer/src/pages/index.vue
status: active
---

# Pointer Events + Vue リアクティブで Sortable 的 D&D を再現する

**参考**: fruitriin/misskey の MkDraggable（コミット 3dfe818）のエッセンス移植
**関連**: [group-drag-swap-fix.md](../plans/group-drag-swap-fix.md)（グループ化リストでの振動バグ修正で本ノウハウを大幅拡充）

## 構成（生 DOM 操作なし）

1. **ドラッグ中の並び順をリアクティブ状態に持つ**: `dragOrder: string[] | null` を data に置き、
   表示用 computed が `dragOrder ?? options.appOrder` を使う。pointermove 中に `moveApp` で
   `dragOrder` を差し替えると `<TransitionGroup name="flip-list">` の FLIP
   （`.flip-list-move { transition: transform }`）が「滑って避ける」を勝手に演出する
2. **振動（オシレーション）対策は3段**: 入れ替えクールダウン 150ms ＋ ゴーストの進行方向端が
   ターゲットに 30% 以上食い込んだら入れ替え（`shouldSwap` 純関数、utils.ts）＋
   直前に入れ替えた相手とはゴーストが完全に離れる（`rectsSeparated`）まで再入れ替えしない
   （`drag-session.ts` の `blockedApp`）。**振動対策の主役は`blockedApp`（時間非依存の
   幾何学的な分離判定）であり、クールダウンは短くてよい**（一時 800ms まで伸ばしたが、
   隣接スワップが不自然に鈍重になり、かつクールダウン境界のタイミングのずれでアニメーションが
   完走前に打ち切られる問題も出たため 150ms へ戻した）。詳細は「振動対策3段目」節を参照
3. **キャンセルの戻りもタダ**: `dragOrder = null` にするだけで computed が元の並びへ戻り、
   FLIP が戻りアニメーションになる

## 設計判断と根拠

- **setPointerCapture は使わず document でリッスン**: TransitionGroup の DOM 並び替えで
  Pointer Capture が暗黙解放されるため（MkDraggable の実装コメント由来）。
  pointermove/pointerup/pointercancel/visibilitychange を pointerdown 時に張り、
  cleanup で必ず剥がす
- **ゴーストは TransitionGroup の外**: 中に入れると enter/leave/move の transition:none
  除外が必要になる。外に置けば無縁
- **ゴースト矩形は DOM を読まず算術で出す**: 押下時の `getBoundingClientRect` を
  プレーンオブジェクトで保存し、`基準矩形 + (clientX - startX)` で算出。
  `pointer-events: none` なので elementFromPoint の hide/show ハックも不要
- **ドラッグ後の click 合成抑止**: `didDrag` フラグを見て1回無視し、`setTimeout(0)` で解除
  （click は pointerup 直後に同期発火するため）
- **確定時は options に楽観反映してから setOptions**: IPC 往復を待つと一瞬旧並びに戻る
  （FLIP があるとむしろ目立つ）
- **外部由来のリスト更新はドラッグ中保留**: `dragActive` 中は `pendingWindows` に貯めて
  cleanup で flush（並び替え判定の土台が動くと崩れるため）

## D&D の当たり判定単位と幾何情報取得単位を一致させる原則（重要）

判定ロジックが「グループ単位」（複数 DOM 要素の集合）で動いているのに、hitTest
（`elementFromPoint` 等）が「個別のサブ要素」の矩形を返していると、グループの実際の
表示幅と判定に使われる矩形が乖離し、境界での判定が過敏になって振動の原因になる。

taskbar.fm では当初、同一アプリの複数ウィンドウを「グループ」として表示していたが、
D&D の並び替え判定は `order.indexOf(app)`（アプリ単位）なのに対し、`hitTest` は
`elementFromPoint().closest('button[data-app]')` で**カーソル直下の1個のサブボタン**の
矩形を返していた。グループが3ウィンドウでも判定に使われる矩形は1ウィンドウ分の狭さで、
`shouldSwap` の閾値（`min(ghost幅, target幅) × 30%`）が実態より小さくなりすぎ、境界付近で
過敏に反転して振動した。

**対策**: グループ全体を DOM 上も1つの wrapper 要素（`.task-group`）にまとめ、`hitTest` が
その wrapper の矩形を返すようにする。判定単位と幾何取得単位を必ず一致させること。

## 振動対策3段目: 直前の相手との即時逆再入れ替えを防ぐ（`blockedApp`）

クールダウン＋しきい値の2段だけでは、入れ替え直後にゴーストが相手の近くに留まり続ける
ケースで振動が防ぎきれないことが実機確認で判明した（グループ化で判定矩形が広がった分、
「近くに留まる」確率も上がる）。

**メカニズム**: A→B へスワップした直後、ゴースト自体はポインタの生座標を追従するだけで
DOM の反映（FLIP アニメーション）とは無関係に動く。クールダウン明けにゴーストがまだ B の
旧位置付近に留まっていると、しきい値条件だけを見れば逆方向スワップが成立してしまい、
往復（thrashing）する。

**対策**: `rectsSeparated(ghostRect, targetRect, horizontal)`（進行方向の主軸で矩形の重なりが
ゼロ以下かを判定する純関数）を追加し、`drag-session.ts` に `blockedApp: string | null` 状態を
持たせる。直前に入れ替えた相手（`blockedApp`）とは、ゴーストが完全に離れるまで再入れ替えを
禁止する。新しいスワップが起きると `blockedApp` はその新しい相手で上書きされる（＝古い
ブロックは自然に無効化される。乗り換えでデッドロックしない）。

**ハマりどころ（レビューで検出）**: `blockedApp` の解除条件を「ヒット対象が自分自身になった
（`hit.app === app`）」だけで無条件リセットすると壊れる。FLIP アニメーション中、ドラッグ元の
実要素は相手の旧位置（＝ゴーストが留まっている場所）へ滑り込んでくる過程で、一時的に
自分自身へのホバーを経由することがある。ここで無条件にリセットすると、相手からゴーストが
実際には離れていないのに再入れ替えが許可されてしまい、振動防止の保証が崩れる。
**解除は必ず `rectsSeparated` による明示的な確認を経由させること**（自分自身へのホバーや
hit なしでは何もしない＝状態を保持したままにする）。

## rAF スロットリングと Vue の TransitionGroup FLIP が競合する（ハマりどころ）

`pointermove` の発火頻度をそのまま同期処理すると、`elementFromPoint`/`getBoundingClientRect`
の高頻度呼び出しが振動を増幅させると考え、`requestAnimationFrame` で1フレーム1回に間引く
最適化を試みた。しかし Vue3 の `TransitionGroup` は FLIP アニメーション（before 測定 →
DOM 更新 → after 測定 → inverse transform 適用 → 解除して CSS transition へ）の内部シーケンスに
**自身も rAF を使っている**。独自の rAF スロットリングがこれと競合し、
「**ドラッグ中だけ FLIP アニメーションが効かない、pointermove リスナーが外れる pointerup 後は
正常に動く**」という分かりにくい症状が発生した（実機確認でのみ発見。机上のレビューでは
気づけなかった）。

**教訓**: 操作対象のコンポーネントが Vue の `Transition`/`TransitionGroup` を使っている場合、
独自の rAF ベース最適化（スロットリング・デバウンス）を pointermove 等の高頻度イベントに
追加するときは、FLIP アニメーションが動くタイミングと競合しないか実機で確認すること。
確実に競合するとは限らないが、「アニメーションが特定の操作中だけ効かない」系の不具合が出たら
真っ先に疑う候補にしてよい。taskbar.fm では最終的にこの最適化を撤回し、pointermove は
同期呼び出しに戻した（振動対策は上記3段で十分だったため、rAF 間引きの必要性自体が低かった）。

## 入れ子 TransitionGroup の name 衝突（ハマりどころ）

グループ化されたリストで「外側のリスト全体の並び替え」と「各グループ内部の要素増減」の
両方を FLIP アニメーションさせたい場合、外側と内側それぞれに `TransitionGroup` を配置する
（入れ子）実装パターンが有効。ただし**外側と内側で同じ `name` 属性（例: `name="flip-list"`）を
使うと、Vue が生成する CSS クラス名（`.flip-list-move` 等）が衝突し、外側のアニメーションまで
効かなくなる**。内側は別名（`flip-list-inner` 等）にし、対応する CSS
（`.flip-list-inner-move { transition: ... }`）も別途定義すること。

## hitTest のオーバーシュート対応

ドラッグ中にリスト領域の外（末尾を通り過ぎる・列の外に縦にはみ出す等）へポインタが出た
場合、`elementFromPoint` による直接ヒットテストは失敗（`null` または無関係な要素）する。
実用上は以下の2段構成のフォールバックが必要:

1. **範囲内探索**: 進行軸の座標（水平レイアウトなら x、垂直なら y）が、どの要素の範囲
   （`left`〜`right` または `top`〜`bottom`）に該当するか全要素から探す
2. **端フォールバック**: どの要素の範囲にも該当しなければ、先頭/末尾の要素へフォールバック
   する

**先頭/末尾の二択だけ（範囲内探索を省略）にすると壊れる**: リストの途中（例: 3番目の要素の
真上）から縦に大きくはみ出した場合、二択ロジックは末尾へ誤ってジャンプしてしまう
（先頭/末尾の判定基準は「進行軸の座標が先頭要素の手前か、末尾要素の先か」の1点だけなので、
途中の要素はそもそも候補に入らない）。範囲内探索を先に行うことで、この誤判定を防げる。

専用ウィンドウ（他パネルと同居しない）が対象であれば、Y/X 方向の帯制限（「大きく外れたら
無視する」ガード）は基本的に不要 — 誤爆のリスクより、意図した操作を弾いてしまう害の方が
大きい。

## CSS transform アニメーション中に一時的な overflow でスクロールバーが出る（ハマりどころ）

WebKit 系（Tauri/macOS の WKWebView）で、`overflow-y: auto` が設定されたコンテナ内で CSS
transform によるアニメーション（FLIP 等）が動いていると、アニメーション中の一時的な描画
範囲が overflow 判定に含まれ、**アニメーション中だけスクロールバーが出現する**ことがある
（縦横どちらの overflow でも発生しうる）。単一行/単一列で本来スクロール不要なレイアウトでは
`overflow: hidden` にする方が安全（`overflow-y: auto` を漫然と付けたままにしない）。

## 実機確認は反復が必要（教訓）

group-drag-swap-fix.md での実測: 事前に懸念していた「CSS レイアウト崩れ」は起きなかったが、
代わりにゴーストの縦ブレ・振動の残存・アニメーション速度感・rAF と FLIP の競合・
TransitionGroup name 衝突・スクロールバー・オーバーシュート時のスワップ不可、という**7件の
不具合がすべて机上のコードレビューでは検出できず、実機での対話的な検証を繰り返して初めて
見つかった**。Playwright MCP 等のブラウザ自動化が使えない環境では、オーナーとの対話的な
実機確認ループを前提にタスクを計画すべき（一発で完璧な実装を狙うより、素早くフィードバック
を回せる体制を優先する）。

## ハマりやすい点（旧知見）

- `MOVE_THRESHOLD_PX`（8px）未満で pointerup → 通常クリックとして素通しする分岐を忘れない
- 右クリック共存は pointerdown の `event.button !== 0` ガード
- beforeUnmount でも cleanup（ディスプレイ再構成でタスクバーが再作成されるため）
