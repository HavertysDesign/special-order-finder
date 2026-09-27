import asyncio, json, sys
from playwright.async_api import async_playwright
async def main(u):
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(storage_state='../.lib_state.json',user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',viewport={'width':1366,'height':900})
        pg=await ctx.new_page(); gql=[]
        async def onr(resp):
            if 'graphql' in resp.url:
                try: gql.append((json.loads(resp.request.post_data or '{}'),await resp.text()))
                except Exception: pass
        pg.on('response',onr)
        await pg.goto(u,timeout=60000); await pg.wait_for_timeout(12000)
        print(pg.url, await pg.title()); print((await pg.inner_text('body'))[:1200])
        for d,t in gql:
            if d.get('operationName') not in ('Me','GetShoppingCart','countPromotionsByUser','promotionsByFilter','getQuote','getWishlist','GetActiveHotDeals'):
                print('OP',d.get('operationName'),json.dumps(d.get('variables'))[:300]); print('   Q',(d.get('query') or '')[:600]); print('   R',t[:600])
        await b.close()
asyncio.run(main(sys.argv[1]))
