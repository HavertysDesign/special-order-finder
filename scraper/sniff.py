import sys, asyncio, json
from playwright.async_api import async_playwright
async def main(urls):
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--disable-blink-features=AutomationControlled'])
        for u in urls:
            ctx=await b.new_context(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',viewport={'width':1366,'height':900})
            pg=await ctx.new_page(); hits=[]
            async def onr(resp):
                ct=resp.headers.get('content-type','')
                if 'json' in ct and resp.request.resource_type in ('xhr','fetch'):
                    try: body=await resp.text()
                    except: body=''
                    hits.append((resp.status,resp.request.method,resp.url[:180],len(body),body[:150].replace('\n',' ')))
            pg.on('response',onr)
            try:
                await pg.goto(u,timeout=60000,wait_until='domcontentloaded'); await pg.wait_for_timeout(8000)
                await pg.mouse.wheel(0,3000); await pg.wait_for_timeout(3000)
                t=await pg.title(); links=await pg.eval_on_selector_all('a[href]','els=>els.map(e=>e.href)')
            except Exception as e: t='ERR '+str(e)[:100]; links=[]
            print('=====',u,'|',t,'| links',len(links))
            for h in sorted(hits,key=lambda x:-x[3])[:8]: print('  ',h)
            import collections
            c=collections.Counter('/'.join(l.split('/')[3:4])[:25] for l in links if l.startswith('http'))
            print('   linkpaths',c.most_common(10))
            await ctx.close()
        await b.close()
asyncio.run(main(sys.argv[1:]))
