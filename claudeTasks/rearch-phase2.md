# Phase 2: フロントエンドビルドチェーン整理 (vp)

**親ドキュメント**: [リアーキテクチャ計画書](../rearchitecture-plan.md)

**前提**: Electron 上で動作を維持したまま実施。このフェーズ完了後にリリース可能。
electron-vite は Phase 3 まで残す（dev/build はそのまま、品質チェック系のみ vp に移行）。

---

## 2.1 Vite+ (vp) 導入

### インストール

- [ ] `vite-plus` をインストール
- [ ] `vp --version` で動作確認

### ESLint → Oxlint (vp lint)

- [ ] `vp lint` で既存コードをリントし、動作確認
- [ ] package.json 内の `eslintConfig` セクションを削除
- [ ] 以下のパッケージを削除:
  - `eslint`
  - `eslint-plugin-vue`
  - `@rushstack/eslint-patch`
  - `@vue/eslint-config-prettier`
  - `@vue/eslint-config-typescript`
- [ ] `.eslintrc.*` ファイルがあれば削除
- [ ] 必要に応じて Oxlint のルール調整（`oxlint.config.json` または `vite.config.ts` 内）

### Prettier → Oxfmt (vp fmt)

- [ ] `vp fmt` で既存コードをフォーマットし、動作確認
- [ ] package.json 内の `prettier` / `prettierIgnore` セクションを削除
- [ ] `prettier` パッケージを削除
- [ ] `.prettierrc.*` ファイルがあれば削除

### Vitest → vp test

- [ ] `vp test` で既存テストを実行し、動作確認
- [ ] Vitest 関連の設定を `vite.config.ts` に統合（必要に応じて）
- [ ] `vitest` は vp に内包されるため、個別インストールの vitest を削除可能か確認

### 一括チェック

- [ ] `vp check` で lint + fmt + typecheck が一括実行されることを確認

---

## 2.2 mise 廃止

### タスク移植

現行の `.mise.toml` で定義されているタスクを vp run 用に移植する。

```toml
# 現行 .mise.toml のタスク（参考）
[tasks.dev]
run = "..."
[tasks.build]
run = "..."
[tasks.test]
run = "..."
# etc.
```

- [ ] vite.config.ts に viteTask でタスクを定義（Phase 3 完了後のコマンド体系を先取り）

```typescript
// vite.config.ts（参考）
import { defineConfig } from 'vite-plus'

export default defineConfig({
  // viteTask の定義（vp が対応している場合）
  // 対応していなければ package.json scripts に定義
})
```

- [ ] 代替案: package.json の `scripts` に必要なコマンドを定義

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "test": "vp test",
    "lint": "vp lint",
    "fmt": "vp fmt",
    "check": "vp check",
    "typecheck": "vue-tsc --noEmit"
  }
}
```

### バージョン管理

mise がランタイムバージョン管理にも使われている場合の対応:

- [ ] Node バージョン管理 → `.node-version` ファイルに移行
- [ ] Rust バージョン管理 → `rust-toolchain.toml` に移行（Phase 3 で使用）

### mise 削除

- [ ] `.mise.toml` を削除
- [ ] mise 依存の CI/CD 設定があれば更新

---

## 完了条件

- [ ] `vp lint` が動作し、ESLint と同等以上のチェックが実行される
- [ ] `vp fmt` が動作し、Prettier と同等のフォーマットが実行される
- [ ] `vp test` で全テストがパスする
- [ ] `vp check` で lint + fmt + typecheck が一括実行される
- [ ] ESLint, Prettier, mise の設定ファイル・依存がすべて削除されている
- [ ] electron-vite は残っている（dev/build 用）
- [ ] `electron-vite dev` でアプリが正常起動する

---

## 注意事項

### Vite+ Alpha のリスク

Vite+ は現在 Alpha 段階。以下の問題が起きる可能性がある:

- Oxlint が ESLint の特定ルール（Vue 固有等）をカバーしていない
- Oxfmt の出力が Prettier と微妙に異なる
- vp test と既存の Vitest 設定の互換性

**対策**: 問題が発生した場合、該当ツールだけ個別インストールに戻す（vp lint → oxlint 直接、等）。
Vite+ は Vite のスーパーセットなので、ビルド部分が壊れるリスクはほぼない。

### electron-vite との共存

Phase 2 完了時の状態:

```
dev/build   → electron-vite（Electron 固有のマルチプロセスビルド）
lint        → vp lint (Oxlint)
fmt         → vp fmt (Oxfmt)
test        → vp test (Vitest)
typecheck   → vp check
```

Phase 3 で electron-vite を完全に外し、vp dev / vp build + cargo tauri に切り替える。
