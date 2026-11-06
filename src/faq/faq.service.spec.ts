import type { AiService } from '../ai/ai.service.js';
import type {
  FaqArticle,
  WordpressService,
} from '../wordpress/wordpress.service.js';
import { FaqService } from './faq.service.js';

const ARTICLES: FaqArticle[] = [
  { id: 1, title: 'タイトル', content: '本文', url: 'http://wp.test/a/' },
];

describe('FaqService', () => {
  it('WordPress の記事と質問を AiService に渡し、その回答を返す', async () => {
    const wordpress = { getArticles: vi.fn().mockResolvedValue(ARTICLES) };
    const ai = { answer: vi.fn().mockResolvedValue('回答') };
    const service = new FaqService(
      wordpress as unknown as WordpressService,
      ai as unknown as AiService,
    );

    await expect(service.answer('質問')).resolves.toBe('回答');
    expect(ai.answer).toHaveBeenCalledWith('質問', ARTICLES);
  });

  it('記事の取得に失敗したら、Claude は呼ばずに例外にする', async () => {
    const wordpress = {
      getArticles: vi.fn().mockRejectedValue(new Error('HTTP 500')),
    };
    const ai = { answer: vi.fn() };
    const service = new FaqService(
      wordpress as unknown as WordpressService,
      ai as unknown as AiService,
    );

    await expect(service.answer('質問')).rejects.toThrow('HTTP 500');
    expect(ai.answer).not.toHaveBeenCalled();
  });
});
