import type { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../config/env.validation.js';
import type { FaqArticle } from '../wordpress/wordpress.service.js';
import {
  AiService,
  NOT_FOUND_ANSWER,
  REFUSAL_ANSWER,
  buildSystemPrompt,
  describeClaudeError,
} from './ai.service.js';

const ARTICLES: FaqArticle[] = [
  {
    id: 9,
    title: '交通費の上限',
    content: '通勤交通費は、月額5万円まで支給します。',
    url: 'http://localhost:8080/commuting-allowance/',
  },
  {
    id: 4,
    title: '経費"精算"<ルール>',
    content: '申請は翌月10日まで。',
    url: 'http://localhost:8080/expense/',
  },
];

describe('buildSystemPrompt', () => {
  const prompt = buildSystemPrompt(ARTICLES);

  it('記事を <document> にして <documents> に入れる', () => {
    expect(prompt).toContain(
      '<documents>\n<document title="交通費の上限" url="http://localhost:8080/commuting-allowance/">\n通勤交通費は、月額5万円まで支給します。\n</document>',
    );
    expect(prompt.trimEnd().endsWith('</documents>')).toBe(true);
  });

  it('属性に入れるタイトルの " < & をエスケープする', () => {
    expect(prompt).toContain('title="経費&quot;精算&quot;&lt;ルール>"');
  });

  it('記事にない質問への答え方と、参照の付け方を指示する', () => {
    expect(prompt).toContain(`「${NOT_FOUND_ANSWER}」とだけ答えて`);
    expect(prompt).toContain('300字以内');
    expect(prompt).toContain('「参照：記事タイトル」');
  });
});

describe('AiService', () => {
  let service: AiService;
  let create: ReturnType<typeof vi.fn>;

  function respond(message: Partial<Anthropic.Message>) {
    create.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [],
      ...message,
    });
  }

  beforeEach(() => {
    const values: Record<string, string> = {
      ANTHROPIC_API_KEY: 'test-api-key',
      ANTHROPIC_MODEL: 'claude-haiku-5-5',
    };
    const config = {
      get: (key: string) => values[key],
    } as unknown as ConfigService<Env, true>;
    service = new AiService(config);

    // 実際の API は呼ばない
    create = vi.fn();
    (
      service as unknown as { client: { messages: { create: typeof create } } }
    ).client.messages.create = create;
  });

  it('記事入りの system プロンプトと質問を渡し、回答の文章を返す', async () => {
    respond({
      content: [
        { type: 'thinking', thinking: '', signature: 'sig' },
        { type: 'text', text: '月額5万円までです。\n参照：交通費の上限\n' },
      ] as Anthropic.ContentBlock[],
    });

    await expect(
      service.answer('交通費っていくらまで出る？', ARTICLES),
    ).resolves.toBe('月額5万円までです。\n参照：交通費の上限');
    expect(create).toHaveBeenCalledWith({
      model: 'claude-haiku-5-5',
      max_tokens: 16000,
      output_config: { effort: 'low' },
      system: buildSystemPrompt(ARTICLES),
      messages: [{ role: 'user', content: '交通費っていくらまで出る？' }],
    });
  });

  it('回答を断られたら（refusal）、決まった文を返す', async () => {
    respond({ stop_reason: 'refusal' });
    await expect(service.answer('質問', ARTICLES)).resolves.toBe(
      REFUSAL_ANSWER,
    );
  });

  it('回答の文章が空なら例外にする', async () => {
    respond({ stop_reason: 'max_tokens' });
    await expect(service.answer('質問', ARTICLES)).rejects.toThrow(
      'stop_reason: max_tokens',
    );
  });

  it('API のエラーは、原因がわかるメッセージの例外にする', async () => {
    create.mockRejectedValueOnce(
      new Anthropic.AuthenticationError(
        401,
        undefined,
        'invalid x-api-key',
        new Headers(),
      ),
    );
    await expect(service.answer('質問', ARTICLES)).rejects.toThrow(
      'Claude API キーが無効です（401）',
    );
  });
});

describe('describeClaudeError', () => {
  const headers = new Headers();

  it.each([
    [
      new Anthropic.APIConnectionTimeoutError(),
      'Claude API がタイムアウトしました',
    ],
    [
      new Anthropic.APIConnectionError({ message: 'ECONNRESET' }),
      'Claude API に接続できません',
    ],
    [
      new Anthropic.RateLimitError(429, undefined, 'rate limit', headers),
      '利用上限に達しました（429）',
    ],
    [
      new Anthropic.OverloadedError(529, undefined, 'overloaded', headers),
      '混雑しています（529）',
    ],
  ])('%s', (error, expected) => {
    expect(describeClaudeError(error)).toContain(expected);
  });

  it('そのほかの API エラーは、ステータスと API のメッセージを含める', () => {
    const error = new Anthropic.BadRequestError(
      400,
      undefined,
      'Your credit balance is too low',
      headers,
    );
    expect(describeClaudeError(error)).toMatch(
      /^Claude API でエラーが発生しました（400）: .*credit balance is too low/,
    );
  });

  it('API 以外のエラーはメッセージをそのまま返す', () => {
    expect(describeClaudeError(new Error('想定外'))).toBe('想定外');
  });
});
