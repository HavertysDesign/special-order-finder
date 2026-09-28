# Grab Four Hands' public (guest) Coveo search token from their site, for v_fourhands.py
import asyncio, json, re
from vsecrets import secret
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36')
        pg=await ctx.new_page(); got={}
        async def onreq(r):
            if 'coveo.com/rest/organizations' in r.url and 'auth' not in got:
                h=await r.all_headers()
                if h.get('authorization'): got['auth']=h['authorization']; got['url']=r.url; got['body']=r.post_data
        pg.on('request',onreq)
        await pg.goto('https://fourhands.com/login',timeout=60000); await pg.wait_for_timeout(5000)
        await pg.fill('input[type=text]',secret('FOURHANDS_USER')); await pg.fill('input[type=password]',secret('FOURHANDS_PASS'))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(10000)
        for u in ['https://fourhands.com/search?q=sofa','https://fourhands.com/','https://fourhands.com/category/living-room']:
            if 'auth' in got: break
            try: await pg.goto(u,timeout=60000); await pg.wait_for_timeout(12000)
            except Exception: pass
        await b.close()
    if 'auth' not in got: raise SystemExit('no coveo token found')
    base=re.match(r'(https://[^/]+/rest/organizations/[^/]+/commerce/v2)',got['url']).group(1)
    tmpl=json.loads(got['body'] or '{}')
    body={'trackingId':tmpl.get('trackingId','fourhands_us'),'clientId':tmpl.get('clientId'),'context':tmpl.get('context',{}),'language':'en','country':'US','currency':'USD','page':0,'facets':[],'sort':{'sortCriteria':'relevance'},'query':''}
    json.dump({'reqs':[{'url':base+'/search','body':json.dumps(body)}],'auth':got['auth']},open('../.fh_coveo.json','w'))
    print('ok')
asyncio.run(main())
