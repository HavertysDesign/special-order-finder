import sys, asyncio
from playwright.async_api import async_playwright
async def main(u,js):
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36')
        await pg.goto(u,timeout=60000); await pg.wait_for_timeout(9000)
        print(await pg.evaluate(js)); await b.close()
asyncio.run(main(sys.argv[1],sys.argv[2]))
