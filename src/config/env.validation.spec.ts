import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  const base = {
    LINE_CHANNEL_SECRET: 'secret',
    LINE_CHANNEL_ACCESS_TOKEN: 'token',
  };

  it('必須の値がそろっていれば、既定値を補って返す', () => {
    expect(validateEnv(base)).toEqual({
      ...base,
      WP_BASE_URL: 'http://localhost:8080',
      PORT: 3000,
      NODE_ENV: 'production',
    });
  });

  it('WP_BASE_URL の末尾の / を外す', () => {
    expect(
      validateEnv({ ...base, WP_BASE_URL: 'https://wp.example.com/' })
        .WP_BASE_URL,
    ).toBe('https://wp.example.com');
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
      '環境変数が設定されていません: LINE_CHANNEL_ACCESS_TOKEN',
    );
  });

  it('PORT が数値でなければエラーにする', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow('PORT');
  });
});
