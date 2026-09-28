"""Build site/data/{meta.json,emb.bin,pca.json} from catalog_full.json + embedding cache."""
import json, sqlite3, re, sys, os, datetime
import numpy as np
D=int(os.environ.get('PCA_DIM','192'))
cat=json.load(open('catalog_full.json')); V=cat['vendors']; items=cat['items']
con=sqlite3.connect('embed/emb_cache.sqlite')
E={u:np.frombuffer(b,dtype=np.float16) for u,b in con.execute('select url,v from e where ok=1')}
items=[it for it in items if it['i'] in E]
print('items with embeddings',len(items))
X=np.stack([E[it['i']] for it in items]).astype(np.float32)
# PCA (fixed basis saved; reused on refresh when present)
pp='site/data/pca_basis.npz'
if os.path.exists(pp) and not os.environ.get('REFIT'):
    z=np.load(pp); mean,comp=z['mean'],z['comp']
else:
    # uncentered basis: centering on image embeddings hurts text->image matching (modality gap)
    mean=np.zeros(X.shape[1],dtype=np.float32)
    idx=np.random.default_rng(0).choice(len(X),min(len(X),60000),replace=False)
    _,_,Vt=np.linalg.svd(X[idx],full_matrices=False); comp=Vt[:D]
    np.savez(pp,mean=mean,comp=comp)
P=(X-mean)@comp.T; P/=np.linalg.norm(P,axis=1,keepdims=True)
Q=np.clip(np.round(P*127),-127,127).astype(np.int8)
TYPES=['Sofas & Sectionals','Chairs & Seating','Tables','Beds','Dressers & Nightstands','Dining Storage','Cabinets & Shelving','Desks & Office','Lighting','Rugs','Wall Art','Mirrors','Pillows & Throws','Bedding','Decor & Accessories','Botanicals','Outdoor']
RULES=[
 ('Rugs',r'\brugs?\b|\brunner\b|\bdhurrie|\bkilim'),
 ('Bedding',r'\bduvet|\bquilt|\bsham\b|\bshams\b|coverlet|\bsheet set|\bbedding|\bbed skirt|\bbolster|\bcomforter|\bpillowcase'),
 ('Pillows & Throws',r'\bpillows?\b|\bthrows?\b|\bblanket'),
 ('Mirrors',r'\bmirrors?\b'),
 ('Lighting',r'\blamps?\b|chandelier|\bpendant|\bsconce|\blighting\b|lantern|flush mount|\bceiling light|\bfloor light|\bbulb'),
 ('Wall Art',r'\bwall art\b|\bcanvas\b|\bprints?\b|\bframed\b|\bartwork|\bpainting|giclee|\bart\b|wall decor|\bdiptych|\btriptych'),
 ('Outdoor',r'\boutdoor\b|\bpatio\b|adirondack|\bporch\b'),
 ('Botanicals',r'\bplants?\b|\btrees?\b|\bfloral\b|\bstems?\b|botanical|\bplanter\b|\bsilk\b|arrangement|\bfaux\b|\bpalm\b|\bfern\b|succulent|\borchid|\bboxwood|\btopiary'),
 ('Sofas & Sectionals',r'\bsofas?\b|sectional|loveseat|\bsettee|\bchaise|\bsleeper|\bchofa'),
 ('Beds',r'\bbeds?\b|headboard|daybed|\bbed frame|\bking\b.*\bbed|\bqueen\b.*\bbed'),
 ('Dressers & Nightstands',r'\bdressers?\b|nightstand|night stand|\bbedside|\bchests?\b|\barmoire|\bbachelor|\blingerie|\bvanity\b'),
 ('Desks & Office',r'\bdesks?\b|\bfile cabinet|\boffice\b|\bwriting table|\bbookcase desk'),
 ('Dining Storage',r'\bbuffet|sideboard|\bserver\b|\bhutch|\bchina\b|\bbar cabinet|\bwine\b'),
 ('Cabinets & Shelving',r'\bcabinets?\b|bookcase|etagere|\bmedia\b|entertainment|credenza|\bshel(f|ves)|\bconsole cabinet|\bstorage\b|\bcurio|\bdisplay\b'),
 ('Chairs & Seating',r'\bchairs?\b|recliner|\bstools?\b|\bbench(es)?\b|\bottomans?\b|\bpoufs?\b|glider|rocker|\bseating\b|\bswivel'),
 ('Tables',r'\btables?\b|\bconsoles?\b|\bcocktail\b|\bend table|\bside table|\bpedestal\b|\bnesting'),
 ('Decor & Accessories',r'\bvases?\b|\bbowls?\b|sculpture|\bbox(es)?\b|\bobjects?\b|\btrays?\b|\bclocks?\b|\bcandle|\bdecor\b|accessor|\bbaskets?\b|bookend|\bfigur|\bjars?\b|\bplatter|\bstatue|\borb\b|\bfinial|\bscreen\b|\blantern'),
]
VENDOR_DEFAULT={'wendover':'Wall Art','left-bank':'Wall Art','dalyn':'Rugs','karastan':'Rugs','kas-rugs':'Rugs','oriental-weavers':'Rugs','dw-silks':'Botanicals','sopoly':'Outdoor','amity-home':'Bedding','ann-gish':'Bedding','crestview':'Lighting','stylecraft':'Lighting','paragon':'Wall Art','harp-finial':'Wall Art','cooper-classics':'Mirrors','wesley-allen':'Beds','artistic-leathers':'Sofas & Sectionals','best-home-furnishings':'Sofas & Sectionals'}
RX=[(t,re.compile(r,re.I)) for t,r in RULES]
def typ(it):
    n=it['n'].lower(); c=it['c'].lower()
    for t,rx in RX:
        if rx.search(n): return t
    for t,rx in RX:
        if rx.search(c): return t
    return VENDOR_DEFAULT.get(it['v'],'Decor & Accessories')
