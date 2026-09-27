import sys, os, json, sqlite3, io, time, threading, queue
import numpy as np, requests
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0,os.path.dirname(__file__)); os.chdir(os.path.dirname(os.path.abspath(__file__)))
from emb import embed, prep
Image.MAX_IMAGE_PIXELS=12_000_000
import warnings; warnings.simplefilter('ignore')
DB=sys.argv[2] if len(sys.argv)>2 else 'emb_cache.sqlite'
cat=json.load(open(sys.argv[1]))['items']
con=sqlite3.connect(DB); con.execute('create table if not exists e(url text primary key, v blob, ok int)'); con.commit()
have={r[0] for r in con.execute('select url from e')}
urls=list(dict.fromkeys(it['i'] for it in cat if it['i'] not in have))
print('to embed',len(urls),'cached',len(have),flush=True)
H={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept':'image/avif,image/webp,image/*,*/*'}
tl=threading.local()
def fetch(u):
    if not hasattr(tl,'s'): tl.s=requests.Session(); tl.s.headers.update(H)
    for i in range(2):
        try:
            r=tl.s.get(u,timeout=30,stream=True)
            if int(r.headers.get('content-length') or 0)>15_000_000: r.close(); return u,None
            data=r.raw.read(15_000_001,decode_content=True)
            if len(data)>15_000_000: return u,None
            if r.status_code==200 and len(data)>500:
                im=Image.open(io.BytesIO(data)); im.draft('RGB',(512,512)); im.thumbnail((512,512)); im=im.convert('RGBA')
                bg=Image.new('RGB',im.size,(255,255,255)); bg.paste(im,mask=im.split()[3]); im=bg
                im.thumbnail((512,512)); return u,im
        except Exception as e: pass
    return u,None
q=queue.Queue(maxsize=96)
def producer():
    W=int(os.environ.get('WORKERS','8')); sem=threading.Semaphore(W*4)
    def job(u):
        try: q.put(fetch(u))
        finally: sem.release()
    with ThreadPoolExecutor(W) as ex:
        for u in urls:
            sem.acquire(); ex.submit(job,u)
    q.put(None)
threading.Thread(target=producer,daemon=True).start()
batch=[]; done=0; t0=time.time(); bad=0
def flush():
    global batch,done,bad
    good=[(u,im) for u,im in batch if im is not None]
    rows=[(u,None,0) for u,im in batch if im is None]; bad+=len(rows)
    if good:
        try: E=embed([im for _,im in good]).astype(np.float16)
        except Exception as ex:
            print('embed err',ex,flush=True); E=None
        if E is None:
            rows+=[(u,None,0) for u,_ in good]; good=[]
        rows+=[(u,E[k].tobytes(),1) for k,(u,_) in enumerate(good)] if good else []
    con.executemany('insert or replace into e values(?,?,?)',rows); con.commit()
    done+=len(batch); batch=[]
    import resource
    if resource.getrusage(resource.RUSAGE_SELF).ru_maxrss>3_500_000:
        print('memory high, restarting',flush=True); os._exit(3)
    if done % 1000 < 32: print(f'{done}/{len(urls)} bad={bad} {done/(time.time()-t0):.1f}/s',flush=True)
while True:
    x=q.get()
    if x is None: break
    batch.append(x)
    if len(batch)>=32: flush()
if batch: flush()
print('DONE',done,'bad',bad,flush=True)
