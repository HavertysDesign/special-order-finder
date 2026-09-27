import json, requests, sys
st=json.load(open('../.lib_state.json')); s=requests.Session()
for c in st['cookies']: s.cookies.set(c['name'],c['value'],domain=c['domain'],path=c['path'])
ls={}
for o in st.get('origins',[]):
    for kv in o.get('localStorage',[]): ls[kv['name']]=kv['value']
tok=next((v for k,v in ls.items() if 'token' in k.lower()),None)
H={'content-type':'application/json','User-Agent':'Mozilla/5.0'}
if tok: H['authorization']='Bearer '+tok.strip('"')
def q(query,variables=None):
    return s.post('https://www.mylibertyfurniture.com/api/graphql',json={'query':query,'variables':variables or {}},headers=H,timeout=60).json()
if __name__=='__main__':
    print('ls keys',list(ls.keys())[:20], 'tok', bool(tok))
    print(json.dumps(q('query{me{__typename}}'))[:300])
    j=q('{__schema{queryType{fields{name args{name}}}}}')
    fs=j.get('data',{}).get('__schema',{}).get('queryType',{}).get('fields',[]) if j.get('data') else []
    print(len(fs)); print([ (f['name'],[a['name'] for a in f['args']]) for f in fs if any(k in f['name'].lower() for k in ('product','item','search','catalog','collection','categor','group'))])
    if not fs: print(json.dumps(j)[:500])