def width(d,t):
    if not d or t=='Rugs': return 0
    m=re.search(r'(\d+(?:\.\d+)?)\s*(?:"|”|in\.?|\'\')?\s*W\b',d,re.I) or re.search(r'\bW(?:idth)?\s*[:.]?\s*(\d+(?:\.\d+)?)',d,re.I)
    if not m: m=re.match(r'\s*(\d+(?:\.\d+)?)\s*[x×]\s*\d',d)
    try: w=float(m.group(1)) if m else 0
    except: w=0
    return round(w,1) if 0<w<400 else 0
vk=list(V.keys()); vi={k:i for i,k in enumerate(vk)}
STOPW=set('the and with for this that from are its our your has have into over made each also features finish design piece pieces collection style look item which will more can any all adds add perfect home room space'.split())
def kw(it):
    words=re.findall(r'[a-z][a-z\-]{2,}',(it.get('x') or '').lower())
    out=[]; seen=set()
    for w in words:
        if w in STOPW or w in seen: continue
        seen.add(w); out.append(w)
        if len(out)>=14: break
    return ' '.join(out)
from dims import parse as pdims, rug_sizes, from_name
import glob
DIMMAP={}
for f in glob.glob('data/dims-*.json'): DIMMAP.update(json.load(open(f)))
def ft(x): return f"{x//12}'" + (f'{x%12}"' if x%12 else '')
def fmt_rug(a,b): return f'{ft(a)} x {ft(b)}'
def dims_of(it,t):
    src=[it['d'], DIMMAP.get(it['u'],''), it.get('x','')]
    rs=[]
    if t=='Rugs':
        for s_ in src+[it['n']]: rs+=rug_sizes(s_)
        rs=list(dict.fromkeys(rs))[:12]
    d={}
    for s_ in src:
        d=pdims(s_)
        if d: break
    if not d and t!='Rugs':
        w=from_name(it['n'])
        if w: d={'W':w}
    return d,rs
