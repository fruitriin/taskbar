## 開発者向け情報

### 開発ツール

- **タスクランナー**: package.json scripts（`bun run <task>`）
- **パッケージマネージャ**: bun
- **バックエンド**: Rust / Tauri v2（`src-tauri/`）

### ディレクトリ構成

- .github
- .vscode
- src-tauri：Rust バックエンド（ウィンドウ列挙・AX 操作・権限・アイコン・設定ストア）
- src-renderer：UI を構築する部分。Vue 3
- dist(ignored)：vite build の出力（Tauri の frontendDist）
- docs：計画・ノウハウ・画像

v2 系までの Electron + Swift Helper 構成は git tag `v2-electron-final` を参照。

### 開発方法

```bash
bun run dev          # Tauri 実機起動（初回は Rust ビルドで数分かかる）
bun run dev:web      # ブラウザテスト用 dev サーバーのみ（モック注入、port 10234）
bun run build:mac    # リリースビルド（未署名）
bun run release:mac  # 署名＋notarize 付きリリースビルド（要 .env）
bun run install-app  # /Applications ディレクトリに放り込む
```

`.env`（gitignore 済み）には APPLE_ID / APPLE_ID_PASS / TEAM_ID を書く。

### 利用可能なスクリプト

- `format`: oxfmt
- `lint`: oxlint
- `typecheck`: vue-tsc
- `test`: レンダラーテスト（bun test）
- `test:all`: レンダラーテスト＋Rust テスト（cargo test）
- `build`: vite build（フロントのみ）
- `dev` / `tauri:dev`: tauri dev
- `build:mac` / `tauri:build`: tauri build
- `release:mac`: scripts/build-release.sh（署名＋notarize）
- `install-app`: ビルド済み .app を /Applications へコピー
- `vite:dev` / `vite:build`: **tauri.conf.json の beforeDevCommand / beforeBuildCommand
  から呼ばれる内部フック**。直接叩く必要はないが削除しないこと（消すと `dev` /
  `build:mac` が壊れる）

Rust 側のチェックは `src-tauri/` で `cargo check` / `cargo clippy --all-targets -- -D warnings` /
`cargo test` / `cargo fmt --check`。

### やること

- playwright mcpとe2eがすごいらしいのでやってみたい
- 設定画面がしっちゃかめっちゃかなので、これは直す
- 設定ファイルの構造が変わったとき必ず致命的なエラーが出るので、世代間で不整合が起きないように、各バージョンのときの設定ファイル、マイグレーションコードのテストを書いて安全に移行できるようにしたい
- タスクバーがウィンドウのどこに張り付くかについて、今は一つしか選択できないので、ウィンドウごとに設定したい
- タスクバーの位置に他のウィンドウが重なってきた時、そのウィンドウをリサイズしたり移動したりってできるかな？
- claudeのための差分テスト環境作れたらいいね　で、それってなんなんだろうね

## 済リスト

- アイコンの保存先を本番ではElectron推奨の保存先に直す
- Tauri v2 への移行（Electron / Swift Helper / mise の全廃）
