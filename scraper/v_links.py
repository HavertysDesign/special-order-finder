from run import *
import sys, urllib.parse
from collections import deque
CFG={
 'aico':dict(seeds=['https://www.amini.com/collections_item.asp?code=ARIANA&collection=Ariana','https://www.amini.com/room?room=BRS','https://www.amini.com/room?room=DRS','https://www.amini.com/room?room=LRS','https://www.amini.com/room?room=HOF','https://www.amini.com/lighting?subcat=main','https://www.amini.com/bedding?subcat=main','https://www.amini.com/decor'],
   follow=r'amini\.com/(collections_item\.asp|room\?|lighting|bedding|decor)',prod=r'collections_detail\.asp'),
 'magnussen':dict(seeds=['https://www.magnussen.com/Categories'],follow=r'magnussen\.com/(Categories|New-Products)',prod=r'/Product-Detail/'),
}
key=sys.argv[1]; c=CFG[key]
seen=set(c['seeds']); q=deque(c['seeds']); prods=set()
while q and len(seen)<3000:
    u=q.popleft(); r=get(u)
    if not r or r.status_code!=200: continue
    for a in BeautifulSoup(r.text,'lxml').find_all('a',href=True):
        h=urllib.parse.urljoin(u,a['href']).split('#')[0]
        if re.search(c['prod'],h): prods.add(h)
        elif re.search(c['follow'],h) and h not in seen: seen.add(h); q.append(h)
print(key,'pages',len(seen),'products',len(prods),flush=True)
crawl(sorted(prods),page_fn(),workers=4,name=key)
print('DONE')
