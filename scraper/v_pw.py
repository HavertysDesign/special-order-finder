# Vendors whose product lists need a real browser: collect links, then extract with requests.
import sys, json, asyncio, subprocess
from pwlinks import collect
CFG={
 'best-home-furnishings':dict(seeds=["https://www.besthf.com/best/Furniture/Product-Catalog","https://www.besthf.com/best/Furniture/Sofas","https://www.besthf.com/best/Furniture/Recliners","https://www.besthf.com/best/Furniture/Chairs","https://www.besthf.com/best/Furniture/Loveseats","https://www.besthf.com/best/Furniture/Sectionals","https://www.besthf.com/best/Furniture/Accessories"],follow=r"besthf\.com/best/Furniture/(Sofas|Recliners|Chairs|Loveseats|Sectionals|Accessories|Product-Catalog)(/[A-Za-z-]+)?$",prod=r"besthf\.com/best/Furniture/(Sofas|Recliners|Chairs|Loveseats|Sectionals|Accessories)/[A-Za-z-]+/[A-Z0-9][A-Za-z0-9-]+$",max=60),
 'bassett-mirror':dict(seeds=["https://www.bassettmirror.com/shop-products.cfm?cat=Tables"],follow=r"bassettmirror\.com/(shop-products|category)\.cfm",prod=r"bassettmirror\.com/detail\.cfm",max=150),
 'kas-rugs':dict(seeds=["https://www.kasrugs.com/catalog?filter_Browse=All%20Rugs"],follow=r"kasrugs\.com/catalog\?(filter_Browse=All%2[0B]Rugs.*page|filter_Collection=[A-Za-z]+$)",prod=r"kasrugs\.com/catalog/pages/",max=120),
}
key=sys.argv[1]; c=CFG[key]
prods,n=asyncio.run(collect(c['seeds'],c['follow'],c['prod'],c['max']))
print(key,'links',len(prods)); lf=f'../links_{key}.json'; json.dump(prods,open(lf,'w'))
subprocess.run([sys.executable,'v_fromlinks.py',key,lf],check=True)
