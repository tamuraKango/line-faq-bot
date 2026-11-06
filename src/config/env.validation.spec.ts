import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  const base = {
    LINE_CHANNEL_SECRET: 'secret',
    LINE_CHANNEL_ACCESS_TOKEN: 'token',
    ANTHROPIC_API_KEY: 'api-key',
  };

  it('必須の値がそろっていれば、既定値を補って返す', () => {
    expect(validateEnv(base)).toEqual({
      ...base,
      ANTHROPIC_MODEL: 'claude-haiku-5-5',
      WP_API_URL: 'http://localhost:8080/wp-json/wp/v2',
      PORT: 3000,
      NODE_ENV: 'production',
    });
  });

  it('ANTHROPIC_MODEL を指定すればその値を使う', () => {
    expect(
      validateEnv({ ...base, ANTHROPIC_MODEL: 'claude-sonnet-5-5' })
        .ANTHROPIC_MODEL,
    ).toBe('claude-sonnet-5-5');
  });

  it('WP_BASE_URL から REST API の URL を作る（末尾の / は外す）', () => {
    expect(
      validateEnv({ ...base, WP_BASE_URL: 'https://wp.example.com/' })
        .WP_API_URL,
    ).toBe('https://wp.example.com/wp-json/wp/v2');
  });

  it('WP_API_URL を指定すれば、WP_BASE_URL より優先する', () => {
    expect(
      validateEnv({
        ...base,
        WP_BASE_URL: 'https://wp.example.com',
        WP_API_URL:
          'https://public-api.wordpress.com/wp/v2/sites/sample.wordpress.com/',
      }).WP_API_URL,
    ).toBe('https://public-api.wordpress.com/wp/v2/sites/sample.wordpress.com');
  });

  it('WP_API_URL が URL でなければエラーにする', () => {
    expect(() => validateEnv({ ...base, WP_API_URL: 'sample' })).toThrow(
      'WP_API_URL',
    );
  });

  it('WP_BASE_URL が URL でなければエラーにする', () => {
    expect(() =>
      validateEnv({ ...base, WP_BASE_URL: 'localhost:8080' }),
    ).toThrow('WP_BASE_URL');
  });

  it('PORT を数値に変換する', () => {
    expect(validateEnv({ ...base, PORT: '8000' }).PORT).toBe(8000);
  });

  it('必須の値が足りなければ、変数名だけを含むエラーにする', () => {
    expect(() => validateEnv({ LINE_CHANNEL_SECRET: 'secret' })).toThrow(
      '環境変数が設定されていません: LINE_CHANNEL_ACCESS_TOKEN, ANTHROPIC_API_KEY',
    );
  });

  it('PORT が数値でなければエラーにする', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow('PORT');
  });
});
