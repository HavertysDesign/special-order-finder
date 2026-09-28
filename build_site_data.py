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
 ('Decor & Accessories',r'\bvases?\b'),
 ('Wall Art',r'\bwallpaper\b|\bmurals?\b'),
 ('Rugs',r'\brugs?\b|\brunner\b|\bdhurrie|\bkilim'),
 ('Bedding',r'\bduvet|\bquilt|\bsham\b|\bshams\b|coverlet|\bsheet set|\bbedding|\bbed skirt|\bbolster|\bcomforter|\bpillowcase'),
 ('Pillows & Throws',r'\bpillows?\b|\bthrows?\b|\bblanket'),
 ('Mirrors',r'\bmirrors?\b'),
 ('Lighting',r'\blamps?\b|chandelier|\bpendant|\bsconce|\blighting\b|lantern|flush mount|\bceiling light|\bfloor light|\bbulb'),
 ('Wall Art',r'\bwall art\b|\bcanvas\b|\bprints?\b|\bframed\b|\bartwork|\bpainting|giclee|\bart\b|wall decor|\bdiptych|\btriptych'),
 ('Outdoor',r'\boutdoor\b|\bpatio\b|adirondack|\bporch\b'),
 ('Botanicals',r'\bplants?\b|\btrees?\b|\bfloral\b|\bstems?\b|botanical|\bplanter\b|arrangement|\bflowers?\b|\bgreenery|\bpalm\b|\bfern\b|succulent|\borchid|\bboxwood|\btopiary'),
 ('Sofas & Sectionals',r'\bsofas?\b|sectional|loveseat|\bsettee|\bchaise|\bsleeper|\bchofa'),
 ('Beds',r'\bbeds?\b|headboard|footboard|daybed|trundle|\bbed frame|\bhb\b|\bfb\b|\bside rails?\b|\brails\b|\brails? (&|and) slats|\bking\b.*\bbed|\bqueen\b.*\bbed'),
 ('Dressers & Nightstands',r'\bdressers?\b|\bchessers?\b|nightstand|night stand|\bbedside|\bchests?\b|\barmoire|\bbachelor|\blingerie|\bvanity\b'),
 ('Desks & Office',r'\bdesks?\b|\bfile\b|\bcredenza desk|\bfile cabinet|\boffice\b|\bwriting table|\bbookcase desk'),
 ('Dining Storage',r'\bbuffet|side ?board|\bserver\b|\bhutch|\bchina\b|\bbar cabinet|\bwine\b'),
 ('Cabinets & Shelving',r'\bcabinets?\b|\bkitchen island|\bfireplace|\bpier\b|\bbridge\b|bookcase|etagere|\bmedia\b|entertainment|credenza|\bshel(f|ves)|\bconsole cabinet|\bstorage\b|\bcurio|\bdisplay\b'),
 ('Chairs & Seating',r'\bchairs?\b|armchair|\blounge chair|\bbar stool|recliner|\bstools?\b|\bbench(es)?\b|\bottomans?\b|\bpoufs?\b|glider|rocker|\bseating\b|\bswivel'),
 ('Tables',r'\btables?\b|\bconsoles?\b|\bcocktail\b|\bend table|\bside table|\bpedestal\b|\bnesting'),
 ('Decor & Accessories',r'\bvases?\b|\bbowls?\b|sculpture|\bbox(es)?\b|\bobjects?\b|\btrays?\b|\bclocks?\b|\bcandle|\bdecor\b|accessor|\bbaskets?\b|bookend|\bfigur|\bjars?\b|\bplatter|\bstatue|\borb\b|\bfinial|\bscreen\b|\blantern'),
]
VENDOR_DEFAULT={'wendover':'Wall Art','left-bank':'Wall Art','dalyn':'Rugs','karastan':'Rugs','kas-rugs':'Rugs','oriental-weavers':'Rugs','dw-silks':'Botanicals','sopoly':'Outdoor','amity-home':'Bedding','ann-gish':'Bedding','crestview':'Lighting','stylecraft':'Lighting','paragon':'Wall Art','harp-finial':'Wall Art','cooper-classics':'Mirrors','wesley-allen':'Beds','artistic-leathers':'Sofas & Sectionals','best-home-furnishings':'Sofas & Sectionals'}
RX=[(t,re.compile(r,re.I)) for t,r in RULES]
TYPE_SURE={}
VDEF=set()
def typ(it):
    n=it['n'].lower(); c=it['c'].lower()
    for t,rx in RX:
        if rx.search(n): TYPE_SURE[id(it)]=True; return t
    for t,rx in RX:
        if rx.search(c): TYPE_SURE[id(it)]=True; return t
    TYPE_SURE[id(it)]=it['v'] in VENDOR_DEFAULT
    if it['v'] in VENDOR_DEFAULT: VDEF.add(id(it))
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
    low=(it.get('x') or '').lower()
    for w in ('performance','crypton','sunbrella','leather','velvet','boucle','outdoor','linen','marble','travertine','rattan','teak','brass'):
        if w in low and w not in seen: out.append(w)
    return ' '.join(out)
