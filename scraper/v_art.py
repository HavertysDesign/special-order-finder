import asyncio, json
from playwright.async_api import async_playwright
async def main():
    items={}
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36')
        for n in range(1,13):
            u=f'https://arthomefurnishings.com/shop?page={n}'
            await pg.goto(u,timeout=60000); await pg.wait_for_timeout(6000)
            for _ in range(5): await pg.mouse.wheel(0,3000); await pg.wait_for_timeout(500)
            cards=await pg.eval_on_selector_all('.art-product-card','els=>els.map(e=>({name:(e.querySelector(".info_title")||{}).innerText, img:(e.querySelector("img")||{}).src}))')
            for c in cards:
                if c['name']: items.setdefault(c['name'].strip(),{'url':u,'name':c['name'].strip(),'image':c['img'] or '','sku':'','desc':'','category':'','dims':''})
            print(n,len(cards),len(items),flush=True)
            if not cards: break
        await b.close()
    json.dump(list(items.values()),open('../data/art-furniture.json','w'))
asyncio.run(main())
