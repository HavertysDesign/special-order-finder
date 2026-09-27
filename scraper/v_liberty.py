import json, re, sys, time
sys.path.insert(0,'.')
from libq import s, H
from common import clean, find_dims
U='https://www.mylibertyfurniture.com/api/graphql'
_o=json.load(open('liberty_ops.json')); dC=_o['productCollectionsByRoom']; dP=_o['productsByCollection']
def gq(d,vars):
    for i in range(3):
        try: return s.post(U,json={'operationName':d['operationName'],'query':d['query'],'variables':vars},headers=H,timeout=90).json()
        except Exception: time.sleep(3)
    return {}
rooms=['bedroom','dining','entertainment','home-office','occasional','accents','upholstery','youth']
items={}
for room in rooms:
    v=dict(dC['variables']); v['room']=room
    cols=(gq(dC,v).get('data') or {}).get('productCollectionsByRoom') or []
    print(room,len(cols),flush=True)
    for c in cols:
        fam=re.sub(r'[^a-z0-9]+','-',c['family'].lower()).strip('-'); ic=c['itemClass'].lower()
        skip=0
        while True:
            pv=dict(dP['variables']); pv.update(room=room,family=fam,itemClass=ic,skip=skip,pageSize=100)
            ps=((gq(dP,pv).get('data') or {}).get('productsByCollection') or {}).get('products') or []
            for p in ps:
                num=(p.get('sku') or {}).get('number') or p['id']
                img=(((p.get('images') or {}).get('primary') or {}).get('small') or {}).get('fileUrl','')
                img=img.replace('_small.jpg','_medium.jpg') if img else ''
                desc=clean(p.get('longDescription') or '')
                items[num]={'url':f'https://www.mylibertyfurniture.com/shop-by/{room}/collection/{fam}/{ic}','name':f"{c['family']} {p.get('name') or ''}".strip(),'image':img,'sku':num,'desc':desc[:500],'category':f"{c['room']} > {p.get('groupName') or ''}".strip(' >'),'dims':find_dims(desc)}
            if len(ps)<100: break
            skip+=100
    print(room,'items',len(items),flush=True)
json.dump(list(items.values()),open('../data/liberty.json','w')); print('liberty',len(items))
