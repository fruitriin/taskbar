# Process Feedback

開発プロセスの振り返りと改善を記録する。

## 記録方法

タスク完了時や問題発生時に、以下のいずれかのセクションに追記する。

## オーナーフィードバック

## 問題の記録

- 2026-07-05: `package.json` の `riinlogger: "file:../RiinLogger"` は参照元ディレクトリが存在せず、`bun install` のたびに「Failed to install 1 package」を出す。使用箇所は全てコメントアウト済み import のみ。依存から外してよいかはオーナー判断（削除するなら package.json から1行削除）
- 2026-07-05: `mise run build` は Swift Helper バイナリ（nativeSrc/DerivedData/...）が未ビルドだと cp 段階で失敗する。JS 側だけ検証したいときは `npx electron-vite build` を直接使う

## 改善アクション

- 2026-07-05: 新しい electron-store マイグレーションを追加したら、リリース時に package.json の version がマイグレーションキーを満たすことを確認する（今回 `>=2.1.1` を追加、現行 2.1.0。詳細は `docs/knowhow/electron-store-migration.md`）

## 完了済み
