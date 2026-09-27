import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36')
        pg=await ctx.new_page(); reqs=[]
        pg.on('request',lambda r: reqs.append(r) if 'coveo' in r.url else None)
        await pg.goto('https://fourhands.com/search?q=sofa',timeout=60000); await pg.wait_for_timeout(12000)
        tok=[ (await r.all_headers()).get('authorization') for r in reqs]
        json.dump({'reqs':[{'url':r.url,'body':r.post_data} for r in reqs],'auth':next((t for t in tok if t),None)},open('../.fh_coveo.json','w'))
        await b.close()
asyncio.run(main())
