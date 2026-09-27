import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--disable-blink-features=AutomationControlled'])
        ctx=await b.new_context(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',locale='en-US',viewport={'width':1366,'height':900})
        await ctx.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
        for u in sys.argv[1:]:
            pg=await ctx.new_page()
            try:
                await pg.goto(u,timeout=60000); await pg.wait_for_timeout(15000)
                t=await pg.title(); links=await pg.eval_on_selector_all('a[href]','e=>e.map(x=>x.href)')
                print('==',u,'|',t,'|',len(links),[l for l in links][:15])
            except Exception as e: print('==',u,'ERR',str(e)[:200])
            await pg.close()
        await b.close()
asyncio.run(main())
