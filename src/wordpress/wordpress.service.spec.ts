import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation.js';
import { WordpressService } from './wordpress.service.js';

const POSTS = [
  {
    id: 4,
    title: { rendered: '経費精算&amp;旅費のルール' },
    content: { rendered: '<p>申請は<strong>翌月10日</strong>まで。</p>\n' },
    link: 'http://wp.test/expense/',
  },
];

describe('WordpressService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let service: WordpressService;

  beforeEach(() => {
    vi.useFakeTimers();
    // Response の本文は1回しか読めないので、呼ばれるたびに作り直す
    fetchMock = vi.fn(() => Promise.resolve(Response.json(POSTS)));
    vi.stubGlobal('fetch', fetchMock);

    const config = {
      get: () => 'http://wp.test',
    } as unknown as ConfigService<Env, true>;
    service = new WordpressService(config);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('記事を取得し、タイトルと本文をプレーンテキストにする', async () => {
    await expect(service.getArticles()).resolves.toEqual([
      {
        id: 4,
        title: '経費精算&旅費のルール',
        content: '申請は翌月10日まで。',
        url: 'http://wp.test/expense/',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://wp.test/wp-json/wp/v2/posts?per_page=100&_fields=id,title,content,link',
      expect.anything(),
    );
  });

  it('5分以内はキャッシュを返し、5分を過ぎたら取り直す', async () => {
    await service.getArticles();
    vi.advanceTimersByTime(5 * 60 * 1000 - 1);
    await service.getArticles();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    await service.getArticles();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('接続できなければ、起動を確認するよう案内する例外にする', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.reject(new TypeError('fetch failed')),
    );
    await expect(service.getArticles()).rejects.toThrow(
      'WordPress に接続できません',
    );
  });

  it('タイムアウトしたら、そのことがわかる例外にする', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.reject(new DOMException('timed out', 'TimeoutError')),
    );
    await expect(service.getArticles()).rejects.toThrow('タイムアウト');
  });

  it('HTTP エラーなら例外にし、キャッシュしない', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(new Response('error', { status: 500 })),
    );
    await expect(service.getArticles()).rejects.toThrow('HTTP 500');

    await service.getArticles();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
