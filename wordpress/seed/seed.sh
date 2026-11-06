#!/bin/sh
# WordPress の初期設定とサンプルFAQ記事の投入。何度実行しても記事は重複しない
# posts/*.html は「1行目がタイトル、2行目以降が本文（HTML）」の形式
set -eu

# wordpress コンテナが wp-config.php を作るまで待つ
i=0
until [ -f /var/www/html/wp-config.php ]; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "wp-config.php が作られません。docker compose logs wordpress を確認してください" >&2
    exit 1
  fi
  sleep 2
done

if ! wp core is-installed 2>/dev/null; then
  wp core install \
    --url="http://localhost:8080" \
    --title="サンプル株式会社 社内FAQ" \
    --admin_user=admin \
    --admin_password="$WP_ADMIN_PASSWORD" \
    --admin_email=admin@example.com \
    --skip-email
  # 最初から入っている投稿「Hello world!」と固定ページ「Sample Page」を消す
  wp post delete 1 2 --force
  wp option update timezone_string Asia/Tokyo
fi

# REST API を /wp-json で使えるようにする
wp rewrite structure '/%postname%/'

for file in /seed/posts/*.html; do
  slug=$(basename "$file" .html | sed 's/^[0-9]*-//')
  title=$(head -n 1 "$file")
  tail -n +2 "$file" > /tmp/body.html

  id=$(wp post list --post_type=post --post_status=any --name="$slug" --field=ID)
  if [ -n "$id" ]; then
    wp post update "$id" /tmp/body.html --post_title="$title"
  else
    wp post create /tmp/body.html --post_type=post --post_status=publish \
      --post_name="$slug" --post_title="$title"
  fi
done

echo "投入済みの記事: $(wp post list --post_type=post --format=count) 件"
