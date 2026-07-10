# Swift/Electron → Rust 移植の運用パターン（Tauri 移行）

**記録日**: 2026-07-10（rearch Phase 3.2〜3.4 の総括）

## 委譲パターン（エージェントに Rust モジュールを書かせる）

- **ゲートを客観判定基準にする**: cargo check / clippy --all-targets -D warnings / test / fmt を
  「全て通るまで反復」と指示すると、API の試行錯誤コストをエージェント側に寄せられる
- **意味論の原本を明示する**: 「Swift main.swift:xxx-yyy」「Electron events.ts の該当ハンドラ」と
  行範囲で指定し、コメントに原本参照を残させる。原本と意図的に変えた点（デバウンス化・
  Finder 特別扱いの統一など）は判断コメントを義務化
- **実機依存は ignored テストに隔離**: AX 操作・WindowServer 呼び出しは #[ignore] で用意させ、
  実機確認ポイントでまとめて回す

## 境界の互換を守る技法

- **serde rename でフロント TS 型とキー名を完全一致**（kCGWindowOwnerName 等）。
  接続フェーズでフロント無変更を実現する要
- **ペイロード形は「原本3実装からの逆算」**: 送信側（Swift/helper.ts）と受信側（Vue）を
  両方読んで一致させる。iconUpdate は生 base64・process の appIcon は data: 付き、のような
  非対称は片側だけ読むと必ず踏む
- **Tauri Monitor は物理ピクセル**: Electron の workArea（DIP）互換には to_logical(scale_factor)
  が必須。怠ると Retina で座標2倍ズレ
- **Tauri に fire-and-forget IPC は無い**: ipcSend は「戻り値を待たない invoke」で代替。
  チャンネル名 camelCase → コマンド snake_case、位置引数 → 名前付き引数（ARG_KEYS 表、
  真実源は Rust 関数シグネチャ。Tauri が snake_case 引数を camelCase 化する点に注意）

## 移行共存の設計

- **ipc.ts のランタイム切替**（__TAURI_INTERNALS__ → window.electron）で、Electron 版・
  ブラウザモック・Tauri 版が同一コードベースで共存。モック層の作り直しが不要になった
- **設定データ移行は Rust 側で冪等ワンショット**（新ストアにキーがあればスキップ）。
  抽出ロジックは純関数化してテスト
