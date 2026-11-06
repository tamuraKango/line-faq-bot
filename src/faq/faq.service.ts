import { Injectable, Logger } from '@nestjs/common';
import { AiService, NOT_FOUND_ANSWER } from '../ai/ai.service.js';
import { WordpressService } from '../wordpress/wordpress.service.js';

// 質問への回答を作る全体の流れ：WordPress から記事を取り、Claude に回答させる
@Injectable()
export class FaqService {
  private readonly logger = new Logger(FaqService.name);

  constructor(
    private readonly wordpress: WordpressService,
    private readonly ai: AiService,
  ) {}

  async answer(question: string): Promise<string> {
    const articles = await this.wordpress.getArticles();
    // 記事がなければ答えようがないので、Claude を呼ばずに返す
    if (articles.length === 0) {
      this.logger.warn(
        'WordPress に記事がありません。npm run seed を実行してください',
      );
      return NOT_FOUND_ANSWER;
    }
    return this.ai.answer(question, articles);
  }
}
