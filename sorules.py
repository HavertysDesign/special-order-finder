"""Describe each piece for the special-order rules. The site applies config/special-order-rules.json
itself at load time, so edits to the rules show up without rebuilding the catalog."""
import re
R = lambda p: re.compile(p, re.I)
GROUPS = ['accessories', 'lighting', 'linens_pillows', 'rugs', 'occasional', 'dining', 'casegoods', 'upholstery', 'upholstered_beds', 'outdoor', 'metal_beds_stools']
FLAG_PILLOWISH, FLAG_STRONG_UPH, FLAG_TYPE_SURE = 1 << 12, 1 << 13, 1 << 14
DINING = R(r'\bdining\b|\bcounter (height|stool)|\bbar (stool|height|table|cart|cabinet)|\bpub\b|\bbuffet|\bsideboard|\bserver\b|\bhutch\b|\bchina\b|\bside chair|\bsidechair')
STOOL = R(r'\bstools?\b'); BENCHY = R(r'\bbench(es)?\b|\bstools?\b|\bottomans?\b|\bpoufs?\b')
OUTDOOR = R(r'\boutdoor\b|\bpatio\b|\badirondack\b')
UPH = R(r'sofa|sectional|loveseat|settee|chaise|recliner|sleeper|swivel|glider|accent chair|lounge chair|club chair|wing ?chair|chair and a half|upholster|ottoman|\bchair\b')
CASE_MIRROR = R(r'dresser|landscape|vertical|mirror')
STRONG_UPH = R(r'reclin|\bpower\b|\bsofa|sectional|loveseat|\bsettee|swivel|glider|lift chair|chair and a half|\bchaise|\bwedge\b|\braf\b|\blaf\b|armless (chair|loveseat)|\bcuddler')
NOT_UPH_CONTEXT = R(r'dining|bar stool|counter stool|bench|bed\b|headboard')
PILLOWISH = R(r'pillow|throw|blanket|pouf|coverlet|sham|duvet')
def features(it, t, type_sure=True):
    x = f"{it.get('n','')} {it.get('c','')} {it.get('x','')[:160]}"
    nc = f"{it.get('n','')} {it.get('c','')}"
    g = set()
    if t in ('Decor & Accessories', 'Wall Art', 'Mirrors', 'Botanicals'): g.add('accessories')
    if t == 'Lighting': g.add('lighting')
    if t in ('Bedding', 'Pillows & Throws'): g.add('linens_pillows')
    if t == 'Rugs': g.add('rugs')
    dining = bool(DINING.search(x)) or t == 'Dining Storage'
    if (t == 'Tables' and not dining) or t == 'Cabinets & Shelving' or (BENCHY.search(x) and t in ('Chairs & Seating', 'Tables', 'Decor & Accessories')): g.add('occasional')
    if dining or (t == 'Chairs & Seating' and STOOL.search(x)): g.add('dining')
    if t in ('Beds', 'Dressers & Nightstands', 'Dining Storage', 'Cabinets & Shelving', 'Desks & Office', 'Tables') or (t == 'Mirrors' and CASE_MIRROR.search(x)) \
       or (t == 'Chairs & Seating' and (dining or BENCHY.search(x))): g.add('casegoods')
    if t == 'Sofas & Sectionals' or (t == 'Chairs & Seating' and UPH.search(x) and not STOOL.search(x) and not (dining and not UPH.search(x.replace('chair', '')))): g.add('upholstery')
    if t == 'Beds': g.add('upholstered_beds')
    if t == 'Beds' or (t == 'Chairs & Seating' and STOOL.search(x)): g.add('metal_beds_stools')
    if t == 'Outdoor' or OUTDOOR.search(x): g.add('outdoor')
    bits = sum(1 << GROUPS.index(k) for k in g)
    if t in ('Pillows & Throws', 'Bedding') or PILLOWISH.search(nc): bits |= FLAG_PILLOWISH
    if STRONG_UPH.search(nc) and not NOT_UPH_CONTEXT.search(nc): bits |= FLAG_STRONG_UPH
    if type_sure: bits |= FLAG_TYPE_SURE
    return bits
