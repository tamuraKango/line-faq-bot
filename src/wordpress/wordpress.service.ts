import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation.js';
import { decodeEntities, htmlToText } from './html-to-text.js';

export interface FaqArticle {
  id: number;
  title: string;
  content: string;
  url: string;
}

// REST API の _fields で絞った、記事1件の形
interface WpPost {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  link: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10 * 1000;

@Injectable()
export class WordpressService {
  private readonly postsUrl: string;
  private cache?: { articles: FaqArticle[]; expiresAt: number };

  constructor(config: ConfigService<Env, true>) {
    const baseUrl = config.get('WP_BASE_URL', { infer: true });
    this.postsUrl = `${baseUrl}/wp-json/wp/v2/posts?per_page=100&_fields=id,title,content,link`;
  }

  // 記事の数が少ない前提で全件を返す。取得結果は5分間使い回す
  async getArticles(): Promise<FaqArticle[]> {
    const now = Date.now();
    if (this.cache && now < this.cache.expiresAt) {
      return this.cache.articles;
    }

    let response: Response;
    try {
      response = await fetch(this.postsUrl, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut =
        error instanceof DOMException && error.name === 'TimeoutError';
      throw new Error(
        timedOut
          ? `WordPress の応答がありません（${REQUEST_TIMEOUT_MS / 1000}秒でタイムアウト）`
          : `WordPress に接続できません（${this.postsUrl}）。docker compose up -d で起動しているか確認してください`,
        { cause: error },
      );
    }
    if (!response.ok) {
      throw new Error(
        `WordPress から記事を取得できませんでした（HTTP ${response.status}）`,
      );
    }
    const posts = (await response.json()) as WpPost[];

    const articles = posts.map((post) => ({
      id: post.id,
      title: decodeEntities(post.title.rendered.replace(/<[^>]*>/g, '')),
      content: htmlToText(post.content.rendered),
      url: post.link,
    }));
    this.cache = { articles, expiresAt: now + CACHE_TTL_MS };
    return articles;
  }
}
