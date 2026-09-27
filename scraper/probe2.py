from common import *
import sys
S=sys.argv[1:]
for u in S:
    r=get(u,tries=1)
    if not r: print('XX',u); continue
    t=r.text
    hints=set(re.findall(r'(shopify|woocommerce|wp-json|magento|bigcommerce|__NEXT_DATA__|nuxt|sitecore|umbraco|squarespace|wix|insite|spire|salsify|algolia|searchspring|klevu|constructor\.io|bloomreach|coveo|react|angular|vue|\.aspx|\.cfm|\.php|gatsby|elasticsearch|/api/[a-z]+)',t,re.I))
    title=re.search(r'<title[^>]*>(.*?)</title>',t,re.S|re.I)
    sm=[]
    for p in ['/sitemap.xml','/sitemap_index.xml','/sitemap']:
        x=get(r.url.split('/',3)[0]+'//'+r.url.split('/')[2]+p,tries=1)
        if x and x.status_code==200 and '<loc>' in x.text: sm.append(p+':'+str(x.text.count('<loc>')))
    print(r.status_code,r.url,'|',clean(title.group(1))[:50] if title else '','|',sorted(set(h.lower() for h in hints))[:12],'|',sm,'| len',len(t))
