"""Rug sizes for Shopify rug vendors, from each product's size options (products.json)."""
import json, os, time, requests
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
V = {'dalyn': 'https://dalyn.com', 'karastan': 'https://www.karastanrugs.com', 'oriental-weavers': 'https://owrugs.com'}
H = {'User-Agent': 'Mozilla/5.0'}
for k, b in V.items():
    out = {}; page = 1
    while True:
        r = requests.get(f'{b}/products.json?limit=250&page={page}', headers=H, timeout=60)
        ps = r.json().get('products', []) if r.ok else []
        if not ps: break
        for p in ps:
            vals = []
            for o in p.get('options') or []:
                if (o.get('name') or '').lower() in ('size', 'sizes', 'rug size'): vals += o.get('values') or []
            if vals: out[f"{b}/products/{p['handle']}"] = ' | '.join(v for v in vals if 'sample' not in v.lower() and 'custom' not in v.lower())
        page += 1; time.sleep(0.4)
    json.dump(out, open(f'{D}/dims-{k}.json', 'w')); print(k, len(out))
