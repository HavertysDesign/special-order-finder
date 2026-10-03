"""Refresh every vendor catalog. Each job runs independently; if a job fails or returns
far fewer products than last time, the previous data for that vendor is kept."""
import subprocess, sys, os, json, shutil, time
from concurrent.futures import ThreadPoolExecutor
os.chdir(os.path.dirname(os.path.abspath(__file__)))
PY=sys.executable
SHOP={'dalyn':'https://dalyn.com','ann-gish':'https://www.anngish.com','jamie-young':'https://www.jamieyoung.com','karastan':'https://www.karastanrugs.com','oriental-weavers':'https://owrugs.com'}
JOBS={
 'shopify':(['dalyn','ann-gish','jamie-young','karastan','oriental-weavers'],[[PY,'v_shopify.py']],1800),
 'surya':(['surya'],[[PY,'v_surya.py','https://www.surya.com','surya']],10800),
 'global-views':(['global-views'],[[PY,'v_surya.py','https://globalviews.surya.com','global-views']],5400),
 'riverside':(['riverside'],[[PY,'v_magento.py','https://www.riversidefurniture.com','riverside']],3600),
 'crestview':(['crestview'],[[PY,'v_magento.py','https://www.crestviewcollection.com','crestview']],3600),
 'wendover':(['wendover'],[[PY,'v_magento.py','https://www.wendoverart.com','wendover']],7200),
 'htd':(['home-trends-design-gql'],[[PY,'v_magento.py','https://www.htddirect.com','home-trends-design-gql']],3600),
 'hooker':(['hooker'],[[PY,'v_magento.py','https://hookerfurnishings.com','hooker']],5400),
 'paragon':(['paragon'],[[PY,'v_magento.py','https://www.paragonpg.com','paragon','paragon']],3600),
 'bernhardt':(['bernhardt'],[[PY,'v_bernhardt.py']],1800),
 'currey':(['currey'],[[PY,'v_currey.py']],5400),
 'stylecraft':(['stylecraft'],[[PY,'v_juniper.py','https://www.stylecraftonline.com','stylecraft']],3600),
 'harp-finial':(['harp-finial'],[[PY,'v_juniper.py','https://www.harpandfinial.com','harp-finial']],3600),
 'furniture-classics':(['furniture-classics'],[[PY,'v_fc.py']],1800),
 'magnussen':(['magnussen'],[[PY,'v_magnussen.py']],1800),
 'aico':(['aico'],[[PY,'v_aico.py']],3600),
 'art':(['art-furniture'],[[PY,'v_art.py']],1800),
 'four-hands':(['four-hands'],[[PY,'fh2.py'],[PY,'v_fourhands.py']],3600),
 'left-bank':(['left-bank'],[[PY,'lb_login.py'],[PY,'v_leftbank.py']],14400),
 'liberty':(['liberty'],[[PY,'lib_login.py'],[PY,'v_liberty.py']],3600),
 'besthf':(['best-home-furnishings'],[[PY,'v_pw.py','best-home-furnishings']],3600),
 'bassett':(['bassett-mirror'],[[PY,'v_pw.py','bassett-mirror']],3600),
 'kas':(['kas-rugs'],[[PY,'v_pw.py','kas-rugs']],3600),
 # Havertys' own catalog: exported from a browser session (havertys.com blocks servers); this step just keeps the saved file
 'havertys':(['havertys'],[[PY,'v_havertys.py']],60),
}
for k in ['amity-home','wesley-allen','artistic-leathers','cooper-classics','steve-silver','gascho','aspenhome','universal','sopoly','dw-silks','jonathan-louis']:
    JOBS[k]=([k],[[PY,'v_sitemap.py',k]],10800)
D='../data'
def count(k):
    for ext in ('.json','.jsonl'):
        p=f'{D}/{k}{ext}'
        if os.path.exists(p):
            try: return len(json.load(open(p))) if ext=='.json' else sum(1 for _ in open(p))
            except Exception: return 0
    return 0
def paths(k): return [f'{D}/{k}{e}' for e in ('.json','.jsonl') if os.path.exists(f'{D}/{k}{e}')]
def run(name):
    keys,cmds,to=JOBS[name]; before={k:count(k) for k in keys}
    bk={}
    for k in keys:
        for p in paths(k): shutil.copy(p,p+'.bak'); bk[p]=p+'.bak'
    ok=True; t=time.time()
    os.makedirs('../logs',exist_ok=True)
    with open(f'../logs/{name}.log','w') as lg:
        for c in cmds:
            try: r=subprocess.run(c,stdout=lg,stderr=subprocess.STDOUT,timeout=to)
            except subprocess.TimeoutExpired: ok=False; lg.write('TIMEOUT\n'); break
            if r.returncode: ok=False; break
    msgs=[]
    for k in keys:
        n=count(k); b=before[k]
        if (not ok and n<b) or (b and n<0.6*b):
            for p,bp in bk.items():
                if os.path.basename(p).startswith(k+'.'): shutil.copy(bp,p)
            msgs.append(f'{k}: KEPT PREVIOUS ({b}); new run gave {n}')
        else: msgs.append(f'{k}: {b} -> {n}')
    for bp in bk.values():
        if os.path.exists(bp): os.remove(bp)
    return f"[{name}] {'ok' if ok else 'FAILED'} {int(time.time()-t)}s | "+'; '.join(msgs)
only=sys.argv[1:] or list(JOBS)
with ThreadPoolExecutor(int(os.environ.get('JOBS','6'))) as ex:
    for line in ex.map(run,only): print(line,flush=True)
