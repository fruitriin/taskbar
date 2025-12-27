## 開発者向け情報

### 開発ツール

- **タスクランナー**: mise - すべての開発・ビルドタスクの実行に使用
- **パッケージマネージャ**: bun - 依存関係管理とスクリプト実行に使用

### ディレクトリ構成

- .github
- .vscode
- build：electron-viteのやつにアイコンさしかえただけ
- dist(ignored)：dmgなどになったあと
- out(ignored)：アプリをビルドしたあと
- resources：ロゴと、同梱する TaskbarHelper（後述）
- src：基本的にここにすべてのソースが入っている
  - main：Electronのメインプロセス。 nodeで動く
  - native： TaskbarHelperを作るためのコード
  - renderer： UIを構築する部分。Vue

### 開発方法

```bash
mise run helper    # TaskbarHelperをビルドする
mise run dev       # 開発環境が立ち上がる
mise run build:mac # mac用のバイナリができる
mise run install-app # /Applications ディレクトリに放り込む
```

build:win と build:linuxはあるけどTaskbarHelper相当のものがないので実質ビルドできない

### 利用可能なスクリプト

- `format`: prettier --write .
- `lint`: eslint . --ext .js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts,.vue --fix
- `typecheck:node`: tsc --noEmit -p src/main/tsconfig.node.json --composite false
- `typecheck:web`: vue-tsc --noEmit -p src/renderer/tsconfig.web.json --composite false
- `typecheck`: npm run typecheck:node && npm run typecheck:web
- `start`: electron-vite preview
- `dev`: electron-vite dev
- `helper`: swiftc src/native/helper.swift -o resources/TaskbarHelper
- `build`: npm run typecheck && electron-vite build
- `postinstall`: electron-builder install-app-deps
- `build:win`: npm run build && electron-builder --win --config
- `build:mac`: npm run build && electron-builder --mac
- `build:linux`: npm run build && electron-builder --linux --config
- `afterSign`: scripts/notarize.js
- `install-app`: rm -rf /Applications/taskbar.fm.app && cp -a dist/mac-arm64/taskbar.fm.app /Applications/taskbar.fm.app

### 設計メモ

eslint.rc .prettier.rc -> package.json の中

### 検討済み項目

- vitestをプロジェクトグローバルに追加することに失敗

### やること

- swiftのアイコン保存先も同様になるようにする(devモードと本番モードで出力先の整合性はとる)
- playwright mcpとe2eがすごいらしいのでやってみたい
- 設定画面がしっちゃかめっちゃかなので、これは直す
- 設定ファイルの構造が変わったとき必ず致命的なエラーが出るので、世代間で不整合が起きないように、各バージョンのときの設定ファイル、マイグレーションコードのテストを書いて安全に移行できるようにしたい
- タスクバーがウィンドウのどこに張り付くかについて、今は一つしか選択できないので、ウィンドウごとに設定したい
- タスクバーの位置に他のウィンドウが重なってきた時、そのウィンドウをリサイズしたり移動したりってできるかな？
- claudeのための差分テスト環境作れたらいいね　で、それってなんなんだろうね

## 済リスト

- アイコンの保存先を本番ではElectron推奨の保存先に直す
