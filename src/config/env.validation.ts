// 環境変数の型とバリデーション。足りない値があれば起動時にエラーで止める
export interface Env {
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
  // WordPress REST API の wp/v2 までの URL（末尾の / なし）
  WP_API_URL: string;
  PORT: number;
  NODE_ENV: string;
}

const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-5-5';
const DEFAULT_WP_BASE_URL = 'http://localhost:8080';

const REQUIRED_KEYS = [
  'LINE_CHANNEL_SECRET',
  'LINE_CHANNEL_ACCESS_TOKEN',
  'ANTHROPIC_API_KEY',
] as const;

function isSet(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

// http(s) の URL か確かめ、末尾の / を外して後ろにパスをつなげやすくする
function readUrl(name: string, value: string): string {
  if (!/^https?:\/\/[^/]/.test(value) || !URL.canParse(value)) {
    throw new Error(
      `環境変数 ${name} は http:// か https:// で始まる URL で指定してください`,
    );
  }
  return value.replace(/\/+$/, '');
}

export function validateEnv(config: Record<string, unknown>): Env {
  // エラーメッセージには変数名だけを出し、値（秘密情報）は出さない
  const missing = REQUIRED_KEYS.filter(
    (key) => typeof config[key] !== 'string' || config[key] === '',
  );
  if (missing.length > 0) {
    throw new Error(`環境変数が設定されていません: ${missing.join(', ')}`);
  }

  const port = Number(config.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('環境変数 PORT は正の整数で指定してください');
  }

  // WordPress.com のように API の場所がサイトの URL と違うときは WP_API_URL で指定する
  const wpApiUrl = isSet(config.WP_API_URL)
    ? readUrl('WP_API_URL', config.WP_API_URL)
    : `${readUrl('WP_BASE_URL', isSet(config.WP_BASE_URL) ? config.WP_BASE_URL : DEFAULT_WP_BASE_URL)}/wp-json/wp/v2`;

  return {
    LINE_CHANNEL_SECRET: config.LINE_CHANNEL_SECRET as string,
    LINE_CHANNEL_ACCESS_TOKEN: config.LINE_CHANNEL_ACCESS_TOKEN as string,
    ANTHROPIC_API_KEY: config.ANTHROPIC_API_KEY as string,
    ANTHROPIC_MODEL: isSet(config.ANTHROPIC_MODEL)
      ? config.ANTHROPIC_MODEL
      : DEFAULT_ANTHROPIC_MODEL,
    WP_API_URL: wpApiUrl,
    PORT: port,
    // 未設定のときは本番扱いにして、質問本文をログに出さない
    NODE_ENV:
      typeof config.NODE_ENV === 'string' ? config.NODE_ENV : 'production',
  };
}
