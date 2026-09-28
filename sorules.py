"""Decide whether Havertys can special order a piece, from config/special-order-rules.json."""
import json, re, os
RULES = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config', 'special-order-rules.json')))
R = lambda p: re.compile(p, re.I)
LAMP = R(r'\blamps?\b'); FIXT = R(r'chandelier|pendant|sconce|flush ?mount|semi-?flush|ceiling|lantern|vanity light|island light|linear')
DINING = R(r'\bdining\b|\bcounter (height|stool)|\bbar (stool|height|table|cart|cabinet)|\bpub\b|\bbuffet|\bsideboard|\bserver\b|\bhutch\b|\bchina\b|\bside chair|\bsidechair|\barm ?chair\b.*dining')
STOOL = R(r'\bstools?\b'); BENCHY = R(r'\bbench(es)?\b|\bstools?\b|\bottomans?\b|\bpoufs?\b')
OUTDOOR = R(r'\boutdoor\b|\bpatio\b|\badirondack\b')
UPH = R(r'sofa|sectional|loveseat|settee|chaise|recliner|sleeper|swivel|glider|accent chair|lounge chair|club chair|wing ?chair|chair and a half|upholster|ottoman|\bchair\b')
CASE_MIRROR = R(r'dresser|landscape|vertical|mirror')
def groups(it, t):
    x = f"{it.get('n','')} {it.get('c','')} {it.get('x','')[:160]}"
    g = set()
    if t in ('Decor & Accessories', 'Wall Art', 'Mirrors', 'Botanicals'): g.add('accessories')
    if t == 'Lighting' and LAMP.search(x) and not FIXT.search(x): g.add('lamps')
    if t in ('Bedding', 'Pillows & Throws'): g.add('linens_pillows')
    if t == 'Rugs': g.add('rugs')
    dining = bool(DINING.search(x)) or t == 'Dining Storage'
    if (t == 'Tables' and not dining) or t == 'Cabinets & Shelving' or BENCHY.search(x) and t in ('Chairs & Seating', 'Tables', 'Decor & Accessories'): g.add('occasional')
    if dining or (t == 'Chairs & Seating' and STOOL.search(x)): g.add('dining')
    if t in ('Beds', 'Dressers & Nightstands', 'Dining Storage', 'Cabinets & Shelving', 'Desks & Office', 'Tables') or (t == 'Mirrors' and CASE_MIRROR.search(x)) \
       or (t == 'Chairs & Seating' and (dining or BENCHY.search(x))): g.add('casegoods')
    if t == 'Sofas & Sectionals' or (t == 'Chairs & Seating' and UPH.search(x) and not STOOL.search(x) and not (dining and not UPH.search(x.replace('chair', '')))): g.add('upholstery')
    if t == 'Beds': g.add('upholstered_beds'); 
    if t == 'Beds' or (t == 'Chairs & Seating' and STOOL.search(x)): g.add('metal_beds_stools')
    if t == 'Outdoor' or OUTDOOR.search(x): g.add('outdoor')
    return g
STRONG_UPH = R(r'reclin|\bpower\b|\bsofa|sectional|loveseat|\bsettee|swivel|glider|lift chair|chair and a half|\bchaise')
PILLOWISH = R(r'pillow|throw|blanket|pouf|coverlet|sham|duvet')
def status(vendor, it, t, type_sure=True):
    """1 = can order, 2 = check (price-list vendor, or we couldn't tell what the piece is), 0 = not on the approved list"""
    allow = RULES['vendors'].get(vendor)
    if not allow or 'everything' in allow: return 1
    if 'price_list' in allow: return 2
    a = set(allow); x = f"{it.get('n','')} {it.get('c','')}"
    if a == {'rugs'}: return 0 if (t in ('Pillows & Throws', 'Bedding') or PILLOWISH.search(x)) else 1      # rug houses: everything but their soft goods
    if a == {'outdoor'}: return 1                                                                         # outdoor-only maker
    if a <= {'upholstery', 'upholstered_beds'}:                                                           # upholstery houses
        return 0 if t in ('Rugs', 'Lighting', 'Wall Art', 'Bedding', 'Mirrors', 'Botanicals') else 1
    if not (a & {'upholstery', 'everything'}) and STRONG_UPH.search(x) and not re.search(r'dining|bar stool|counter stool|bench|bed\b|headboard', x, re.I): return 0
    if groups(it, t) & a: return 1
    return 0 if type_sure else 2
def label(vendor):
    allow = RULES['vendors'].get(vendor) or ['everything']
    return '; '.join(RULES['groups'][a] for a in allow)
