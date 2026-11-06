// LINE の Webhook URL を切り替え、LINE から接続テストをする
// 使い方: npm run line:webhook -- https://<ドメイン>/webhook
//   Render に切り替えるときは Render の URL、手元で開発するときは ngrok の URL を渡す
// チャネルアクセストークンは .env から読む（node --env-file=.env で起動する）
import { messagingApi } from '@line/bot-sdk';

const endpoint = process.argv[2];
if (!endpoint || !/^https:\/\/[^/]+\/webhook$/.test(endpoint)) {
  console.error('https:// で始まり /webhook で終わる URL を指定してください');
  process.exit(1);
}
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!channelAccessToken) {
  console.error('.env に LINE_CHANNEL_ACCESS_TOKEN がありません');
  process.exit(1);
}

const client = new messagingApi.MessagingApiClient({ channelAccessToken });

await client.setWebhookEndpoint({ endpoint });
const { active } = await client.getWebhookEndpoint();
const test = await client.testWebhookEndpoint({ endpoint });

console.log(`Webhook URL: ${endpoint}`);
console.log(`Webhook の利用: ${active ? 'オン' : 'オフ（LINE Developers の画面でオンにしてください）'}`);
console.log(
  test.success
    ? `接続テスト: 成功（${test.statusCode}）`
    : `接続テスト: 失敗（${test.statusCode} ${test.reason}）。サーバーが起きているか確認してください`,
);
process.exit(test.success ? 0 : 1);
