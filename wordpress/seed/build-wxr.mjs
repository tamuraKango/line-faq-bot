// posts/*.html から、WordPress のインポート用ファイル（WXR）を作る
// WP-CLI が使えない WordPress.com で、管理画面の「インポート」から読み込むために使う
// 使い方: npm run seed:wxr  → wordpress/seed/faq-import.xml ができる
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const postsDir = join(here, 'posts');
const outFile = join(here, 'faq-import.xml');

// CDATA の中に「]]>」があると閉じてしまうので、分割して入れる
const cdata = (text) => `<![CDATA[${text.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;

const files = readdirSync(postsDir)
  .filter((name) => name.endsWith('.html'))
  .sort();

const items = files.map((name, index) => {
  // seed.sh と同じ形式：1行目がタイトル、2行目以降が本文。スラッグは先頭の番号を外したファイル名
  const [title, ...body] = readFileSync(join(postsDir, name), 'utf8').split('\n');
  const slug = basename(name, '.html').replace(/^[0-9]*-/, '');
  // 番号順に並ぶように、1分ずつずらした投稿日時にする
  const date = new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString().slice(0, 19).replace('T', ' ');
  return `    <item>
      <title>${cdata(title.trim())}</title>
      <dc:creator>${cdata('admin')}</dc:creator>
      <content:encoded>${cdata(body.join('\n').trim())}</content:encoded>
      <excerpt:encoded>${cdata('')}</excerpt:encoded>
      <wp:post_id>${index + 1}</wp:post_id>
      <wp:post_date>${cdata(date)}</wp:post_date>
      <wp:post_date_gmt>${cdata(date)}</wp:post_date_gmt>
      <wp:post_name>${cdata(slug)}</wp:post_name>
      <wp:status>${cdata('publish')}</wp:status>
      <wp:post_type>${cdata('post')}</wp:post_type>
    </item>`;
});

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/">
  <channel>
    <title>サンプル株式会社 社内FAQ</title>
    <language>ja</language>
    <wp:wxr_version>1.2</wp:wxr_version>
${items.join('\n')}
  </channel>
</rss>
`;

writeFileSync(outFile, xml);
console.log(`${files.length} 件の記事を書き出しました: ${outFile}`);
