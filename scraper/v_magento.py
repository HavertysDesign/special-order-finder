from run import *
import sys, json, requests
base,key=sys.argv[1],sys.argv[2]
if len(sys.argv)>3: sess().headers['Store']=sys.argv[3]
def q(query):
    for i in range(3):
        try:
            r=sess().post(base+'/graphql',json={'query':query},timeout=90)
            return r.json()
        except Exception as e: time.sleep(3)
    return {}
cats=q('{categoryList{uid name product_count children{uid name product_count children{uid name product_count children{uid name product_count children{uid name product_count}}}}}}')
allc=[]
def walk(c,path):
    allc.append((c['uid'],path+[c['name']],c.get('product_count',0)))
    for ch in c.get('children') or []: walk(ch,path+[c['name']])
for c in (cats.get('data') or {}).get('categoryList') or []: walk(c,[])
print(key,'cats',len(allc),flush=True)
items={}
F='items{name sku url_key url_suffix canonical_url small_image{url} image{url} description{html} categories{name}}'
def fetch(filt):
    page=1
    while True:
        d=q('{products(%s,pageSize:100,currentPage:%d){total_count page_info{total_pages} %s}}'%(filt,page,F))
        p=((d.get('data') or {}).get('products')) or {}
        for it in p.get('items') or []:
            if it['sku'] in items: continue
            url=base+'/'+(it.get('canonical_url') or (it['url_key']+(it.get('url_suffix') or '')))
            img=(it.get('image') or {}).get('url') or (it.get('small_image') or {}).get('url') or ''
            if 'placeholder' in img: img=(it.get('small_image') or {}).get('url','')
            desc=clean(BeautifulSoup((it.get('description') or {}).get('html') or '','lxml').get_text(' '))
            cats=[c['name'] for c in it.get('categories') or [] if c['name'] not in ('Products','All Products','Default Category')]
            items[it['sku']]={'url':url,'name':clean(it['name']),'image':img,'sku':it['sku'],'desc':desc[:600],'category':' > '.join(dict.fromkeys(cats))[:200],'dims':find_dims(desc)}
        tp=(p.get('page_info') or {}).get('total_pages') or 1
        if page>=tp or (filt.startswith("search") and page>=5): break
        page+=1
fetch('search:""')
for uid,path,n in allc:
    if n: fetch('filter:{category_uid:{eq:"%s"}}'%uid)
print(key,'items',len(items),flush=True)
json.dump(list(items.values()),open(f'{OUT}/{key}.json','w'))
