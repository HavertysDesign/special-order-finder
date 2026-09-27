while IFS='|' read name url; do
  h=tmp/h; s=tmp/s; p=tmp/p
  r=$(curl -sL -m 25 -o $h -w "%{http_code} %{url_effective}" -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124" "$url/")
  gen=$(grep -oiE 'cdn\.shopify|woocommerce|wp-content|magento|bigcommerce|__NEXT_DATA__|wix\.com|squarespace|salesforce|demandware|nuxt|sitecore|umbraco' $h | tr A-Z a-z | sort -u | tr '\n' ',')
  base=$(echo "$r" | awk '{print $2}' | sed -E 's#(https?://[^/]+).*#\1#')
  rb=$(curl -sL -m 20 -A "Mozilla/5.0" "$base/robots.txt" | grep -i sitemap | head -3 | tr -d '\r' | tr '\n' ' ')
  pj=$(curl -sL -m 20 -o $p -w "%{http_code}" -A "Mozilla/5.0" "$base/products.json?limit=1"); pjok=$(head -c 14 $p | tr -d '\n')
  echo "$name | $r | $gen | robots: $rb | pj $pj $pjok"
done < vendors.txt
