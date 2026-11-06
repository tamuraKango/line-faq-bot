import { createHmac } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { messagingApi } from '@line/bot-sdk';
import { AppModule } from './../src/app.module.js';
import { FaqService } from './../src/faq/faq.service.js';

// vitest.config.e2e.ts の env で渡したテスト用の値
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;

function sign(body: string): string {
  return createHmac('sha256', CHANNEL_SECRET).update(body).digest('base64');
}

function messageEvent(message: Record<string, unknown>): string {
  return JSON.stringify({
    destination: 'U00000000000000000000000000000000',
    events: [
      {
        type: 'message',
        mode: 'active',
        timestamp: 0,
        source: { type: 'user', userId: 'U11111111111111111111111111111111' },
        webhookEventId: 'test-event',
        deliveryContext: { isRedelivery: false },
        replyToken: 'test-reply-token',
        message,
      },
    ],
  });
}

describe('POST /webhook (e2e)', () => {
  let app: INestApplication<App>;
  let replyMessage: ReturnType<typeof vi.spyOn>;
  let faqAnswer: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // 実際の LINE には送らない
    replyMessage = vi
      .spyOn(messagingApi.MessagingApiClient.prototype, 'replyMessage')
      .mockResolvedValue({ sentMessages: [] });
    vi.spyOn(
      messagingApi.MessagingApiClient.prototype,
      'showLoadingAnimation',
    ).mockResolvedValue({});
    // WordPress と Claude も呼ばない
    faqAnswer = vi
      .spyOn(FaqService.prototype, 'answer')
      .mockResolvedValue('月額5万円までです。\n参照：交通費の上限');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it('GET / は ok を返す（稼働確認と、デモ前に起こすため）', async () => {
    await request(app.getHttpServer()).get('/').expect(200).expect('ok');
  });

  it('署名ヘッダーがなければ 401', async () => {
    await request(app.getHttpServer())
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .send(messageEvent({ type: 'text', id: '1', text: 'こんにちは' }))
      .expect(401);
    expect(replyMessage).not.toHaveBeenCalled();
  });

  it('署名が不正なら 401', async () => {
    const body = messageEvent({ type: 'text', id: '1', text: 'こんにちは' });
    await request(app.getHttpServer())
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('x-line-signature', sign(body + '改ざん'))
      .send(body)
      .expect(401);
    expect(replyMessage).not.toHaveBeenCalled();
  });

  it('接続確認（events が空）には 200', async () => {
    const body = JSON.stringify({ destination: 'U0', events: [] });
    await request(app.getHttpServer())
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('x-line-signature', sign(body))
      .send(body)
      .expect(200);
  });

  it('テキストの質問には FAQ の回答を返す', async () => {
    const body = messageEvent({
      type: 'text',
      id: '1',
      text: '交通費っていくらまで出る？',
    });
    await request(app.getHttpServer())
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('x-line-signature', sign(body))
      .send(body)
      .expect(200);
    await vi.waitFor(() =>
      expect(replyMessage).toHaveBeenCalledWith({
        replyToken: 'test-reply-token',
        messages: [
          { type: 'text', text: '月額5万円までです。\n参照：交通費の上限' },
        ],
      }),
    );
    expect(faqAnswer).toHaveBeenCalledWith('交通費っていくらまで出る？');
  });

  it('回答を作れなかったら、時間をおいて試すよう返す', async () => {
    faqAnswer.mockRejectedValueOnce(new Error('WordPress に接続できません'));
    const body = messageEvent({ type: 'text', id: '1', text: '質問' });
    await request(app.getHttpServer())
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('x-line-signature', sign(body))
      .send(body)
      .expect(200);
    await vi.waitFor(() =>
      expect(replyMessage).toHaveBeenCalledWith({
        replyToken: 'test-reply-token',
        messages: [
          {
            type: 'text',
            text: 'ただいま回答できません。時間をおいてお試しください',
          },
        ],
      }),
    );
  });

  it('テキスト以外には定型文を返す', async () => {
    const body = messageEvent({
      type: 'sticker',
      id: '2',
      packageId: '1',
      stickerId: '1',
    });
    await request(app.getHttpServer())
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('x-line-signature', sign(body))
      .send(body)
      .expect(200);
    await vi.waitFor(() =>
      expect(replyMessage).toHaveBeenCalledWith({
        replyToken: 'test-reply-token',
        messages: [{ type: 'text', text: '文章で質問してください' }],
      }),
    );
    expect(faqAnswer).not.toHaveBeenCalled();
  });
});
