from run import *
import sys, urllib.parse
base,key=sys.argv[1],sys.argv[2]
J={'Accept':'application/json'}
cats=get(base+'/categories',headers=J).json()['Categories']
leaf=[]
def walk(c,path):
    subs=c.get('SubCategories') or []
    if not subs: leaf.append((c['CategoryID'],c['Name'],path))
    for s in subs: walk(s,path+[c['Name']])
for c in cats: walk(c,[])
items={}
for cid,name,path in leaf:
    page=1
    while True:
        r=get(f"{base}/categories/{cid}/{urllib.parse.quote(name.lower())}/products?page={page}",headers=J)
        try: d=r.json()
        except Exception: break
        for p in d.get('Products') or []:
            iid=p['ItemID']
            if iid in items: continue
            desc=clean(BeautifulSoup(p.get('RenderedDescriptionTemplate') or '','lxml').get_text(' '))
            dims=re.search(r'H:\s*[\d.]+\s*W:\s*[\d.]+(\s*D:\s*[\d.]+)?',desc)
            items[iid]={'url':base+p['ProductURL'],'name':clean(p.get('ItemName') or p.get('Description')).title(),'image':(p.get('ImageURL') or '').split('?')[0],'sku':iid,
               'desc':desc[:400],'category':' > '.join([x.title() for x in path+[name] if not x.upper().startswith('ALL')]),'dims':dims.group(0) if dims else ''}
        if page*d.get('PageSize',36)>=d.get('TotalRecords',0): break
        page+=1
print(key,len(items)); json.dump(list(items.values()),open(f'{OUT}/{key}.json','w'))
