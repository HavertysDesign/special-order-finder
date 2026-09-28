"""Fill in product colors for any catalog photo that doesn't have them yet (table c in the embedding cache)."""
import sys, os, json, sqlite3, io, time, threading
import requests, itertools
from urllib.parse import urlparse
from collections import defaultdict
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from color import colors, pack
import warnings; warnings.simplefilter('ignore')
Image.MAX_IMAGE_PIXELS = 12_000_000
cat = json.load(open(sys.argv[1]))['items']
DB = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'emb_cache.sqlite')
LIMIT = float(os.environ.get('COLOR_MINUTES', '90')) * 60
con = sqlite3.connect(DB); con.execute('create table if not exists c(url text primary key, c blob)'); con.commit()
have = {r[0] for r in con.execute('select url from c')}
urls = list(dict.fromkeys(it['i'] for it in cat if it['i'] not in have))
byh = defaultdict(list)
for u in urls: byh[urlparse(u).netloc].append(u)
SLOW = {'www.amityhome.com': 2}
urls = [u for grp in itertools.zip_longest(*[v for h, v in byh.items() if h not in SLOW]) for u in grp if u]
urls += [u for h in SLOW for u in byh.get(h, [])]   # rate-limited hosts last, so they can't stall the rest
print('colors to fetch', len(urls), 'cached', len(have), flush=True)
H = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept': 'image/avif,image/webp,image/*,*/*'}
tl = threading.local()
hsem = defaultdict(lambda: threading.Semaphore(12)); [hsem.__setitem__(h, threading.Semaphore(n)) for h, n in SLOW.items()]
def small(u):
    # ask image CDNs for a thumbnail; colors only need ~100px
    if 'cdn.shopify.com' in u or '/cdn/shop/' in u: return u.replace('width=600', 'width=160') if 'width=' in u else u + ('&' if '?' in u else '?') + 'width=160'
    if '?width=600' in u: return u.replace('?width=600', '?width=160')
    return u
def job(u):
    if not hasattr(tl, 's'): tl.s = requests.Session(); tl.s.headers.update(H)
    for n, src in enumerate([small(u), small(u), u]):
        try:
            with hsem[urlparse(src).netloc]:
                r = tl.s.get(src, timeout=25, stream=True)
                if r.status_code == 429: time.sleep(5 + 10 * n); continue
                data = r.raw.read(15_000_001, decode_content=True)
            if r.status_code == 200 and 500 < len(data) <= 15_000_000:
                im = Image.open(io.BytesIO(data)); im.draft('RGB', (200, 200)); im = im.convert('RGBA')
                bg = Image.new('RGB', im.size, (255, 255, 255)); bg.paste(im, mask=im.split()[3])
                return u, pack(colors(bg))
        except Exception: pass
    return u, None
t0 = time.time(); rows = []; done = 0; bad = 0
with ThreadPoolExecutor(int(os.environ.get('WORKERS', '24'))) as ex:
    it = iter(urls); fut = set()
    def fill():
        while len(fut) < 200:
            try: fut.add(ex.submit(job, next(it)))
            except StopIteration: return
    fill()
    while fut:
        f = next(as_completed(fut)); fut.discard(f)
        u, c = f.result(); done += 1
        if c is None: bad += 1
        else: rows.append((u, c))
        if len(rows) >= 500: con.executemany('insert or replace into c values(?,?)', rows); con.commit(); rows = []
        if done % 500 == 0:
            import resource
            if resource.getrusage(resource.RUSAGE_SELF).ru_maxrss > 2_500_000:
                con.executemany('insert or replace into c values(?,?)', rows); con.commit(); print('memory high, restarting', flush=True); os._exit(3)
        if done % 2000 == 0: print(f'{done}/{len(urls)} bad={bad} {done / (time.time() - t0):.0f}/s', flush=True)
        if time.time() - t0 < LIMIT: fill()
con.executemany('insert or replace into c values(?,?)', rows); con.commit()
print('colors done', done, 'bad', bad, f'{time.time() - t0:.0f}s', flush=True)
