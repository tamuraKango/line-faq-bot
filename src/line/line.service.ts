import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { messagingApi, validateSignature, webhook } from '@line/bot-sdk';
import type { Env } from '../config/env.validation.js';

const NON_TEXT_REPLY = '文章で質問してください';

@Injectable()
export class LineService {
  private readonly logger = new Logger(LineService.name);
  private readonly client: messagingApi.MessagingApiClient;
  private readonly channelSecret: string;
  private readonly isDevelopment: boolean;

  constructor(config: ConfigService<Env, true>) {
    this.channelSecret = config.get('LINE_CHANNEL_SECRET', { infer: true });
    this.isDevelopment =
      config.get('NODE_ENV', { infer: true }) === 'development';
    this.client = new messagingApi.MessagingApiClient({
      channelAccessToken: config.get('LINE_CHANNEL_ACCESS_TOKEN', {
        infer: true,
      }),
    });
  }

  // x-line-signature が、受け取った生のリクエストボディと一致するか確認する
  verifySignature(rawBody: Buffer, signature: string): boolean {
    return validateSignature(rawBody, this.channelSecret, signature);
  }

  // 失敗してもイベントごとにログを出すだけで、呼び出し元には例外を投げない
  async handleEvents(events: webhook.Event[]): Promise<void> {
    await Promise.all(events.map((event) => this.handleEvent(event)));
  }

  private async handleEvent(event: webhook.Event): Promise<void> {
    if (event.type !== 'message' || !event.replyToken) {
      return;
    }

    const message = event.message;
    if (message.type === 'text' && this.isDevelopment) {
      this.logger.debug(`受信: ${message.text}`);
    }
    // Phase 1 はオウム返し。テキスト以外には定型文を返す
    const replyText = message.type === 'text' ? message.text : NON_TEXT_REPLY;

    try {
      await this.client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: replyText }],
      });
    } catch (error) {
      // エラーオブジェクト全体はリクエスト情報を含みうるので、メッセージだけを出す
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`返信に失敗しました: ${reason}`);
    }
  }
}
