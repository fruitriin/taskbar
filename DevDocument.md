#開発用ドキュメント

## ディレクトリ構成

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

## How to Develop
npm run helper で TaskbarHelperをビルドする
npm run devで開発環境が立ち上がる
npm run build:mac でmac用のバイナリができる
npm run install-app で /Applications ディレクトリに放り込む

build:win と build:linuxはあるけどTaskbarHelper相当のものがないので実質ビルドできない
 
## package.json Script
- "format": "prettier --write .",
- "lint": "eslint . --ext .js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts,.vue --fix",
- "typecheck:node": "# tsc --noEmit -p src/main/tsconfig.node.json --composite false",
- "typecheck:web": "# vue-tsc --noEmit -p src/renderer/tsconfig.web.json --composite false",
- "typecheck": "npm run typecheck:node && npm run typecheck:web",
- "start": "electron-vite preview",
- "dev": "electron-vite dev",
- "helper": "swiftc src/native/helper.swift -o resources/TaskbarHelper ",
- "build": "npm run typecheck && electron-vite build",
- "postinstall": "electron-builder install-app-deps",
- "build:win": "npm run build && electron-builder --win --config",
- "build:mac": "npm run build && electron-builder --mac",
- "build:linux": "npm run build && electron-builder --linux --config",
- "afterSign": "scripts/notarize.js",
- "install-app": "rm -rf /Applications/taskbar.fm.app && cp -a dist/mac-arm64/taskbar.fm.app /Applications/taskbar.fm.app"
 
