import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { messagingApi, validateSignature, webhook } from '@line/bot-sdk';
import type { Env } from '../config/env.validation.js';
import { FaqService } from '../faq/faq.service.js';

export const NON_TEXT_REPLY = '文章で質問してください';
export const UNAVAILABLE_REPLY =
  'ただいま回答できません。時間をおいてお試しください';

// LINE のテキストメッセージは5000文字まで
export const MAX_TEXT_LENGTH = 5000;
// 回答が届くと自動で消えるので、Claude と WordPress のタイムアウトより長めにする
const LOADING_SECONDS = 45;

export function truncateForLine(text: string): string {
  // 絵文字などのサロゲートペアを途中で切らないように、コードポイント単位で数える
  const chars = Array.from(text);
  return chars.length <= MAX_TEXT_LENGTH
    ? text
    : `${chars.slice(0, MAX_TEXT_LENGTH - 1).join('')}…`;
}

// エラーオブジェクト全体はリクエスト情報を含みうるので、メッセージだけをログに出す
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class LineService {
  private readonly logger = new Logger(LineService.name);
  private readonly client: messagingApi.MessagingApiClient;
  private readonly channelSecret: string;
  private readonly isDevelopment: boolean;

  constructor(
    config: ConfigService<Env, true>,
    private readonly faq: FaqService,
  ) {
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

    let replyText = NON_TEXT_REPLY;
    if (event.message.type === 'text') {
      // 回答を作っている数秒のあいだ、トーク画面に「入力中」を出す（1対1のトークのみ）
      if (event.source?.type === 'user' && event.source.userId) {
        void this.showLoading(event.source.userId);
      }
      replyText = await this.answer(event.message.text);
    }

    try {
      await this.client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: truncateForLine(replyText) }],
      });
    } catch (error) {
      this.logger.error(`返信に失敗しました: ${errorMessage(error)}`);
    }
  }

  // 表示に失敗しても回答には影響しないので、警告を出すだけにする
  private async showLoading(userId: string): Promise<void> {
    try {
      await this.client.showLoadingAnimation({
        chatId: userId,
        loadingSeconds: LOADING_SECONDS,
      });
    } catch (error) {
      this.logger.warn(`入力中の表示に失敗しました: ${errorMessage(error)}`);
    }
  }

  // 回答を作れなかったときも、利用者には定型文を返す
  private async answer(question: string): Promise<string> {
    if (this.isDevelopment) {
      this.logger.debug(`受信: ${question}`);
    }
    try {
      return await this.faq.answer(question);
    } catch (error) {
      this.logger.error(`回答の作成に失敗しました: ${errorMessage(error)}`);
      return UNAVAILABLE_REPLY;
    }
  }
}
