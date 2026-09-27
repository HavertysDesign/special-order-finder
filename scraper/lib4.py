import asyncio, json, sys
from playwright.async_api import async_playwright
Q=sys.argv[1]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(storage_state='../.lib_state.json')
        pg=await ctx.new_page(); hdr={}
        pg.on('request',lambda r: hdr.update(r.headers) if 'graphql' in r.url and 'authorization' in r.headers else None)
        await pg.goto('https://www.mylibertyfurniture.com/',timeout=60000); await pg.wait_for_timeout(6000)
        h={k:v for k,v in hdr.items() if k.lower() in ('authorization','content-type','x-tenant','apollographql-client-name')}
        print('hdr keys',list(hdr.keys()))
        r=await ctx.request.post('https://www.mylibertyfurniture.com/api/graphql',data=json.dumps({'query':Q}),headers={**h,'content-type':'application/json'})
        print((await r.text())[:6000])
        json.dump(h,open('../.lib_hdr.json','w'))
        await b.close()
asyncio.run(main())
