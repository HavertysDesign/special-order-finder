import sys, asyncio, json, re
from playwright.async_api import async_playwright
async def main(u,pat):
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page()
        async def onr(resp):
            if 'graphql' in resp.url:
                try: t=await resp.text()
                except: t=''
                if re.search(pat,t,re.I):
                    print('URL',resp.url[:900]); print('RESP',t[:600]); print('---')
        pg.on('response',onr)
        await pg.goto(u,timeout=60000); await pg.wait_for_timeout(9000); await b.close()
asyncio.run(main(sys.argv[1],sys.argv[2]))
