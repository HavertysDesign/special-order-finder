import asyncio, os, json
from playwright.async_api import async_playwright
env=dict(l.strip().split('=',1) for l in open('../.secrets.env') if '=' in l)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',viewport={'width':1366,'height':900})
        pg=await ctx.new_page(); hits=[]
        async def onr(resp):
            if resp.request.resource_type in ('xhr','fetch') and 'fourhands' in resp.url:
                try: body=await resp.text()
                except: body=''
                hits.append((resp.status,resp.request.method,resp.url[:200],len(body),body[:200]))
        pg.on('response',onr)
        await pg.goto('https://fourhands.com/login',timeout=60000); await pg.wait_for_timeout(5000)
        ins=await pg.eval_on_selector_all('input','els=>els.map(e=>e.type+":"+e.name+":"+e.id)'); print(ins)
        await pg.fill('input[type=email], input[name*=mail i], input[type=text]',env['FOURHANDS_USER'])
        await pg.fill('input[type=password]',env['FOURHANDS_PASS'])
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(10000)
        print('after login',pg.url, await pg.title())
        await pg.goto('https://fourhands.com/category/living-room',timeout=60000); await pg.wait_for_timeout(10000)
        print('cat',pg.url,await pg.title())
        links=await pg.eval_on_selector_all('a[href]','els=>els.map(e=>e.href)')
        print(len(links),[l for l in links if '/product' in l][:5])
        for h in sorted(hits,key=lambda x:-x[3])[:12]: print(h)
        await ctx.storage_state(path='../.fh_state.json'); await b.close()
asyncio.run(main())