from dims import parse as pdims, rug_sizes, from_name
import glob
DIMMAP={}
for f in glob.glob('data/dims-*.json'):
    try: DIMMAP.update(json.load(open(f)))
    except Exception as e: print('skipping unreadable',f,e)
def ft(x): return f"{x//12}'" + (f'{x%12}"' if x%12 else '')
def fmt_rug(a,b): return f'{ft(a)} x {ft(b)}'
# same product, other color variant (Four Hands urls end in -001, -013 ...): sizes match
_base=lambda u: re.sub(r'-\d{3}$','',u or '')
DIMBASE={}
for _u,_d in DIMMAP.items(): DIMBASE.setdefault(_base(_u),_d)
def dims_of(it,t):
    src=[it['d'], DIMMAP.get(it['u']) or DIMBASE.get(_base(it['u']),''), it.get('x','')]
    rs=[]
    if t=='Rugs':
        for s_ in src+[it['n']]: rs+=rug_sizes(s_)
        rs=list(dict.fromkeys(rs))[:12]
    d={}
    for s_ in src:
        d=pdims(s_)
        if d: break
    if t=='Rugs' and not rs and d.get('W') and d.get('D') and max(d['W'],d['D'])>=24:
        a_,b_=sorted((int(round(d['W'])),int(round(d['D'])))); rs=[(a_,b_)]
    if not d and t!='Rugs':
        w=from_name(it['n'])
        if w: d={'W':w}
    return d,rs
from sorules import features as so_features, GROUPS as SO_GROUPS
meta={'qs':[],'n':[],'i':[],'u':[],'v':[],'c':[],'d':[],'s':[],'k':[],'t':[],'w':[],'dd':[],'dh':[],'rs':[],'sg':[]}
# CLIP check on each product photo: fixes pieces whose names don't say what they are
sys.path.insert(0,'embed')
from textemb import etext as _etext
_TP={'Sofas & Sectionals':['a sofa','a sectional sofa','a loveseat','a reclining sofa'],'Chairs & Seating':['an armchair','an accent chair','a recliner chair','an ottoman','a bench','a bar stool','a dining chair'],
 'Tables':['a coffee table','a side table','a dining table','a console table'],'Beds':['a bed','an upholstered bed','a headboard'],'Dressers & Nightstands':['a dresser','a nightstand','a chest of drawers'],
 'Dining Storage':['a sideboard buffet','a china cabinet'],'Cabinets & Shelving':['a bookcase','a cabinet','a media console'],'Desks & Office':['a writing desk','an office desk'],
 'Lighting':['a table lamp','a floor lamp','a chandelier','a pendant light','a wall sconce'],'Rugs':['an area rug','a round rug'],'Wall Art':['framed wall art','a painting on canvas'],
 'Mirrors':['a wall mirror','a floor mirror'],'Pillows & Throws':['a throw pillow','a throw blanket'],'Bedding':['a duvet cover set','bed sheets and shams'],
 'Decor & Accessories':['a vase','a decorative bowl','a sculpture','a decorative object'],'Botanicals':['a potted plant','a faux tree','a floral arrangement'],'Outdoor':['outdoor patio furniture']}
_TE=[]
for _t in TYPES:
    _e=_etext(['a product photo of '+p for p in _TP[_t]]); _m=_e.mean(0); _TE.append(_m/np.linalg.norm(_m))
