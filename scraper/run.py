import sys, os, json, re, time
from concurrent.futures import ThreadPoolExecutor
from common import *
from bs4 import BeautifulSoup
OUT=os.path.join(os.path.dirname(__file__),'..','data')

def shopify(base):
    out=[]; page=1
    while True:
        r=get(f'{base}/products.json?limit=250&page={page}')
        if not r or r.status_code!=200: break
        ps=r.json().get('products',[])
        if not ps: break
        for p in ps:
            img=(p.get('images') or [{}])[0].get('src','')
            desc=clean(BeautifulSoup(p.get('body_html') or '','lxml').get_text(' '))
            v=(p.get('variants') or [{}])
            out.append({'url':f"{base}/products/{p['handle']}",'name':clean(p.get('title')),'image':img,
                'desc':desc[:600],'sku':clean(v[0].get('sku') or ''),'category':clean(p.get('product_type')),
                'tags':[t for t in (p.get('tags') or [])][:25] if isinstance(p.get('tags'),list) else clean(p.get('tags'))[:300],
                'dims':find_dims(desc+' '+' '.join(x.get('title','') for x in v)),
                'variants':len(v)})
        page+=1; time.sleep(0.5)
    return out

def crawl(urls, fn, workers=6, name='x'):
    path=os.path.join(OUT,name+'.jsonl'); done=set()
    if os.path.exists(path):
        for l in open(path):
            try: done.add(json.loads(l)['url'])
            except: pass
    todo=[u for u in dict.fromkeys(urls) if u not in done]
    print(name,'total',len(urls),'todo',len(todo),flush=True)
    f=open(path,'a'); n=[0]
    def w(u):
        try:
            p=fn(u)
        except Exception as e:
            p=None
        if p and p.get('name'):
            f.write(json.dumps(p)+'\n'); f.flush()
        n[0]+=1
        if n[0]%500==0: print(name,n[0],'/',len(todo),flush=True)
    with ThreadPoolExecutor(workers) as ex: list(ex.map(w,todo))
    f.close()
    # prune products that no longer appear on the vendor site
    keep=set(urls); rows=[]
    for l in open(path):
        try:
            d=json.loads(l)
            if d['url'] in keep: rows.append(l)
        except Exception: pass
    if len(rows)>0.5*len(done|set(todo)) or not done:
        open(path,'w').writelines(rows)

def page_fn(extra=None, strip=None):
    def fn(u):
        r=get(u)
        if not r or r.status_code!=200: return None
        p=generic_extract(u,r,strip)
        if extra: extra(p,r)
        return p
    return fn
