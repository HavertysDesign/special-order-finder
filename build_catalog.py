import json, glob, os, hashlib, re, html
V={'aico':'AICO (Michael Amini)','amity-home':'Amity Home','ann-gish':'Ann Gish','art-furniture':'A.R.T. Furniture','artistic-leathers':'Artistic Leathers','aspenhome':'Aspen Home','bassett-mirror':'Bassett Mirror','bernhardt':'Bernhardt','best-home-furnishings':'Best Home Furnishings','cooper-classics':'Cooper Classics','crestview':'Crestview Collection','currey':'Currey & Company','dalyn':'Dalyn Rugs','dw-silks':'D&W Silks','furniture-classics':'Furniture Classics','gascho':'LJ Gascho','global-views':'Global Views','harp-finial':'Harp & Finial','home-trends-design-gql':'Home Trends & Design','hooker':'Hooker Furnishings','jamie-young':'Jamie Young','karastan':'Karastan Rugs','kas-rugs':'KAS Rugs','magnussen':'Magnussen Home','oriental-weavers':'Oriental Weavers','paragon':'Paragon','riverside':'Riverside Furniture','sopoly':'SoPoly','steve-silver':'Steve Silver','stylecraft':'StyleCraft','surya':'Surya','universal':'Universal Furniture','wendover':'Wendover Art Group','wesley-allen':'Wesley Allen','four-hands':'Four Hands','left-bank':'Left Bank Art','liberty':'Liberty Furniture','jonathan-louis':'Jonathan Louis','pulaski':'Pulaski Furniture','huntington-house':'Huntington House','havertys':'Havertys'}
import sys as _sys; _sys.path.insert(0,'scraper')
from common import find_dims
from dims import PARTS
def fixdims(p):
    d=p.get('dims') or ''; desc=fx(p.get('desc'))
    # scraped sizes that came from part measurements (Leg Width: 2") get re-read without them
    if d and PARTS.search(desc):
        first=re.match(r'\s*([\d.]+)',d)
        vals=set(re.findall(r'\d+(?:\.\d+)?',' '.join(m.group(0) for m in PARTS.finditer(desc))))
        if first and first.group(1) in vals: return find_dims(desc)
    return d
QS=re.compile(r'\bin ?stock\b|quick ?ship|express ship|ready to ship',re.I)
def quick(p,tags):
    # only the vendor's own category/tag labels count; product copy says things like "if not in stock"
    return 1 if QS.search(' '.join([str(p.get('category') or '')]+[str(t) for t in tags])) else 0
def fx(s):
    s=str(s or '')
    if any(b in s for b in ('Ã','â€','Â')):
        try: s=s.encode('cp1252').decode('utf-8')
        except Exception:
            try: s=s.encode('latin-1').decode('utf-8')
            except Exception: pass
    return html.unescape(s)
def small_img(u):
    # ask image CDNs for a ~600px version: much faster to download and to show on the site
    if '/media/catalog/product/' in u and 'placeholder' not in u:
        return u.split('?')[0]+'?width=600'
    if 'cdn.shopify.com' in u or '/cdn/shop/' in u:
        return u+('&' if '?' in u else '?')+'width=600'
    if 'static.wixstatic.com' in u and '/v1/fill/' in u:
        return re.sub(r'/v1/fill/[^/]+/','/v1/fill/w_700,h_700,al_c,q_85/',u)
    return u
def load(f):
    if f.endswith('.jsonl'):
        return [json.loads(l) for l in open(f) if l.strip()]
    return json.load(open(f))
out=[]; seen=set(); counts={}
for f in sorted(glob.glob('data/*.json*')):
    key=os.path.basename(f).split('.')[0]
    if key not in V: print('skip',key); continue
    if f.endswith('.jsonl') and os.path.exists(f[:-1]): print('prefer json for',key); continue
    for p in load(f):
        name=fx(p.get('name')).strip()
        img=(p.get('image') or '').strip()
        if key=='surya' and re.match(r'^[A-Z]{2,5}-\d+',name):
            toks=str(p.get('desc') or '').split('|')[-1].split()
            if len(toks)>4 and toks[4].isalpha(): name=f"{toks[4]} {name}"
        name=re.sub(r"'([A-Z])",lambda m:"'"+m.group(1).lower(),name)
        if name.startswith('Sort ') or name.endswith('- Artistic Leathers') or 'logo' in img.lower(): continue
        if not name or not img or img.endswith(('.svg','og-image.jpg','default-image.png')) or 'placeholder' in img: continue
        if img.startswith('//'): img='https:'+img
        if not img.startswith('http'): continue
        img=small_img(img)
        k=(key,p.get('url'),name,img)
        if k in seen: continue
        seen.add(k)
        pid=hashlib.sha1('|'.join(map(str,k)).encode()).hexdigest()[:12]
        tags=p.get('tags') or []
        if isinstance(tags,str): tags=[t.strip() for t in tags.split(',')]
        extra=' '.join(x for x in [p.get('finish') or '',p.get('material') or ''] if x)
        out.append({'id':pid,'v':key,'n':name[:140],'u':p.get('url'),'i':img,'c':fx(p.get('category'))[:120],
            'd':fixdims(p)[:80],'s':(p.get('sku') or '')[:40],'q':quick(p,tags),'x':re.sub(r'\s+',' ',(fx(p.get('desc'))+' '+fx(extra)+' '+' '.join(map(str,tags[:15]))))[:400].strip()})
        counts[key]=counts.get(key,0)+1
json.dump({'vendors':V,'items':out},open('catalog_full.json','w'))
for k,v in sorted(counts.items()): print(f'{k:28s}{v}')
print('TOTAL',len(out))
