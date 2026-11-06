import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../config/env.validation.js';
import type { FaqArticle } from '../wordpress/wordpress.service.js';

export const NOT_FOUND_ANSWER =
  'FAQに見つかりませんでした。担当部署に確認してください';
// Claude の安全機能が回答を断ったとき（stop_reason: refusal）に返す文
export const REFUSAL_ANSWER =
  'この質問にはお答えできません。担当部署に確認してください';

const SYSTEM_PROMPT_HEADER = `あなたはサンプル株式会社の社内FAQ担当です。社員からの質問に、<documents> の中のFAQ記事だけを使って答えてください。

ルール:
- <documents> に書かれていないことは答えず、推測で補わないでください。該当する情報がなければ「${NOT_FOUND_ANSWER}」とだけ答えてください。
- 回答は300字以内で、LINE で読みやすいように短い文で書いてください。LINE では Markdown が表示されないので、** や # などの記号は使わないでください。
- 回答の最後に、改行して「参照：記事タイトル」を付けてください。複数の記事を使った場合は「参照：タイトル1、タイトル2」としてください。該当する情報がなかった場合は付けないでください。`;

// Claude API のエラーを、原因がわかる1行にする。キーなどの秘密情報は含まれない
export function describeClaudeError(error: unknown): string {
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return 'Claude API がタイムアウトしました';
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Claude API に接続できません';
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return 'Claude API キーが無効です（401）。.env の ANTHROPIC_API_KEY を確認してください';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Claude API の利用上限に達しました（429）。時間をおいて再試行してください';
  }
  if (error instanceof Anthropic.OverloadedError) {
    return 'Claude API が混雑しています（529）';
  }
  // クレジット不足などは 400 で返り、理由は API のメッセージに書かれている
  if (error instanceof Anthropic.APIError) {
    return `Claude API でエラーが発生しました（${error.status}）: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

// 記事を <documents> にまとめた system プロンプトを作る（設計書7章）
export function buildSystemPrompt(articles: FaqArticle[]): string {
  const documents = articles
    .map(
      (article) =>
        `<document title="${escapeAttribute(article.title)}" url="${escapeAttribute(article.url)}">\n${article.content}\n</document>`,
    )
    .join('\n');
  return `${SYSTEM_PROMPT_HEADER}\n\n<documents>\n${documents}\n</documents>`;
}

@Injectable()
export class AiService {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(config: ConfigService<Env, true>) {
    this.client = new Anthropic({
      apiKey: config.get('ANTHROPIC_API_KEY', { infer: true }),
      // LINE の返信が遅れすぎないように、既定の10分より短くする
      timeout: 30 * 1000,
    });
    this.model = config.get('ANTHROPIC_MODEL', { infer: true });
  }

  async answer(question: string, articles: FaqArticle[]): Promise<string> {
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 16000,
        // 短い Q&A なので、思考を浅くして速さと料金を抑える
        output_config: { effort: 'low' },
        system: buildSystemPrompt(articles),
        messages: [{ role: 'user', content: question }],
      });
    } catch (error) {
      throw new Error(describeClaudeError(error), { cause: error });
    }

    if (response.stop_reason === 'refusal') {
      return REFUSAL_ANSWER;
    }
    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
    if (text === '') {
      throw new Error(
        `Claude の回答が空でした（stop_reason: ${response.stop_reason}）`,
      );
    }
    return text;
  }
}
