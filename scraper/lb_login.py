import asyncio, json
from playwright.async_api import async_playwright
from vsecrets import secret
env={k:secret(k) for k in ('LEFTBANK_USER','LEFTBANK_PASS')}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36')
        pg=await ctx.new_page()
        await pg.goto('https://www.leftbankart.com/login',timeout=60000); await pg.wait_for_timeout(4000)
        print(await pg.eval_on_selector_all('input','els=>els.map(e=>e.type+":"+e.name+":"+e.id)'))
        await pg.fill('#Email, input[name=Email], input[type=email]',env['LEFTBANK_USER'])
        await pg.fill('input[type=password]',env['LEFTBANK_PASS'])
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(8000)
        print('after',pg.url,await pg.title())
        await ctx.storage_state(path='../.lb_state.json'); await b.close()
asyncio.run(main())
