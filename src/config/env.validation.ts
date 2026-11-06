// 環境変数の型とバリデーション。足りない値があれば起動時にエラーで止める
export interface Env {
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
  WP_BASE_URL: string;
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

  const wpBaseUrl =
    typeof config.WP_BASE_URL === 'string' && config.WP_BASE_URL !== ''
      ? config.WP_BASE_URL
      : DEFAULT_WP_BASE_URL;
  if (!/^https?:\/\/[^/]/.test(wpBaseUrl) || !URL.canParse(wpBaseUrl)) {
    throw new Error(
      '環境変数 WP_BASE_URL は http:// か https:// で始まる URL で指定してください',
    );
  }

  return {
    LINE_CHANNEL_SECRET: config.LINE_CHANNEL_SECRET as string,
    LINE_CHANNEL_ACCESS_TOKEN: config.LINE_CHANNEL_ACCESS_TOKEN as string,
    ANTHROPIC_API_KEY: config.ANTHROPIC_API_KEY as string,
    ANTHROPIC_MODEL:
      typeof config.ANTHROPIC_MODEL === 'string' &&
      config.ANTHROPIC_MODEL !== ''
        ? config.ANTHROPIC_MODEL
        : DEFAULT_ANTHROPIC_MODEL,
    // 末尾の / は外し、後ろにパスをつなげやすくする
    WP_BASE_URL: wpBaseUrl.replace(/\/+$/, ''),
    PORT: port,
    // 未設定のときは本番扱いにして、質問本文をログに出さない
    NODE_ENV:
      typeof config.NODE_ENV === 'string' ? config.NODE_ENV : 'production',
  };
}
