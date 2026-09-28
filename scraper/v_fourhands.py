import json, requests, re, time, sys
sys.path.insert(0,'.')
from common import clean, find_dims
d=json.load(open('../.fh_coveo.json')); rq=[r for r in d['reqs'] if r['url'].endswith('/v2/search')][0]
url=rq['url']; body=json.loads(rq['body']); H={'Authorization':d['auth'],'Content-Type':'application/json'}
items={}
for qq in ['','sofa','chair','table','bed','light','lamp','rug','art','mirror','decor','outdoor','pillow','cabinet','dresser','nightstand','stool','bench','desk','ottoman','sectional','console','bookcase','vase','bowl','sculpture','chandelier','pendant','sconce','throw','basket','media','bar','dining','coffee','side','accent','leather','wood','metal','stone','glass','white','black','natural','grey','brown']:
  body['sort']={'sortCriteria':'relevance'}; page=0
  while True:
      body.update(query=qq,page=page,perPage=100)
      j=requests.post(url,json=body,headers=H,timeout=60).json()
      for p in j.get('products',[]):
          a=p.get('additionalFields') or {}
          cat=(p.get('ec_category') or [''])[-1].replace('|',' > ')
          items[p.get('permanentid') or p.get('ec_product_id')]={'url':(p.get('clickUri') or '').replace('product://','https://fourhands.com/product/'),'name':clean(p.get('ec_name') or '').title(),'image':a.get('imageprimary') or (p.get('ec_thumbnails') or [''])[0],
            'sku':p.get('permanentid'),'desc':clean(p.get('ec_description') or '')[:500],'category':cat,'dims':find_dims(clean(p.get('ec_description') or '')),'finish':a.get('skuname'),'material':a.get('material'),
            'tags':(['In Stock'] if (p.get('ec_in_stock') or (a.get('instock') or 0)>0 or (a.get('inventoryquantity') or 0)>0) else [])+(['Performance fabric'] if str(a.get('hasperformancefabric')).lower()=='true' else [])}
      pg=j.get('pagination',{}); pass
      page+=1
      if page>=pg.get('totalPages',0): break
      time.sleep(0.5)
print('after',qq,len(items),flush=True) if False else None
json.dump(list(items.values()),open('../data/four-hands.json','w')); print('fourhands',len(items))
print(list(items.values())[0])
