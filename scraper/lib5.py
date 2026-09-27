import asyncio, json
from playwright.async_api import async_playwright
SKIP={'SearchRetailerByCode','Me','GetShoppingCart','countPromotionsByUser','promotionsByFilter','getQuote','getWishlist','GetActiveHotDeals','GetContainerItemClassCount','GetCustomPageBySlug'}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(storage_state='../.lib_state.json',viewport={'width':1366,'height':900})
        pg=await ctx.new_page(); gql=[]
        async def onr(resp):
            if 'graphql' in resp.url:
                try: gql.append((json.loads(resp.request.post_data or '{}'),await resp.text()))
                except Exception: pass
        pg.on('response',onr)
        await pg.goto('https://www.mylibertyfurniture.com/',timeout=60000); await pg.wait_for_timeout(7000)
        try: await pg.click('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',timeout=3000)
        except Exception: pass
        await pg.get_by_text('BEDROOM',exact=True).first.hover(); await pg.wait_for_timeout(2000)
        els=await pg.eval_on_selector_all('a,button,[role=menuitem],p,span','els=>els.filter(e=>e.offsetParent&&e.innerText&&e.innerText.length<30).map(e=>e.tagName+":"+e.innerText.trim())')
        print(els[:80])
        await pg.get_by_text('BEDROOM',exact=True).first.click(); await pg.wait_for_timeout(8000)
        print('URL',pg.url)
        for d,t in gql:
            if d.get('operationName') not in SKIP:
                print('OP',d.get('operationName'),json.dumps(d.get('variables'))[:400]); json.dump([d,t[:20000]],open('../.lib_op_'+d.get('operationName','x')+'.json','w')); print('   R',t[:300])
        await b.close()
asyncio.run(main())