_TE=np.stack(_TE); _L=(X@_TE.T)*100; _L-=_L.max(1,keepdims=True); _P=np.exp(_L); _P/=_P.sum(1,keepdims=True)
_ci=0; _fix=0; _FIXLOG=[]
# Botanicals = faux plants, florals, trees, stems and the planters/pots they come in. Nothing else.
_ART_VENDORS={'left-bank','wendover','paragon','harp-finial'}
_RUG_VENDORS={'dalyn','karastan','kas-rugs','oriental-weavers'}
_PLANT=re.compile(r'\b(faux|artificial|silk|potted|planters?|pots?|topiar(y|ies)|plants?|trees?|stems?|sprays?|bouquets?|arrangements?|succulents?|orchids?|ferns?|palms?|olive|ficus|fig|eucalyptus|boxwood|greenery|garland|wreaths?|florals?|flowers?|blooms?|peon(y|ies)|roses?|hydrangeas?|magnolias?|branch(es)?|grass(es)?|moss|agave|aloe|cactus|cacti|echeveria|ivy|dracaena|monstera|philodendron|sansevieria|bamboo|botanical)\b',re.I)
_NOTPLANT=re.compile(r'\b(art|print|canvas|painting|framed|frame|giclee|photograph|photography|wall decor|mirror|rug|runner|pillow|throw|table|desk|chair|sofa|bed|dresser|chest|cabinet|sideboard|console|bench|lamp|chandelier|pendant|sconce|stool|ottoman|bookcase|nightstand|server|buffet|credenza|wallpaper|mural|tray|clock|sculpture|charger|coaster|plate|platter|bowl|box|swatch|swatches|fabric|linen|base|pod|object|hall tree|figure|figurine|bookend)s?\b',re.I)
_STRONG_PLANT=re.compile(r'\b(faux|artificial|potted|planters?|pots?|topiar(y|ies)|plants?|succulents?|stems?|arrangements?|bouquets?|greenery|wreaths?|garlands?)\b',re.I)
_NOPLANT_CAT=re.compile(r'\b(art|print|canvas|photograph|photography|painting|wall decor|rugs?|furniture|upholstery|bedroom|dining|lighting|mirrors?|fabrics?|swatch(es)?|pillows?|bedding|trays?|sculptur\w*|occasional|tabletop|dinnerware)\b',re.I)
def _botanical_ok(it,p=None):
    if it['v']=='dw-silks': return True
    if it['v'] in _ART_VENDORS or it['v'] in _RUG_VENDORS: return False
    n=it['n']
    if _NOTPLANT.search(n) or _NOPLANT_CAT.search(it['c'] or ''): return False
    if _STRONG_PLANT.search(n): return True
    # a plant word alone ("Fuyuki Tree") counts only when the photo clearly shows a plant
    return bool(_PLANT.search(n)) and p is not None and p[TYPES.index('Botanicals')]>0.6
def _dw_type(it):
    n=it['n']
    has_plant=' in ' in n.lower() or bool(_PLANT.search(n)) and not re.search(r'\b(stones?|gravel|river rock)\b',n,re.I) or ' with ' in n.lower()
    if has_plant or re.search(r'\b(planters?|pots?)\b',n,re.I): return 'Botanicals'
    if re.search(r'\b(stones?|gravel|river rock|rattan ball|shel(f|ves)|racks?)\b',n,re.I): return 'Decor & Accessories'
    return 'Botanicals'   # containers, jars, wall pockets: plant containers
def _not_botanical(it,p):
    n=it['n'].lower(); c=(it['c'] or '').lower()
    if re.search(r'fabric|swatch|trim',c+' '+n): return 'Decor & Accessories'
    for src in (n,c):
        for tt,rx in RX:
            if tt!='Botanicals' and rx.search(src): return tt
    if it['v'] in VENDOR_DEFAULT and VENDOR_DEFAULT[it['v']]!='Botanicals': return VENDOR_DEFAULT[it['v']]
    q=p.copy(); q[TYPES.index('Botanicals')]=-1
    return TYPES[int(q.argmax())]
_STRONG={'Tables':r'\btables?\b','Chairs & Seating':r'\bchairs?\b|\brecliner|\bottoman|\bstool|\bbench','Sofas & Sectionals':r'\bsofas?\b|sectional|loveseat',
 'Desks & Office':r'\bdesks?\b','Dressers & Nightstands':r'\bdresser|nightstand|\bchests?\b','Beds':r'\bbeds?\b|headboard','Lighting':r'\blamps?\b|chandelier|pendant|sconce',
 'Rugs':r'\brugs?\b','Mirrors':r'\bmirrors?\b','Cabinets & Shelving':r'bookcase|\bcabinet|etagere','Dining Storage':r'buffet|sideboard|server'}
