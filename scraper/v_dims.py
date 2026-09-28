"""Fill in missing dimensions by reading each product's own page (only for vendors whose
catalog feed has no sizes). Results are cached in data/dims-<vendor>.json so each weekly run
only fetches new products."""
import sys, os, json, re, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from concurrent.futures import ThreadPoolExecutor
from common import sess, H
from dims import parse
from bs4 import BeautifulSoup
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
VENDORS = sys.argv[1:] or ['four-hands', 'hooker', 'global-views', 'jamie-young', 'dw-silks', 'harp-finial', 'jonathan-louis', 'ann-gish', 'wendover', 'surya']
def load(v):
    for ext in ('.json', '.jsonl'):
        p = f'{D}/{v}{ext}'
        if os.path.exists(p):
            return json.load(open(p)) if ext == '.json' else [json.loads(l) for l in open(p) if l.strip()]
    return []
def fetch(url, maxbytes=400_000):
    for i in range(2):
        try:
            r = sess().get(url, timeout=40, stream=True)
            if r.status_code != 200: return ''
            buf = b''
            for ch in r.iter_content(65536):
                buf += ch
                if len(buf) > maxbytes: break
            r.close(); return buf.decode('utf8', 'ignore')
        except Exception: time.sleep(2)
    return ''
def extract(v, raw):
    m = re.search(r'dimensionsImperial(?:&quot;|")\s*:\s*(?:&quot;|")(.*?)(?:&quot;|")\s*,', raw)
    if m: return m.group(1).replace('\\u0022', '"')
    raw2 = raw.replace('\\u0022', '"').replace('&quot;', '"')
    m = re.search(r'"Dimensions"\s*:\s*"([^"]+)"', raw2)
    if m: return m.group(1)
    s = BeautifulSoup(raw, 'lxml')
    _t = re.sub(r'\s+', ' ', s.get_text(' '))
    _rs = re.findall(r"\d{1,2}\s*'\s*(?:\d{1,2}\s*(?:\"|”))?\s*[xX×]\s*\d{1,2}\s*'\s*(?:\d{1,2}\s*(?:\"|”))?", _t)
    if len(set(_rs)) >= 2: return ' | '.join(dict.fromkeys(x.strip() for x in _rs[:16]))
    for x in s(['script', 'style', 'noscript', 'header', 'footer', 'nav']): x.decompose()
    for x in s.select('[class*=related],[class*=upsell],[class*=recommend],[id*=related],[class*=cross-sell]'): x.decompose()
    txt = re.sub(r'\s+', ' ', s.get_text(' '))
    i = re.search(r'dimension|overall|measure|size', txt, re.I)  # prefer text after a "Dimensions" heading
    for chunk in ([txt[i.start():i.start() + 400]] if i else []) + [txt]:
        d = parse(chunk)
        if len(d) >= 2 or (d and v in ('dw-silks', 'jamie-young')): return ' x '.join(f'{d[k]:g}"{k}' for k in ('W', 'D', 'H') if k in d)
    # rugs: pull every size listed on the page
    sizes = re.findall(r"\d{1,2}\s*'\s*(?:\d{1,2}\s*(?:\"|”))?\s*[xX×]\s*\d{1,2}\s*'\s*(?:\d{1,2}\s*(?:\"|”))?", txt)
    if sizes: return ' | '.join(dict.fromkeys(x.strip() for x in sizes[:12]))
    return ''
def run(v):
    out = f'{D}/dims-{v}.json'; cache = json.load(open(out)) if os.path.exists(out) else {}
    items = [p for p in load(v) if p.get('url') and p['url'] not in cache and not parse(p.get('dims') or '')]
    print(v, 'to fetch', len(items), flush=True)
    t = time.time(); n = [0]
    def one(p):
        raw = fetch(p['url'], 2_500_000)
        cache[p['url']] = extract(v, raw) if raw else ''
        n[0] += 1
        if n[0] % 500 == 0:
            json.dump(cache, open(out, 'w')); print(v, n[0], flush=True)
    with ThreadPoolExecutor(4) as ex: list(ex.map(one, items))
    json.dump(cache, open(out, 'w'))
    print(v, 'done', sum(1 for x in cache.values() if x), '/', len(cache), int(time.time() - t), 's', flush=True)
with ThreadPoolExecutor(4) as ex: list(ex.map(run, VENDORS))
