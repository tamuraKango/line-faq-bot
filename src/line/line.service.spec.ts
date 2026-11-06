import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { webhook } from '@line/bot-sdk';
import type { Env } from '../config/env.validation.js';
import type { FaqService } from '../faq/faq.service.js';
import {
  LineService,
  MAX_TEXT_LENGTH,
  NON_TEXT_REPLY,
  UNAVAILABLE_REPLY,
  truncateForLine,
} from './line.service.js';

function messageEvent(
  message: Record<string, unknown>,
  source: Record<string, unknown> = { type: 'user', userId: 'U-user' },
): webhook.Event {
  return {
    type: 'message',
    mode: 'active',
    timestamp: 0,
    source,
    webhookEventId: 'event-id',
    deliveryContext: { isRedelivery: false },
    replyToken: 'reply-token',
    message,
  } as unknown as webhook.Event;
}

const textEvent = (text: string) =>
  messageEvent({ type: 'text', id: '1', text });

describe('LineService', () => {
  let faq: { answer: ReturnType<typeof vi.fn> };
  let replyMessage: ReturnType<typeof vi.fn>;
  let showLoadingAnimation: ReturnType<typeof vi.fn>;
  let debugLog: ReturnType<typeof vi.spyOn>;
  let errorLog: ReturnType<typeof vi.spyOn>;
  let warnLog: ReturnType<typeof vi.spyOn>;

  function createService(nodeEnv = 'development'): LineService {
    const values: Record<string, string> = {
      LINE_CHANNEL_SECRET: 'secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'token',
      NODE_ENV: nodeEnv,
    };
    const config = {
      get: (key: string) => values[key],
    } as unknown as ConfigService<Env, true>;
    const service = new LineService(config, faq as unknown as FaqService);

    // 実際の LINE には送らない
    const client = (
      service as unknown as {
        client: Record<string, ReturnType<typeof vi.fn>>;
      }
    ).client;
    client.replyMessage = replyMessage;
    client.showLoadingAnimation = showLoadingAnimation;
    return service;
  }

  function repliedText(): string {
    return replyMessage.mock.calls[0][0].messages[0].text;
  }

  beforeEach(() => {
    faq = { answer: vi.fn().mockResolvedValue('回答です') };
    replyMessage = vi.fn().mockResolvedValue({ sentMessages: [] });
    showLoadingAnimation = vi.fn().mockResolvedValue({});
    debugLog = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    warnLog = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('テキストには、入力中を表示してから FAQ の回答を返す', async () => {
    await createService().handleEvents([textEvent('交通費は？')]);

    expect(showLoadingAnimation).toHaveBeenCalledWith({
      chatId: 'U-user',
      loadingSeconds: 45,
    });
    expect(faq.answer).toHaveBeenCalledWith('交通費は？');
    expect(replyMessage).toHaveBeenCalledWith({
      replyToken: 'reply-token',
      messages: [{ type: 'text', text: '回答です' }],
    });
  });

  it('グループのトークでは入力中を表示しない', async () => {
    await createService().handleEvents([
      messageEvent(
        { type: 'text', id: '1', text: '質問' },
        { type: 'group', groupId: 'G-group', userId: 'U-user' },
      ),
    ]);

    expect(showLoadingAnimation).not.toHaveBeenCalled();
    expect(repliedText()).toBe('回答です');
  });

  it('テキスト以外には、FAQ を呼ばずに定型文を返す', async () => {
    await createService().handleEvents([
      messageEvent({
        type: 'sticker',
        id: '2',
        packageId: '1',
        stickerId: '1',
      }),
    ]);

    expect(faq.answer).not.toHaveBeenCalled();
    expect(showLoadingAnimation).not.toHaveBeenCalled();
    expect(repliedText()).toBe(NON_TEXT_REPLY);
  });

  it('メッセージ以外のイベント（友だち追加など）には返信しない', async () => {
    await createService().handleEvents([
      { type: 'follow', replyToken: 'reply-token' } as unknown as webhook.Event,
    ]);

    expect(replyMessage).not.toHaveBeenCalled();
  });

  it('回答を作れなかったら、原因をログに出して定型文を返す', async () => {
    faq.answer.mockRejectedValue(
      new Error('Claude API が混雑しています（529）'),
    );
    await createService().handleEvents([textEvent('質問')]);

    expect(repliedText()).toBe(UNAVAILABLE_REPLY);
    expect(errorLog).toHaveBeenCalledWith(
      '回答の作成に失敗しました: Claude API が混雑しています（529）',
    );
  });

  it('入力中の表示に失敗しても、回答は返す', async () => {
    showLoadingAnimation.mockRejectedValue(new Error('400'));
    await createService().handleEvents([textEvent('質問')]);

    expect(repliedText()).toBe('回答です');
    expect(warnLog).toHaveBeenCalledWith('入力中の表示に失敗しました: 400');
  });

  it('LINE への返信に失敗しても例外を投げず、ログを出す', async () => {
    replyMessage.mockRejectedValue(new Error('Invalid reply token'));

    await expect(
      createService().handleEvents([textEvent('質問')]),
    ).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith(
      '返信に失敗しました: Invalid reply token',
    );
  });

  it('開発時だけ、質問の本文をログに出す', async () => {
    await createService('development').handleEvents([textEvent('秘密の質問')]);
    expect(debugLog).toHaveBeenCalledWith('受信: 秘密の質問');

    debugLog.mockClear();
    await createService('production').handleEvents([textEvent('秘密の質問')]);
    expect(debugLog).not.toHaveBeenCalled();
  });

  it('5000文字を超える回答は切り詰めて返す', async () => {
    faq.answer.mockResolvedValue('あ'.repeat(MAX_TEXT_LENGTH + 10));
    await createService().handleEvents([textEvent('質問')]);

    expect(Array.from(repliedText())).toHaveLength(MAX_TEXT_LENGTH);
  });
});

describe('truncateForLine', () => {
  it('5000文字ちょうどならそのまま返す', () => {
    const text = 'あ'.repeat(MAX_TEXT_LENGTH);
    expect(truncateForLine(text)).toBe(text);
  });

  it('超えたら末尾を「…」にして5000文字にする', () => {
    const result = truncateForLine('あ'.repeat(MAX_TEXT_LENGTH + 1));
    expect(Array.from(result)).toHaveLength(MAX_TEXT_LENGTH);
    expect(result.endsWith('あ…')).toBe(true);
  });

  it('絵文字を途中で切らない', () => {
    const result = truncateForLine('😀'.repeat(MAX_TEXT_LENGTH + 1));
    expect(Array.from(result)).toHaveLength(MAX_TEXT_LENGTH);
    expect(result.endsWith('😀…')).toBe(true);
  });
});
