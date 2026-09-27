from run import *
import urllib.parse
def fn(u):
    r=get(u.replace(' ','%20'))
    if not r: return None
    q=dict(urllib.parse.parse_qsl(urllib.parse.urlparse(u).query))
    s=BeautifulSoup(r.text,'lxml')
    for t in s(['script','style','noscript','header','footer','nav']): t.decompose()
    tx=clean(s.get_text(' '))
    m=re.search(r'Where to Buy\s+(.*?)\s+Finish:\s*(.*?)\s+(\S.*?)\s+SKU:\s*(\S+)\s*\*?\s*(.*?)(Dimensions:|Where to Buy)',tx)
    coll=q.get('collection','').strip(); cat={'BRS':'Bedroom','DRS':'Dining','LRS':'Living','HOF':'Home Office'}.get(q.get('CatCode'),q.get('CatCode',''))
    if m:
        _,finish,typ,sku,desc=m.groups()[:5]
        name=f"{coll} {typ}"
    else:
        finish=typ=desc=''; sku=q.get('item'); name=f"{coll} {sku}"
    dims=find_dims(tx)
    return {'url':u.replace(' ','%20'),'name':name,'image':f"https://www.amini.com/images/collections/{q.get('code')}/{q.get('item')}.jpg",'sku':sku,'desc':(desc[:500]+(' Finish: '+finish if finish else '')).strip(),'category':cat,'dims':dims}

import urllib.parse as up
from collections import deque
seeds=['https://www.amini.com/collections_item.asp?code=ARIANA&collection=Ariana','https://www.amini.com/room?room=BRS','https://www.amini.com/room?room=DRS','https://www.amini.com/room?room=LRS','https://www.amini.com/room?room=HOF','https://www.amini.com/lighting?subcat=main','https://www.amini.com/bedding?subcat=main','https://www.amini.com/decor']
seen=set(seeds); q=deque(seeds); prods=set()
while q and len(seen)<3000:
    u=q.popleft(); r=get(u)
    if not r or r.status_code!=200: continue
    for a_ in BeautifulSoup(r.text,'lxml').find_all('a',href=True):
        h=up.urljoin(u,a_['href']).split('#')[0]
        if 'collections_detail.asp' in h: prods.add(h.replace(' ','%20'))
        elif re.search(r'amini\.com/(collections_item\.asp|room\?|lighting|bedding|decor)',h) and h not in seen: seen.add(h); q.append(h)
print('aico products',len(prods))
crawl(sorted(prods),fn,workers=4,name='aico'); print('DONE')
