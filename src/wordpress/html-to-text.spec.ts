import { decodeEntities, htmlToText } from './html-to-text.js';

describe('htmlToText', () => {
  it('タグを取り除き、段落ごとに改行する', () => {
    expect(
      htmlToText(
        '<p>業務で立て替えた費用は、<strong>経費精算システム</strong>から申請してください。</p>\n<p>不明点は経理部へ。</p>\n',
      ),
    ).toBe(
      '業務で立て替えた費用は、経費精算システムから申請してください。\n不明点は経理部へ。',
    );
  });

  it('箇条書きは「・」で始まる行にする', () => {
    expect(
      htmlToText(
        '<ul>\n<li>申請期限：翌月10日</li>\n<li>領収書を添付</li>\n</ul>',
      ),
    ).toBe('・申請期限：翌月10日\n・領収書を添付');
  });

  it('<br> を改行にする', () => {
    expect(htmlToText('1行目<br>2行目<br />3行目')).toBe('1行目\n2行目\n3行目');
  });

  it('script と style は中身ごと取り除く', () => {
    expect(
      htmlToText(
        '<style>p{color:red}</style><p>本文</p><script>alert(1)</script>',
      ),
    ).toBe('本文');
  });

  it('文字参照を元に戻す', () => {
    expect(htmlToText('<p>A&amp;B &#8217;x&#8217; &#x3042; &yen;100</p>')).toBe(
      'A&B ’x’ あ ¥100',
    );
  });

  it('本文中の「&lt;b&gt;」はタグとして消さず、文字として残す', () => {
    expect(htmlToText('<p>&lt;b&gt;は太字のタグです</p>')).toBe(
      '<b>は太字のタグです',
    );
  });

  it('連続する空白をまとめ、空行を取り除く', () => {
    expect(htmlToText('<p>  A  &nbsp; B  </p>\n\n\n<p></p><p>C</p>')).toBe(
      'A B\nC',
    );
  });
});

describe('decodeEntities', () => {
  it('知らない参照や範囲外の数値はそのまま残す', () => {
    expect(decodeEntities('&unknown; &#99999999;')).toBe(
      '&unknown; &#99999999;',
    );
  });
});