meta={'n':[],'i':[],'u':[],'v':[],'c':[],'d':[],'s':[],'k':[],'t':[],'w':[],'dd':[],'dh':[],'rs':[]}
for it in items:
    t=typ(it)
    nm=it['n']; nm=nm.title() if nm.isupper() and len(nm)>4 else nm
    cc=[x.strip() for x in re.split(r'>|/',it['c']) if x.strip()]; cc=cc[-1] if cc else ''; cc=cc.title() if cc.isupper() else cc
    meta['n'].append(nm); meta['i'].append(it['i']); meta['u'].append(it['u']); meta['v'].append(vi[it['v']])
    meta['c'].append(cc[:40]); meta['d'].append(it['d'][:48]); meta['s'].append(it['s'][:24]); meta['k'].append(kw(it)); meta['t'].append(TYPES.index(t))
    dm,rs=dims_of(it,t)
    meta['w'].append(round(dm.get('W',0),1)); meta['dd'].append(round(dm.get('D',0),1)); meta['dh'].append(round(dm.get('H',0),1))
    meta['rs'].append([a for p in rs for a in p] if rs else 0)
    if t=='Rugs' and rs: meta['d'][-1]=', '.join(fmt_rug(a,b) for a,b in rs[:4])+(' +more' if len(rs)>4 else '')
    elif not it['d'] and dm: meta['d'][-1]=' x '.join(f'{dm[k]:g}"{k}' for k in ('W','D','H') if k in dm)
meta['vendors']=[V[k] for k in vk]; meta['types']=TYPES
# representative image per type: best CLIP match for a plain product-photo prompt
sys.path.insert(0,'embed')
from textemb import etext
PROMPT={'Sofas & Sectionals':'a sofa','Chairs & Seating':'an upholstered accent chair','Tables':'a coffee table','Beds':'an upholstered bed','Dressers & Nightstands':'a wood dresser','Dining Storage':'a sideboard buffet','Cabinets & Shelving':'a bookcase','Desks & Office':'a writing desk','Lighting':'a table lamp','Rugs':'an area rug','Wall Art':'framed abstract wall art','Mirrors':'a round wall mirror','Pillows & Throws':'decorative throw pillows','Bedding':'a bed with duvet and pillows','Decor & Accessories':'a ceramic vase','Botanicals':'a potted faux plant','Outdoor':'an outdoor patio chair'}
TE=etext(['a product photo of '+PROMPT[t]+' on a white background' for t in TYPES])
tarr=np.array(meta['t']); sims=X@TE.T
meta['typeImg']=[]; meta['tcounts']=[]
for ti,t in enumerate(TYPES):
    idx=np.where(tarr==ti)[0]; meta['tcounts'].append(int(len(idx)))
    meta['typeImg'].append(meta['i'][int(idx[np.argmax(sims[idx,ti])])] if len(idx) else '')
meta['vcounts']=[meta['v'].count(i) for i in range(len(vk))]
meta['updated']=datetime.date.today().strftime('%b %-d, %Y')
os.makedirs('site/data',exist_ok=True)
json.dump(meta,open('site/data/meta.json','w'),separators=(',',':'))
Q.tofile('site/data/emb.bin')
import time; json.dump({'v':str(int(time.time()))},open('site/data/version.json','w'))
json.dump({'dim':D,'mean':[round(float(x),6) for x in mean],'comp':[[round(float(x),6) for x in r] for r in comp]},open('site/data/pca.json','w'),separators=(',',':'))
from collections import Counter
print(Counter(TYPES[t] for t in meta['t']).most_common())
hd=sum(1 for i in range(len(meta['n'])) if meta['w'][i] or meta['dd'][i] or meta['dh'][i] or meta['rs'][i]); print('with dims',hd,'of',len(meta['n']))
print('sizes MB', {f:round(os.path.getsize('site/data/'+f)/1e6,1) for f in os.listdir('site/data')})
