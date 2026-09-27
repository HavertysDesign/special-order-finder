import asyncio, json, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(storage_state='../.lib_state.json',user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',viewport={'width':1366,'height':900})
        pg=await ctx.new_page(); gql=[]
        async def onr(resp):
            if 'graphql' in resp.url:
                try: gql.append((json.loads(resp.request.post_data or '{}'),await resp.text()))
                except Exception: pass
        pg.on('response',onr)
        await pg.goto('https://www.mylibertyfurniture.com/',timeout=60000); await pg.wait_for_timeout(8000)
        await pg.get_by_text('BEDROOM',exact=True).first.click(); await pg.wait_for_timeout(3000)
        links=await pg.eval_on_selector_all('a[href]','els=>els.map(e=>e.innerText.trim()+" => "+e.getAttribute("href"))')
        print([l for l in links if '=> /' in l][:60])
        n=len(gql)
        cands=[l.split(' => ')[1] for l in links if '=> /' in l and ('product' in l.lower() or 'categor' in l.lower() or 'bed' in l.lower())]
        if cands:
            await pg.goto('https://www.mylibertyfurniture.com'+cands[0],timeout=60000); await pg.wait_for_timeout(10000)
            print('URL',pg.url); print((await pg.inner_text('body'))[1500:2500])
        for d,t in gql[n:]:
            if d.get('operationName') not in ('Me','GetShoppingCart','countPromotionsByUser','promotionsByFilter','getQuote','getWishlist','GetActiveHotDeals','GetContainerItemClassCount'):
                print('OP',d.get('operationName'),json.dumps(d.get('variables'))[:400]); print('   Q',(d.get('query') or '')[:1500]); print('   R',t[:1500])
        await b.close()
asyncio.run(main())
