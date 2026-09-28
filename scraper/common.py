import requests, re, json, gzip, time, html, threading
from bs4 import BeautifulSoup
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
H={'User-Agent':UA,'Accept-Language':'en-US,en;q=0.9','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}
_s=threading.local()
def sess():
    if not hasattr(_s,'s'):
        _s.s=requests.Session(); _s.s.headers.update(H)
    return _s.s
def get(u, tries=3, **kw):
    for i in range(tries):
        try:
            r=sess().get(u,timeout=40,**kw)
            if r.status_code in (429,503): time.sleep(5*(i+1)); continue
            return r
        except Exception as e:
            time.sleep(2*(i+1))
    return None
def sitemap_locs(u, depth=0, out=None, idx_filter=None):
    out=out if out is not None else []
    r=get(u)
    if not r or r.status_code!=200: return out
    t=r.content
    if t[:2]==b'\x1f\x8b': t=gzip.decompress(t)
    t=t.decode('utf8','ignore')
    ls=[html.unescape(re.sub(r'^<!\[CDATA\[|\]\]>$','',l.strip())) for l in re.findall(r'<loc>\s*(.*?)\s*</loc>',t,re.S)]
    if '<sitemapindex' in t and depth<3:
        for l in ls:
            if idx_filter and not re.search(idx_filter,l): continue
            sitemap_locs(l,depth+1,out,idx_filter)
    else: out+=ls
    return out

DIM_RE=re.compile(r'(\d+(?:\.\d+)?)\s*(?:"|”|in\.?|inches)?\s*([WDHL])\b\s*[x×X]\s*(\d+(?:\.\d+)?)\s*(?:"|”|in\.?)?\s*([WDHL])\b(?:\s*[x×X]\s*(\d+(?:\.\d+)?)\s*(?:"|”|in\.?)?\s*([WDHL])\b)?')
DIM_RE2=re.compile(r'\b(Width|Depth|Height|Length|Diameter|W|D|H|Dia)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:"|”|in\b|inches)?',re.I)
def find_dims(text):
    import sys,os; sys.path.insert(0,os.path.join(os.path.dirname(os.path.abspath(__file__)),'..'))
    from dims import strip_parts
    text=strip_parts(text)
    m=DIM_RE.search(text)
    if m: return m.group(0).strip()
    parts={}
    for k,v in DIM_RE2.findall(text):
        k=k[0].upper() if k.lower()!='dia' and k.lower()!='diameter' else 'Dia'
        if k not in parts: parts[k]=v
    if len(parts)>=2: return ' x '.join(f'{v}"{k}' for k,v in parts.items())
    return ''
def clean(s): return re.sub(r'\s+',' ',html.unescape(s or '')).strip()

def ld_products(soup):
    out=[]
    for x in soup.find_all('script',type='application/ld+json'):
        try: d=json.loads(x.string or x.text or '')
        except Exception: continue
        st=[d]
        while st:
            o=st.pop()
            if isinstance(o,list): st+=o; continue
            if not isinstance(o,dict): continue
            if '@graph' in o: st+=o['@graph']
            t=o.get('@type'); t=t if isinstance(t,list) else [t]
            if 'Product' in t or 'ProductGroup' in t: out.append(o)
    return out
def img_of(v):
    if isinstance(v,list): v=v[0] if v else ''
    if isinstance(v,dict): v=v.get('url') or v.get('contentUrl') or ''
    return v or ''

def generic_extract(url, r, strip_title=None):
    """Return dict with name,image,desc,sku,category,dims,text from a product page."""
    soup=BeautifulSoup(r.text,'lxml')
    p={'url':url}
    lds=ld_products(soup)
    if lds:
        d=lds[0]
        p['name']=clean(d.get('name'))
        p['image']=img_of(d.get('image'))
        p['desc']=clean(BeautifulSoup(d.get('description') or '','lxml').get_text(' '))
        p['sku']=clean(str(d.get('sku') or d.get('mpn') or ''))
        c=d.get('category'); p['category']=clean(c if isinstance(c,str) else '')
    def meta(prop):
        m=soup.find('meta',property=prop) or soup.find('meta',attrs={'name':prop})
        return clean(m.get('content')) if m else ''
    if not p.get('name'):
        h1=soup.find('h1'); p['name']=clean(h1.get_text(' ')) if h1 else meta('og:title') or clean(soup.title.string if soup.title else '')
    if strip_title: p['name']=re.sub(strip_title,'',p['name']).strip()
    if not p.get('image'): p['image']=meta('og:image') or meta('twitter:image')
    if not p.get('desc'): p['desc']=meta('og:description') or meta('description')
    # breadcrumbs
    bc=[]
    for x in soup.find_all('script',type='application/ld+json'):
        if x.string and 'BreadcrumbList' in x.string:
            try:
                d=json.loads(x.string); st=[d]
                while st:
                    o=st.pop()
                    if isinstance(o,list): st+=o; continue
                    if isinstance(o,dict):
                        if '@graph' in o: st+=o['@graph']
                        if o.get('@type')=='BreadcrumbList':
                            for it in o.get('itemListElement',[]):
                                n=it.get('name') or (it.get('item') or {}).get('name') if isinstance(it.get('item'),dict) else it.get('name')
                                if n: bc.append(clean(n))
            except Exception: pass
    if not bc:
        el=soup.select_one('[class*=breadcrumb]')
        if el: bc=[clean(a.get_text()) for a in el.find_all(['a','span','li']) if clean(a.get_text())][:6]
    bc=[b for b in bc if b.lower() not in ('home','') and b!=p.get('name')]
    if bc and not p.get('category'): p['category']=' > '.join(dict.fromkeys(bc))
    for t in soup(['script','style','noscript','header','footer','nav']): t.decompose()
    body=clean(soup.get_text(' '))
    p['dims']=find_dims(body)
    if p.get('image','').startswith('//'): p['image']='https:'+p['image']
    return p
