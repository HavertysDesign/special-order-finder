from run import *
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from collections import deque
seen={'https://www.magnussen.com/Categories'}; q=deque(seen); gs=set()
while q:
    u=q.popleft(); r=get(u)
    if not r: continue
    for a_ in BeautifulSoup(r.text,'lxml').find_all('a',href=True):
        h=urllib.parse.urljoin(u,a_['href']).split('#')[0]
        if '/Product-Detail/' in h: gs.add(h)
        elif re.search(r'magnussen\.com/(Categories|New-Products)',h) and h not in seen and len(seen)<200: seen.add(h); q.append(h)
groups=sorted(gs)
def one(u):
    r=get(u)
    if not r: return []
    s=BeautifulSoup(r.text,'lxml')
    imgs={i.get('alt'):i.get('src') for i in s.find_all('img') if i.get('src','').startswith('https://ipad.')}
    for t in s(['script','style','noscript','header','footer','nav']): t.decompose()
    tx=clean(s.get_text(' '))
    gid=u.rstrip('/').split('/')[-1]
    m=re.search(re.escape(gid)+r'\s*-\s*([A-Za-z0-9\' &]+?)\s+'+re.escape(gid),tx); coll=m.group(1).strip() if m else gid
    cat=re.search(r'Home \| (\w[\w &-]*) \|',tx); cat=cat.group(1) if cat else ''
    dm=re.search(r'(Refined|.{0,0})(.*?)Finish:',tx)
    desc=re.search(re.escape(gid)+r'\s*-\s*'+re.escape(coll)+r'\s+Share:\s*(.*?)(Special Features:|$)',tx)
    desc=desc.group(1)[:500] if desc else ''
    out=[]
    for m in re.finditer(r'('+re.escape(gid)+r'-[A-Z0-9]+)\s+([A-Z][^"]{2,60}?)\s+(\d+(?:\.\d+)?"\s*W\s*x\s*\d+(?:\.\d+)?"\s*D\s*x\s*\d+(?:\.\d+)?"\s*H)',tx):
        sku,name,dims=m.groups()
        img=imgs.get(sku) or next((v for k,v in imgs.items() if k and k.startswith(sku)),'') or imgs.get(gid+'.jpg','')
        out.append({'url':u,'name':f'{coll} {name}'.strip(),'image':img.replace('/T-','/') if False else img,'sku':sku,'desc':desc,'category':cat,'dims':dims})
    if not out:
        out.append({'url':u,'name':coll+' Collection','image':imgs.get(gid+'.jpg') or next(iter(imgs.values()),''),'sku':gid,'desc':desc,'category':cat,'dims':''})
    return out
with ThreadPoolExecutor(4) as ex: res=[x for l in ex.map(one,groups) for x in l]
d={}; [d.setdefault(x['sku'],x) for x in res]
print('magnussen',len(d)); json.dump(list(d.values()),open(f'{OUT}/magnussen.json','w'))
