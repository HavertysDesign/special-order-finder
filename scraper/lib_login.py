import asyncio, json
from playwright.async_api import async_playwright
from vsecrets import secret
env={k:secret(k) for k in ('LIBERTY_USER','LIBERTY_PASS')}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',viewport={'width':1366,'height':900})
        pg=await ctx.new_page(); gql=[]
        pg.on('request',lambda r: gql.append((r.url,r.post_data,r.headers)) if 'graphql' in r.url else None)
        await pg.goto('https://www.mylibertyfurniture.com/login',timeout=60000); await pg.wait_for_timeout(6000)
        print(await pg.eval_on_selector_all('input','els=>els.map(e=>e.type+":"+e.name+":"+e.id)'))
        try: await pg.click('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',timeout=3000)
        except Exception: pass
        await pg.fill('input[type=email][name=email]',env['LIBERTY_USER'])
        await pg.fill('input[type=password]',env['LIBERTY_PASS'])
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(12000)
        print('after',pg.url,await pg.title())
        await ctx.storage_state(path='../.lib_state.json'); await b.close()
asyncio.run(main())
