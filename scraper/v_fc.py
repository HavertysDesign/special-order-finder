from run import *
B='https://supercat.supercatsolutions.com'
items={}; page=1
while page<400:
    r=get(f'{B}/fc/e/1/products?page={page}')
    if not r or r.status_code!=200: break
    s=BeautifulSoup(r.text,'lxml'); lis=s.select('li.catalog-item')
    if not lis: break
    new=0
    for li in lis:
        a=li.select_one('a.catalog-item-detail-link'); fb=li.select_one('[data-product]')
        if not fb: continue
        d=json.loads(fb['data-product']); txt=clean(li.get_text(' '))
        if d['num'] in items: continue
        new+=1
        dm=re.search(r'W:\s*[\d.]+\s*x\s*D:\s*[\d.]+\s*x\s*H:\s*[\d.]+',txt)
        items[d['num']]={'url':B+a['href'].split('?')[0] if a else B+'/fc/e/1/products','name':clean(d.get('desc')),'image':(d.get('img') or '').split('?')[0],'sku':d['num'],'desc':clean(d.get('long_desc'))[:400],'category':'','dims':dm.group(0) if dm else ''}
    if not new: break
    page+=1
print('fc',len(items),'pages',page); json.dump(list(items.values()),open(f'{OUT}/furniture-classics.json','w'))
