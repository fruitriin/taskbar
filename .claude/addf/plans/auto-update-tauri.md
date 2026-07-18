# Plan: 自動アップデート（tauri-plugin-updater）＋利用状況の観測

## 実装状況: 未着手

> 出典: オーナー指示（2026-07-18）「オートアップデートしたい」「ついでに実際に使われてるか
> どうかをアップデートのアクセスで調べられたらうれしいよね」。
> Q4 回答（2026-07-10）「Phase 3 完了後に tauri-plugin-updater 前提で再起票」の履行。

## 関連 Plan

- [autoUpdate.md](autoUpdate.md) — Electron 時代の旧計画（クローズ済み）。electron-updater ＋
  Supabase Functions によるハイブリッド計測案。「更新チェックのアクセスで利用状況を測る」
  という発想は本計画に引き継ぐ。実装詳細は全て Electron 前提のため流用しない
- [rearch-phase3.md](rearch-phase3.md) — Tauri v2 移行（完了）。本計画の前提

## 目的

1. GitHub Releases に公開した新バージョンを、ユーザーが手動 DL せずに受け取れるようにする
2. アップデートチェックのアクセスを観測し、「実際に使われているか」（アクティブ利用の
   有無・規模・バージョン分布）を把握できるようにする

## 現状の挙動

- 配布は GitHub Releases の universal DMG のみ。更新通知の仕組みが無く、
  ユーザーは新バージョンの存在を知る手段がない
- リリース CI は tauri-action（universal・releaseDraft: true・署名/notarize 実走検証済み）
- 利用状況を知る手段は Releases の DMG ダウンロード数（累積）だけ

## 方式（tauri-plugin-updater v2.10.1 前提 — 2026-07-18 crates.io/npm で確認）

- **署名鍵**: `tauri signer generate` で minisign キーペアを生成。
  秘密鍵は GitHub Secrets（`TAURI_SIGNING_PRIVATE_KEY` / 同 `_PASSWORD`）、
  公開鍵は `tauri.conf.json` の `plugins.updater.pubkey`。
  **秘密鍵はリポジトリにコミット禁止**（.env と同格の扱い。紛失すると以後の
  アップデート配信が不能になるため、オーナーのパスワードマネージャ等にも控えを置く）
- **アーティファクト**: `bundle.createUpdaterArtifacts: true` → universal の
  `.app.tar.gz` ＋ `.sig` が生成され、tauri-action が `latest.json`
  （バージョン・URL・署名・platform キー）を Release assets に追加する
- **エンドポイント**: `plugins.updater.endpoints` は**複数指定でき、順に試行される**。
  これを利用して「1本目 = 計測付き自前エンドポイント、2本目 = GitHub latest.json 直」
  とすれば、計測サーバーが死んでいてもアップデート機能は無傷（可用性を GitHub に担保させる）

## 計測方式の選択肢（要オーナー確認 1）

| 案 | 仕組み | 得られるもの | インフラ負担 |
|---|---|---|---|
| (a) ゼロインフラ | GitHub API で latest.json アセットの download_count を見る | 累積チェック回数のみ（riin-service の cron で日次ポーリング→差分を取れば時系列化可能） | なし |
| (b) 自前プロキシ | riin-service に `GET /taskbar/update?v={{current_version}}&target={{target}}&arch={{arch}}` を生やしてアクセスログを記録 → GitHub の latest.json 内容を返す | 日次アクティブ数・バージョン分布・更新の浸透速度 | エンドポイント1本＋ログ。公開 URL が必要 |
| (c) ハイブリッド（推奨） | (b) を1本目、GitHub 直を2本目のフォールバックに | (b) と同じ（サーバー停止中の欠測は許容） | (b) と同じだが可用性責任なし |

- updater のエンドポイント URL には `{{current_version}}` / `{{target}}` / `{{arch}}` の
  テンプレート変数が使えるため、(b)(c) ではクライアント改修なしでバージョン分布が取れる
- 計測で送るのは上記変数と接続元 IP のみ（個人情報なし）。README かリリースノートに
  「更新チェック時にバージョン情報がサーバーに送られる」旨を一行明記する

## 更新 UX の選択肢（要オーナー確認 2）

| 案 | 挙動 |
|---|---|
| (X) メニュー通知（推奨） | 起動時＋24h 周期でチェック。更新があればロゴメニューに「アップデートあり (vX.Y.Z)」項目を出し、クリックで DL→適用→再起動。普段は完全に無音 |
| (Y) サイレント | 自動 DL し、アプリ終了時に適用。ユーザーへの表示なし |
| (Z) ダイアログ | 更新検出時にダイアログで確認 |

