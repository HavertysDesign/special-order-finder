from run import *
import sys, json
from concurrent.futures import ThreadPoolExecutor
base, key = sys.argv[1], sys.argv[2]
items=[]; page=1
while True:
    r=get(f'{base}/api/v1/products?pageSize=96&page={page}')
    if not r or r.status_code!=200: print('stop',page, r and r.status_code); break
    d=r.json(); ps=d.get('products',[])
    if not ps: break
    for p in ps:
        items.append({'url':base+'/Product/'+p['urlSegment'],'name':p.get('name') or p.get('shortDescription'),'image':p.get('mediumImagePath') or p.get('smallImagePath'),'sku':p.get('erpNumber','').replace('_P',''),'seg':p['urlSegment']})
    if page>=d['pagination']['numberOfPages']: break
    page+=1
print(key,'listed',len(items),flush=True)
def enrich(it):
    r=get(f"{base}/api/v1/catalogpages?path=/Product/{it['seg']}")
    if r and r.status_code==200:
        d=r.json(); it['desc']=d.get('metaKeywords') or ''
        bc=[b['text'] for b in d.get('breadCrumbs',[]) if b.get('text') not in ('Home','All',it['name'])]
        it['category']=' > '.join(bc)
        dd=d.get('metaDescription') or ''
        if dd and dd!=it['name']: it['desc']=dd+' | '+it['desc']
    it.pop('seg',None); return it
with ThreadPoolExecutor(8) as ex: items=list(ex.map(enrich,items))
json.dump(items,open(f'{OUT}/{key}.json','w')); print(key,'done',len(items))
