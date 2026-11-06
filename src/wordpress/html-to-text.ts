// WordPress の本文（HTML）を、Claude に渡すためのプレーンテキストにする

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  yen: '¥',
  copy: '©',
};

// &amp; や &#8217; などの文字参照を元の文字に戻す。知らない参照はそのまま残す
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, ref: string) => {
    if (ref.startsWith('#')) {
      const isHex = ref[1] === 'x' || ref[1] === 'X';
      const codePoint = Number.parseInt(
        ref.slice(isHex ? 2 : 1),
        isHex ? 16 : 10,
      );
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? match;
  });
}

export function htmlToText(html: string): string {
  const withoutTags = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n・')
    // ブロック要素の終わりで改行し、段落や箇条書きの区切りを残す
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, '');

  // タグを消したあとに戻すので、本文中の「&lt;b&gt;」は文字の <b> として残る
  return decodeEntities(withoutTags)
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n');
}
