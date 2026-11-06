import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service.js';
import { WordpressService } from '../wordpress/wordpress.service.js';

// 質問への回答を作る全体の流れ：WordPress から記事を取り、Claude に回答させる
@Injectable()
export class FaqService {
  constructor(
    private readonly wordpress: WordpressService,
    private readonly ai: AiService,
  ) {}

  async answer(question: string): Promise<string> {
    const articles = await this.wordpress.getArticles();
    return this.ai.answer(question, articles);
  }
}
