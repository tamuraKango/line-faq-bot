# 社内FAQ LINE bot

LINE で質問すると、WordPress に登録された社内FAQ記事をもとに Claude が回答する bot です（試作）。
仕様は [docs/design.md](docs/design.md) にまとめています。

> 構成図とデモは、Phase 4（仕上げ）で追加します。

## 必要なもの

- Node.js（LTS）
- Docker Desktop
- ngrok（LINE から Webhook を受け取るため）
- LINE Messaging API のチャネル

## セットアップ

### 1. 依存パッケージと環境変数

```powershell
npm install
Copy-Item .env.example .env
```

`.env` に次の値を入れます。`.env` はコミットしません。

| 変数名 | 内容 |
|---|---|
| `LINE_CHANNEL_SECRET` | LINE Developers の「チャネル基本設定」にあるチャネルシークレット |
| `LINE_CHANNEL_ACCESS_TOKEN` | 「Messaging API設定」で発行するチャネルアクセストークン（長期） |
| `WP_DB_PASSWORD` / `WP_DB_ROOT_PASSWORD` | ローカルの MySQL 用。適当な長い文字列でよい |
| `WP_ADMIN_PASSWORD` | WordPress 管理画面（ユーザー名 `admin`）のパスワード |

### 2. WordPress を起動し、サンプルFAQを入れる

```powershell
docker compose up -d
npm run seed
```

- http://localhost:8080 で、サンプルFAQ 10件が表示されます
- 管理画面は http://localhost:8080/wp-admin です
- 記事は [wordpress/seed/posts/](wordpress/seed/posts/) にあります。1行目がタイトル、2行目以降が本文（HTML）です。直してから `npm run seed` を再実行すると、同じ記事が更新されます（重複はしません）
- データをすべて消して作り直すときは `docker compose down -v` を実行します

### 3. bot を起動し、LINE とつなぐ

```powershell
npm run start:dev
ngrok http 3000
```

LINE Developers の「Messaging API設定」で、次のように設定します。

- Webhook URL：`https://<ngrok のドメイン>/webhook`
- 「Webhookの利用」：オン

LINE Official Account Manager の「応答設定」で、「応答メッセージ」はオフにします。

## テスト

```powershell
npm run test      # ユニットテスト
npm run test:e2e  # e2e テスト
npm run lint
```