タスクバーという常駐アプリの性格上、(X) が邪魔にならず気づけるバランスと考える
（(Y) は常駐アプリだと「終了時」がほぼ来ない点が弱い）。

## 変更内容（フェーズ）

### フェーズ1: 鍵と配布経路の整備

- **対象**: `tauri.conf.json` / `.github/workflows/release.yml` / GitHub Secrets
- minisign キーペア生成（オーナー同席: 秘密鍵の保管先確認）
- `bundle.createUpdaterArtifacts: true`、`plugins.updater`（pubkey / endpoints）追加
- release.yml に `TAURI_SIGNING_PRIVATE_KEY(_PASSWORD)` を配線
- latest.json の platform キーが universal ビルドでどう出るか確認
  （darwin-aarch64 / darwin-x86_64 両キーへの展開を想定。実装時に実物で検証）

### フェーズ2: クライアント実装

- **対象**: `src-tauri/`（plugin 導入・capabilities）/ `src-renderer/`（メニュー UI）
- tauri-plugin-updater（Rust + JS ガード）導入、起動時＋周期チェック
- UX 採択案の実装（X ならメニュー項目＋適用フロー）
- ブラウザモック（`electron-mocks.ts`）に updater のモックを追加し dev:web を壊さない

### フェーズ3: 計測（採択案による）

- **対象**: riin-service（(b)/(c) の場合）または riin-service の cron（(a) の場合）
- (c) の場合: ログ付きエンドポイント実装（latest.json のキャッシュ付きプロキシ、
  数行のログ形式: 日時 / IP / version / target / arch）＋簡単な集計手段

### フェーズ4: リリース実走検証

- 導入版（v3.1.0 想定）をタグ push → CI が updater アーティファクト＋latest.json を
  生成することを確認 → 公開
- 検証用パッチ（v3.1.1）を用意し、**実機で v3.1.0 → v3.1.1 の自動更新が完走することを確認**
  （旧 v3.0.0 以前のユーザーには効かない — 更新機能を持つ版を一度手動で入れてもらう必要が
  ある点をリリースノートに明記）

## 影響範囲

- tauri.conf.json / release.yml / src-tauri（plugin・capabilities）/ src-renderer（メニュー）
- riin-service（計測 (a)(b)(c) いずれでも何かしら追加。別リポジトリのため作業単位を分ける）
- リリース運用: releaseDraft: true は維持可能（draft 中は latest.json も非公開 = 公開時に有効化）

## テスト方針

- ユニット: バージョン比較・メニュー表示条件など切り出せるロジックのみ
- 実走: フェーズ4の2段リリースで E2E 検証（これが本命。CI ログと実機更新の両方を確認）
- Feedback.md 既載の注意「Secrets の CERT が正しいか初回リリースで確認」は v3.0.0 で
  実走済みのため解消済み。updater 用 Secrets は今回新設分のみ確認

## 破壊的変更の許容範囲

なし（既存の DMG 手動配布はそのまま並存）

## 要オーナー確認

1. **計測方式**: (a) ゼロインフラ / (b) 自前プロキシ / (c) ハイブリッド（推奨）。
   (b)(c) の場合、riin-service は外部公開できる状態か（公開 URL・常時稼働の有無）
2. **更新 UX**: (X) メニュー通知（推奨） / (Y) サイレント / (Z) ダイアログ
3. 秘密鍵の保管先（パスワードマネージャ等、CI Secrets 以外の控え場所）

## 完了条件

- [ ] フェーズ1〜2 実装後、品質ゲート全通過（bun run lint / typecheck / test / build、
      cargo check / clippy / test / fmt --check）
- [ ] CI が updater アーティファクト（.app.tar.gz + .sig）と latest.json を生成する
- [ ] 実機で旧バージョン → 新バージョンの自動更新が完走する <!-- human-judgment -->
- [ ] 採択した計測方式でアクセスが観測できる（アクセスログまたは download_count の取得実演） <!-- human-judgment -->
- [ ] 計測についての一行開示を README またはリリースノートに追加

## AI 実装時間見積もり

フェーズ1〜3 で 1〜2 セッション。フェーズ4 はリリース2回分の実走のためオーナー同席の
往復込みで別途 1 セッション程度
