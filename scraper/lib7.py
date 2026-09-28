import asyncio, json, re
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(storage_state='../.lib_state.json',viewport={'width':1366,'height':900})
        pg=await ctx.new_page(); hits=[]
        async def onr(resp):
            if 'graphql' in resp.url:
                try: t=await resp.text(); d=json.loads(resp.request.post_data or '{}')
                except Exception: return
                if re.search(r'(?i)"(width|dimensions?|depth|height)"\s*:\s*("?[\d.]+|"[^"]*\d)',t): hits.append((d.get('operationName'),d.get('variables'),d.get('query'),t[:1500]))
        pg.on('response',onr)
        await pg.goto('https://www.mylibertyfurniture.com/shop-by/bedroom/collection/twin-lakes/104-br',timeout=60000); await pg.wait_for_timeout(9000)
        try: await pg.click('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',timeout=3000)
        except Exception: pass
        await pg.get_by_text('Queen Storage Bed').first.click(); await pg.wait_for_timeout(9000)
        print('URL',pg.url)
        for h in hits[:3]:
            print('OP',h[0],json.dumps(h[1])[:200]); print(h[3][:1200]); json.dump({'operationName':h[0],'query':h[2],'variables':h[1]},open('../.lib_op_detail.json','w'))
        await b.close()
asyncio.run(main())