def _named(t,nm): return bool(_STRONG.get(t) and re.search(_STRONG[t],nm))
_NOFIX=re.compile(r'\b(swatch|sample|fabric card|finish chip|memo)\b')
_SEAT=re.compile(r'\b(bench|ottoman|stool|pouf|settee)s?\b')
_SWT=re.compile(r'\b(fabric|leather|finish|grade)\b')
for it in items:
    t=typ(it)
    _p=_P[_ci]; _b=int(_p.argmax()); _ci+=1
    _old=t
    _nm=it['n'].lower()
    _skip=bool(_NOFIX.search(_nm)) or bool(re.search(r'fabric|leather|swatch|finish|trim',it['c'],re.I)) or (TYPES[_b] in ('Tables','Sofas & Sectionals') and _SEAT.search(_nm)) or (TYPES[_b] in ('Rugs','Beds') and _SWT.search(_nm))
    if not _skip and _named(t,_nm) and not _named(TYPES[_b],_nm): _skip=True
    if _skip: pass
    elif id(it) in VDEF and t not in ('Rugs','Bedding') and TYPES[_b]!='Rugs' and _p[_b]>0.6 and _p[TYPES.index(t)]<0.1: t=TYPES[_b]; _fix+=1
    elif not TYPE_SURE.get(id(it),True) and _p[_b]>0.5: t=TYPES[_b]; TYPE_SURE[id(it)]=True; _fix+=1
    elif TYPE_SURE.get(id(it)) and _p[TYPES.index(t)]<0.03 and _p[_b]>0.75 and t not in ('Outdoor','Rugs','Bedding','Pillows & Throws','Mirrors') \
         and TYPES[_b] in ('Wall Art','Sofas & Sectionals','Chairs & Seating','Tables','Dressers & Nightstands','Cabinets & Shelving') \
         and not (t=='Wall Art'): t=TYPES[_b]; _fix+=1
    if it['v']=='dw-silks': t=_dw_type(it)   # a faux-plant vendor: plants, florals and their containers
    elif t=='Botanicals' and not _botanical_ok(it,_p): t=_not_botanical(it,_p)
    if t!=_old: _FIXLOG.append((it['v'],it['n'][:50],_old,t))
    nm=it['n']; nm=nm.title() if nm.isupper() and len(nm)>4 else nm
    cc=[x.strip() for x in re.split(r'>|/',it['c']) if x.strip() and not re.search(r'\bin ?stock\b|quick ?ship|express ship|\bsale\b|^new\b',x.strip(),re.I)]; cc=cc[-1] if cc else ''; cc=cc.title() if cc.isupper() else cc
    meta['n'].append(nm); meta['i'].append(it['i']); meta['u'].append(it['u']); meta['v'].append(vi[it['v']])
    meta['c'].append(cc[:40]); meta['d'].append(it['d'][:48]); meta['s'].append(it['s'][:24]); meta['k'].append(kw(it)); meta['t'].append(TYPES.index(t))
    meta['sg'].append(so_features(it,t,TYPE_SURE.get(id(it),True)))
    if it.get('q'): meta['qs'].append(len(meta['n'])-1)
    dm,rs=dims_of(it,t)
    meta['w'].append(round(dm.get('W',0),1)); meta['dd'].append(round(dm.get('D',0),1)); meta['dh'].append(round(dm.get('H',0),1))
    meta['rs'].append([a for p in rs for a in p] if rs else 0)
    if t=='Rugs' and rs: meta['d'][-1]=', '.join(fmt_rug(a,b) for a,b in rs[:4])+(' +more' if len(rs)>4 else '')
    elif not it['d'] and dm: meta['d'][-1]=' x '.join(f'{dm[k]:g}"{k}' for k in ('W','D','H') if k in dm)
meta['vendors']=[V[k] for k in vk]; meta['types']=TYPES
meta['vkeys']=vk; meta['sogroups']=SO_GROUPS
import shutil; shutil.copy('config/special-order-rules.json','site/data/special-order-rules.json')
json.dump({'keys':vk,'names':[V[k] for k in vk],'counts':[meta['v'].count(i) for i in range(len(vk))]},open('site/data/vendors.json','w'))
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
# product colors (3 Lab clusters x L,a,b,share per item; zeros = unknown)
con.execute('create table if not exists c(url text primary key, c blob)')
_CC={u:c for u,c in con.execute('select url,c from c')}
_col=bytearray(12*len(items)); _nc=0
for _j,it in enumerate(items):
    c=_CC.get(it['i'])
    if c: _col[12*_j:12*_j+12]=c; _nc+=1
open('site/data/col.bin','wb').write(bytes(_col)); print('with colors',_nc,'of',len(items))
import time; json.dump({'v':str(int(time.time()))},open('site/data/version.json','w'))
json.dump({'dim':D,'mean':[round(float(x),6) for x in mean],'comp':[[round(float(x),6) for x in r] for r in comp]},open('site/data/pca.json','w'),separators=(',',':'))
from collections import Counter
print(Counter(TYPES[t] for t in meta['t']).most_common())
hd=sum(1 for i in range(len(meta['n'])) if meta['w'][i] or meta['dd'][i] or meta['dh'][i] or meta['rs'][i]); print('with dims',hd,'of',len(meta['n']))
print('types corrected by photo:',_fix); json.dump(_FIXLOG,open('/tmp/typefix.json','w'))
print('sizes MB', {f:round(os.path.getsize('site/data/'+f)/1e6,1) for f in os.listdir('site/data')})
