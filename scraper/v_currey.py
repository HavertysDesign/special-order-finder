from run import *
import html as H
L=[u for u in sitemap_locs('https://www.curreyandcompany.com/sitemap.xml') if '/c/' in u and '?sku=' in u]
seen={}; 
for u in L: seen.setdefault(u.split('?')[0],u)
B='https://www.curreyandcompany.com'
def fn(u):
    r=get(u)
    if not r or r.status_code!=200: return None
    s=BeautifulSoup(r.text,'lxml'); el=s.select_one('div.product-item[data-details]')
    if not el: return None
    d=json.loads(el['data-details']); v=d.get('variant') or {}
    img=(v.get('images') or [{}])[0].get('tileUrl','')
    return {'url':B+v.get('url',''),'name':v.get('name'),'image':B+img if img else '','sku':v.get('sku'),'desc':clean(v.get('description'))[:600],
      'category':' > '.join(x for x in [v.get('category'),v.get('subcategory')] if x),'dims':'; '.join(v.get('dimensions') or []),
      'finish':v.get('finish'),'material':v.get('material')}
crawl(list(seen.values()),fn,workers=5,name='currey')
print('DONE')
