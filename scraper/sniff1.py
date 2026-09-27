import sys, asyncio
from playwright.async_api import async_playwright
async def main(u,pat):
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36')
        pg.on('request',lambda r: print(r.method,r.url,(r.post_data or '')[:500]) if pat in r.url else None)
        await pg.goto(u,timeout=60000); await pg.wait_for_timeout(8000); await b.close()
asyncio.run(main(sys.argv[1],sys.argv[2]))
