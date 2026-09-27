from run import *
import common
st=json.load(open('../.lb_state.json'))
_orig=common.sess
def s2():
    s=_orig()
    if not getattr(s,'_lb',False):
        for c in st['cookies']: s.cookies.set(c['name'],c['value'],domain=c['domain'],path=c['path'])
        s._lb=True
    return s
common.sess=s2
L=[u for u in sitemap_locs('https://www.leftbankart.com/sitemap.xml') if re.match(r'^https://www\.leftbankart\.com/[A-Za-z0-9]{6,}$',u) and len(re.findall(r'\d',u.split('/')[-1]))>=2]
def fn(u):
    r=common.get(u)
    if not r or r.status_code!=200 or 'login' in r.url.lower(): return None
    p=generic_extract(u,r)
    if 'Login' in p.get('name',''): return None
    p['category']=('Wall Art > '+p.get('category','')).strip(' >')
    return p
crawl(L,fn,workers=5,name='left-bank'); print('DONE')
