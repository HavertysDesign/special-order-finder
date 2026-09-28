"""Parse product dimensions (inches) from free text: returns dict W,D,H (0 = unknown) and rug sizes."""
import re
NUM=r'(\d+(?:\.\d+)?)(?:\s*(?:-|\s)\s*(\d)/(\d))?'   # 30, 30.5, 30 1/2, 30-1/2
def n(m,i):
    v=float(m.group(i))
    if m.group(i+1): v+=int(m.group(i+1))/int(m.group(i+2))
    return v
IN=r'\s*(?:"|”|“|″|\'\'|in\b\.?|inch(?:es)?\b)?\s*'
LAB={'w':'W','width':'W','wide':'W','l':'W','length':'W','long':'W','dia':'W','diameter':'W','diam':'W','round':'W','d':'D','depth':'D','deep':'D','h':'H','height':'H','high':'H','tall':'H','ht':'H'}
LABRE=r'(width|wide|length|long|diameter|diam|dia|depth|deep|height|high|tall|ht|w|l|d|h)\b\.?'
PARTS=re.compile(r'\b(leg|seat|seat back|back|arm|shelf|shelves|drawer|door|top|bench top|table top|interior|inside|opening|cushion|frame|base|clearance|between \w+|overhang|floor rest)\s+(width|depth|height|thickness|length)\s*[:=]?\s*[\d./ -]+\s*("|”|in\b\.?|inches)?',re.I)
def strip_parts(t):
    """part measurements (Leg Width: 2\", Seat Height 18\", Shelf Depth...) are not the piece's size"""
    return PARTS.sub(' ',t or '')
def parse(text):
    t=(text or '').replace('\u00a0',' ')
    t=re.sub(r"\d{1,2}\s*'\s*(\d{1,2}\s*(\"|”|''))?",' ',t)   # drop feet measurements (rug sizes)
    t=strip_parts(t)
    out={}
    def label_first():
        for m in re.finditer(r'\b'+LABRE+r'\s*[:=]?\s*'+NUM,t,re.I):
            k=LAB.get(m.group(1).lower().rstrip('.'))
            if k and k not in out: out[k]=n(m,2)
    def number_first():
        for m in re.finditer(NUM+IN+LABRE,t,re.I):
            k=LAB.get(m.group(4).lower().rstrip('.'))
            if k and k not in out: out[k]=n(m,1)
    if re.search(r'\b(width|depth|height|diameter|w|d|h)\s*[:=]\s*\d',t,re.I): label_first(); number_first()
    else: number_first(); label_first()
    if not out:
        m=re.search(r'\b(\d{1,3}(?:\.\d+)?)\s*"?\s*[x×X]\s*(\d{1,3}(?:\.\d+)?)\s*"?(?:\s*[x×X]\s*(\d{1,3}(?:\.\d+)?))?',t)
        if m:
            out['W']=float(m.group(1)); out['D']=float(m.group(2))
            if m.group(3): out['H']=float(m.group(3))
    return {k:v for k,v in out.items() if 0.5<v<400}
def rug_sizes(text):
    """8' x 10', 5'3" x 7'6", 8x10 -> list of (w,l) inches"""
    s=[]
    for m in re.finditer(r"(\d{1,2})\s*'\s*(?:(\d{1,2})\s*(?:\"|”|''))?\s*[x×X]\s*(\d{1,2})\s*'\s*(?:(\d{1,2})\s*(?:\"|”|''))?",text or ''):
        a=int(m.group(1))*12+int(m.group(2) or 0); b=int(m.group(3))*12+int(m.group(4) or 0); s.append((min(a,b),max(a,b)))
    m=re.search(r"(\d{1,2})\s*'\s*(?:(\d{1,2})\s*(?:\"|”))?\s*(round|square)",text or '',re.I)
    if m: a=int(m.group(1))*12+int(m.group(2) or 0); s.append((a,a))
    return list(dict.fromkeys(s))
def from_name(name):
    """66" Executive Desk / Console Table - 79" -> a bare size in the name (width-ish)"""
    m=re.search(r'(\d{2,3}(?:\.\d+)?)\s*(?:"|”|in\b|inch)',name or '',re.I)
    return float(m.group(1)) if m else 0
if __name__=='__main__':
    for s in ['98"W x 41"D x 41"H','W:21 x D:17 x H:42','H:8.0 W:6.0 D:11.0','54x54x30','Width: 84 in. Depth 40"','13.75"h x 8"w x 5"d','Outside Dimensions: 49“W x 39“D x 34“H','30 1/2" W x 20" D',"8' x 10'","5'3\" x 7'6\""]:
        print(s,'->',parse(s),rug_sizes(s))
