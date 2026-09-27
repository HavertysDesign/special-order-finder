from run import *
B='https://www.bernhardt.com'
items=[]; skip=0
while True:
    r=get(B+f"/service/QueryBernhardtProducts.json?op=ProductQuery1.4&JsConfig=ExcludeDefaultValues&IncludeTagKinds=Product%20Type,Brand,Sub-Category,RoomType,Collection,Style&fields=Id,ShortDescription,Category,ManufacturerNumber,ProductTags,Length,Width,Height&include=Total&orderBy=Id&retailerId=*&skip={skip}&take=200&context=shop")
    d=r.json(); res=d.get('results') or []
    for p in res:
        t=p.get('tags') or {}; m=p.get('meta') or {}
        pt=(t.get('Product Type') or [''])[0]
        if pt in ('Fabric','Leather','Finish','Trim') or not p.get('productImages'): continue
        dims=' x '.join(f'{v}"{k[0]}' for k,v in [('Width',m.get('Width')),('Depth',m.get('Length')),('Height',m.get('Height'))] if v)
        desc=clean(BeautifulSoup(m.get('RomanceCopy') or m.get('LongDescription') or '','lxml').get_text(' '))
        tags=[x for k,v in t.items() if k not in ('Brand',) for x in v]
        items.append({'url':f"{B}/shop/{p['id']}",'name':' '.join(filter(None,[(t.get('Collection') or [''])[0], re.sub(r'^\S+\s+','',p.get('shortDescription') or '') or p['id']])),'image':f"https://s3.amazonaws.com/emuncloud-staticassets/productImages/bh074/medium/{p['id']}.jpg",
          'sku':p['id'],'desc':(desc+' '+' '.join(filter(None,[m.get('Collection'),m.get('Finish'),m.get('Type')]))).strip()[:600],'category':' > '.join(filter(None,[m.get('Room'),pt])),'tags':tags[:20],'dims':dims})
    skip+=200
    if skip>=d.get('total',0) or not res: break
print('bernhardt',len(items)); json.dump(items,open(f'{OUT}/bernhardt.json','w'))
