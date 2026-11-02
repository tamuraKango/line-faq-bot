# CLAUDE.md

## プロジェクト概要
LINEで質問すると、WordPressに登録された社内FAQ記事をもとにClaudeが回答するbot。
Claude API・LINE Messaging API・WordPress REST API を連携した、業務効率化の試作（デモ）。

詳細な仕様は **必ず `docs/design.md` を読んでから** 作業すること。

## 技術スタック
- NestJS（TypeScript）/ Node.js LTS
- `@line/bot-sdk`（LINE Messaging API）
- `@anthropic-ai/sdk`（Claude API、モデルは環境変数 `ANTHROPIC_MODEL`）
- WordPress（Docker Compose でローカル起動）
- ngrok（開発中に Webhook を公開するため）

## 開発環境
- Windows 11 / Docker Desktop（WSL2）
- コマンドは PowerShell でも動く形を優先する（`&&` 連結や bash 専用構文に依存しない）

## よく使うコマンド
- `npm run start:dev` … 開発サーバー起動（ポート 3000）
- `npm run test` … ユニットテスト
- `npm run test:e2e` … e2e テスト
- `docker compose up -d` … WordPress 起動（http://localhost:8080）
- `ngrok http 3000` … Webhook 公開用

## 進め方のルール
- `docs/design.md` の「フェーズ」単位で進める。1フェーズ = 1ブランチ = 1PR
- ブランチ名は `feature/<フェーズ名>`（例：`feature/echo-bot`）
- 着手前に「やることの計画」を箇条書きで示し、承認を待ってから実装する
- 1フェーズが終わったら、動作確認の手順と結果を報告する
- コミットは小さく。Conventional Commits 形式（`feat:` `fix:` `docs:` など）、本文は日本語でよい

## 守ること
- `.env` は絶対にコミットしない。変数を追加したら `.env.example` も更新する
- APIキー・トークン・チャネルシークレットをコード、ログ、コミット、PR本文に含めない
- LINE の署名検証は省略しない
- ライブラリの API は、インストールされているバージョンの型定義・公式ドキュメントで確認してから使う（記憶に頼らない）
- 設計書と違う実装をしたくなったら、先に理由を説明して相談する
