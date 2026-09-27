import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1280,'height':900})
        pg.on('console',lambda m: print('CONSOLE',m.type,m.text[:300]) if m.type in ('error','warning') else None)
        pg.on('pageerror',lambda e: print('PAGEERR',str(e)[:300]))
        await pg.goto('http://localhost:8765/',timeout=60000); await pg.wait_for_timeout(4000)
        print('info',await pg.inner_text('#catalogInfo'))
        await pg.fill('#q','curved boucle swivel chair'); await pg.press('#q','Enter')
        for i in range(40):
            await pg.wait_for_timeout(3000); st=await pg.inner_text('#status')
            if 'Top' in st and 'keyword' not in st: break
        print('status',st)
        names=await pg.eval_on_selector_all('.card .name','e=>e.slice(0,8).map(x=>x.innerText)'); print(names)
        await pg.screenshot(path='../shot_text2.png')
        await pg.set_input_files('#photo','/home/claude/vs/embed/img0.jpg')
        for i in range(40):
            await pg.wait_for_timeout(3000); st=await pg.inner_text('#status')
            if 'Top' in st: break
        print('img status',st); print(await pg.eval_on_selector_all('.card .name','e=>e.slice(0,8).map(x=>x.innerText)'))
        await pg.wait_for_timeout(4000); await pg.screenshot(path='../shot_img2.png')
        await pg.set_viewport_size({'width':390,'height':844}); await pg.wait_for_timeout(1000); await pg.screenshot(path='../shot_mobile2.png')
        await b.close()
asyncio.run(main())
