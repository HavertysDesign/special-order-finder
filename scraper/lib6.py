import asyncio, json
from playwright.async_api import async_playwright
SKIP={'SearchRetailerByCode','Me','GetShoppingCart','countPromotionsByUser','promotionsByFilter','getQuote','getWishlist','GetActiveHotDeals','GetContainerItemClassCount','GetCustomPageBySlug','productCollectionsByRoom','roomForMegaMenu','allProductsFacets'}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(storage_state='../.lib_state.json',viewport={'width':1366,'height':900})
        pg=await ctx.new_page(); gql=[]
        async def onr(resp):
            if 'graphql' in resp.url:
                try: gql.append((json.loads(resp.request.post_data or '{}'),await resp.text()))
                except Exception: pass
        pg.on('response',onr)
        await pg.goto('https://www.mylibertyfurniture.com/bedroom/collections',timeout=60000); await pg.wait_for_timeout(9000)
        try: await pg.click('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',timeout=3000)
        except Exception: pass
        await pg.get_by_text('Twin Lakes').first.click(); await pg.wait_for_timeout(9000)
        print('URL',pg.url); print((await pg.inner_text('body'))[800:1800])
        for d,t in gql:
            if d.get('operationName') not in SKIP:
                print('OP',d.get('operationName'),json.dumps(d.get('variables'))[:300]); json.dump([d,t[:30000]],open('../.lib_op_'+d.get('operationName','x')+'.json','w')); print('   R',t[:500])
        await b.close()
asyncio.run(main())
