import sys, asyncio, re, json
from playwright.async_api import async_playwright
async def collect(seeds, follow, prod, maxpages=400, conc=4):
    seen=set(seeds); q=list(seeds); prods=set()
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36')
        async def visit(u):
            pg=await ctx.new_page()
            try:
                await pg.goto(u,timeout=60000,wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
                for _ in range(6): await pg.mouse.wheel(0,4000); await pg.wait_for_timeout(700)
                hs=await pg.eval_on_selector_all('a[href]','els=>els.map(e=>e.href)')
            except Exception as e: hs=[]
            await pg.close(); return hs
        n=0
        while q and n<maxpages:
            batch=q[:conc]; q=q[conc:]; n+=len(batch)
            for hs in await asyncio.gather(*[visit(u) for u in batch]):
                for h in hs:
                    h=h.split('#')[0]
                    if re.search(prod,h): prods.add(h)
                    elif re.search(follow,h) and h not in seen: seen.add(h); q.append(h)
        await b.close()
    return sorted(prods), n
if __name__=='__main__':
    cfg=json.loads(sys.argv[1])
    prods,n=asyncio.run(collect(cfg['seeds'],cfg['follow'],cfg['prod'],cfg.get('max',400)))
    json.dump(prods,open(cfg['out'],'w')); print('pages',n,'products',len(prods))
