import requests, re, json, sys, gzip
from bs4 import BeautifulSoup
H={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36','Accept-Language':'en-US'}
def get(u):
    r=requests.get(u,headers=H,timeout=30); return r
def locs(u,depth=0,out=None):
    out=out if out is not None else []
    try: r=get(u)
    except Exception as e: return out
    t=r.content
    if t[:2]==b'\x1f\x8b': t=gzip.decompress(t)
    t=t.decode('utf8','ignore')
    ls=re.findall(r'<loc>\s*(.*?)\s*</loc>',t)
    if '<sitemapindex' in t and depth<2:
        for l in ls[:40]: locs(l.replace('&amp;','&'),depth+1,out)
    else: out+= [l.replace('&amp;','&') for l in ls]
    return out
sites=json.loads(sys.argv[1])
for name,sm in sites:
    L=locs(sm)
    prod=[l for l in L if re.search(r'/product|/products/|/item|/p/|\.html$',l,re.I)]
    print(f"== {name}: {len(L)} urls, {len(prod)} product-like. ex: {prod[:2] or L[:3]}")
    if prod:
        try:
            s=BeautifulSoup(get(prod[len(prod)//2]).text,'lxml')
            ld=[x.string for x in s.find_all('script',type='application/ld+json') if x.string and 'Product' in x.string]
            og=s.find('meta',property='og:image'); ti=s.find('meta',property='og:title')
            print('   ld+json product:',bool(ld),'| og:image:',og and og.get('content','')[:90],'| title:',ti and ti.get('content'))
        except Exception as e: print('  err',e)
