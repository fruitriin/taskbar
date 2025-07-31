# Taskbar.fm (for mac)
aim to make taskbar for use mac  
Macにタスクバーをつけます（Windowsのような！）


<p align="center">
  <img src="https://raw.githubusercontent.com/fruitriin/taskbar/master/resources/taskbar-logo.png">
</p>

![スクリーンショット 2023-06-02 10 18 56](https://github.com/fruitriin/taskbar/assets/18308639/e7138e77-6557-4150-904e-2bf52063b26c)

[最新版のダウンロード](https://github.com/fruitriin/taskbar/releases)

Q. 画面収録の権限が必要なのはなぜですか？  
A. タイトルバーのタイトルの取得に画面収録の権限が必要です。  
Apple(Mac)がそう定めているので付与してあげてください。  
特に録画を残したりしているとかそういうことではありません。  

Q. Dockと場所がかぶってしまいました  
A. Dockの場所を移動しましょう（横とか）    
さらに最小サイズにして、普段は非表示にもしています。  

タスクバーくんは強い！

## 開発者向け情報

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
npm run helper    # TaskbarHelperをビルドする
npm run dev       # 開発環境が立ち上がる
npm run build:mac # mac用のバイナリができる
npm run install-app # /Applications ディレクトリに放り込む
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
- アイコンの保存先を本番ではElectron推奨の保存先に直す
- swiftのアイコン保存先も同様になるようにする(devモードと本番モードで出力先の整合性はとる)
- playwright mcpとe2eがすごいらしいのでやってみたい
- 設定画面がしっちゃかめっちゃかなので、これは直す
- 設定ファイルの構造が変わったとき必ず致命的なエラーが出るので、世代間で不整合が起きないように、各バージョンのときの設定ファイル、マイグレーションコードのテストを書いて安全に移行できるようにしたい
- タスクバーがウィンドウのどこに張り付くかについて、今は一つしか選択できないので、ウィンドウごとに設定したい
- タスクバーの位置に他のウィンドウが重なってきた時、そのウィンドウをリサイズしたり移動したりってできるかな？
- claudeのための差分テスト環境作れたらいいね　で、それってなんなんだろうね

