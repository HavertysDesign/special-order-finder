import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1400,'height':1000})
        pg.on('pageerror',lambda e: print('PAGEERR',str(e)[:300]))
        await pg.goto('http://localhost:8765/?v=2',timeout=60000); await pg.wait_for_timeout(6000)
        await pg.screenshot(path='/home/claude/vs/s_home.png')
        await pg.fill('#q','round travertine coffee table'); await pg.press('#q','Enter')
        for i in range(40):
            await pg.wait_for_timeout(3000); st=await pg.inner_text('#status')
            if 'Top' in st and 'keyword' not in st: break
        await pg.wait_for_timeout(3000); await pg.screenshot(path='/home/claude/vs/s_results.png')
        await pg.set_viewport_size({'width':390,'height':844}); await pg.wait_for_timeout(1500); await pg.screenshot(path='/home/claude/vs/s_mobile.png')
        await b.close()
asyncio.run(main())
