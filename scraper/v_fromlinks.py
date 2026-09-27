from run import *
import sys
key,links=sys.argv[1],sys.argv[2]
L=json.load(open(links))
def bassett_extra(p,r):
    s=BeautifulSoup(r.text,'lxml')
    im=[i.get('src') for i in s.find_all('img') if 'plytix' in (i.get('src') or '')]
    if im: p['image']=im[0]
    for t in s(['script','style','noscript','header','footer','nav']): t.decompose()
    tx=clean(s.get_text(' ')); m=re.search(re.escape(p['name'])+r'\s+(\S+)\s*\|\s*([\dx.]+)\s+(.*?)Alternate Views',tx)
    if m: p['sku'],p['dims'],p['desc']=m.group(1),m.group(2),m.group(3)[:500]
    m=re.search(r'Specifications (.*?) Description',tx)
    if m: p['desc']=(p.get('desc','')+' '+m.group(1))[:700]
    p['category']=re.sub(r'\s*>\s*<\s*BACK.*','',p.get('category','')).split(' > ')[-1] if p.get('category') else ''
def besthf_extra(p,r):
    p['name']=p['name'].replace(' | Best Home Furnishings','')
    parts=p['name'].split(' | '); p['name']=parts[-1].title(); p['category']=' > '.join(parts[:-1])
def kas_extra(p,r):
    s=BeautifulSoup(r.text,'lxml')
    im=[i.get('src') for i in s.find_all('img') if '/400/400/' in (i.get('src') or '')]
    if im: p['image']=im[0]
    for t in s(['script','style','noscript','header','footer','nav']): t.decompose()
    tx=clean(s.get_text(' ')); m=re.search(re.escape(p['name'])+r'\s+(.*?)\s+Products ',tx)
    if m: p['desc']=m.group(1)[:600]
    p['category']='Rugs'
EX={'kas-rugs':kas_extra,'bassett-mirror':bassett_extra,'best-home-furnishings':besthf_extra}
crawl(L,page_fn(EX.get(key)),workers=4,name=key); print('DONE')
