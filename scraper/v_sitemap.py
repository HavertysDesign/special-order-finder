from run import *
import sys, re
from common import ld_products
CFG={
 'amity-home':dict(sm='https://www.amityhome.com/sitemap.xml',inc=r'/product/'),
 'wesley-allen':dict(sm='https://wesleyallen.com/sitemap.xml',inc=r'/product/',woo=True),
 'artistic-leathers':dict(sm='https://artisticleathers.com/sitemap_index.xml',inc=r'^https://artisticleathers.com/[^/]+/$',exc=r'/(leathers|leather-category|category|leather-colour|about|contact|blog|news|dealer|privacy|terms|warranty|care|catalog|home|resources|faq)'),
 'cooper-classics':dict(sm='https://cooperclassics.com/xmlsitemap.php',inc=r'.',need_ld=True),
 'wendover':dict(sm='https://www.wendoverart.com/media/sitemap.xml',inc=r'^https://www.wendoverart.com/[a-z]{2,6}\d{3,}[a-z0-9-]*/?$',strip=r'\s*[-|]\s*Wendover.*$'),
 'home-trends-design':dict(sm='https://www.htddirect.com/pub/sitemap.xml',inc=r'^https://www.htddirect.com/[a-z0-9-]+$',need_ld=True),
 'steve-silver':dict(sm='https://stevesilver.com/sitemap_index.xml',inc=r'/product/',strip=r'\s*-\s*Steve Silver.*$'),

 'gascho':dict(sm='https://www.gaschofurniture.com/sitemap.xml',inc=r'/catalog_[a-z_0-9-]+\.html$',strip=r'\s*Catalog$'),
 'aspenhome':dict(sm='https://www.aspenhome.net/sitemap.xml',inc=r'/product\?prodID='),
 'universal':dict(sm='https://www.universalfurniture.com/sitemap.xml',inc=r'/item/'),
 'sopoly':dict(sm='https://www.sopoly.com/sitemap.xml',inc=r'/products/'),
 'jonathan-louis':dict(sm='https://www.jonathanlouis.com/sitemap.xml',inc=r'/(accessories|collections)/',strip=r'\s*\|\s*Jonathan Louis.*$'),
 'dw-silks':dict(sm='https://www.dwsilks.com/sitemap.xml',inc=r'/product/',woo=True),
}
key=sys.argv[1]; c=CFG[key]
L=sitemap_locs(c['sm'])
L=[u for u in L if re.search(c['inc'],u) and not (c.get('exc') and re.search(c['exc'],u))]
def fn(u):
    r=get(u)
    if not r or r.status_code!=200: return None
    if c.get('need_ld') and not ld_products(BeautifulSoup(r.text,'lxml')): return None
    p=generic_extract(u,r,c.get('strip'))
    if c.get('woo') and (not p.get('image') or 'logo' in p.get('image','').lower()):
        s=BeautifulSoup(r.text,'lxml'); im=s.select_one('.woocommerce-product-gallery__image a, .woocommerce-product-gallery__image img, img.wp-post-image')
        if im: p['image']=im.get('href') or im.get('data-large_image') or im.get('src')
        else:
            c2=[i.get('src') or i.get('data-src') for i in s.find_all('img') if (i.get('src') or i.get('data-src') or '').count('/uploads/') and 'logo' not in (i.get('src') or i.get('data-src') or '').lower()]
            if c2: p['image']=c2[0]
    return p
crawl(L,fn,workers=int(sys.argv[2]) if len(sys.argv)>2 else 5,name=key)
print(key,'DONE')
