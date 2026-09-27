import sys,re,collections
sys.argv=[0,'[]']
exec(open('probe.py').read().split('sites=json')[0])
for name,sm in [("Currey","https://www.curreyandcompany.com/sitemap.xml"),("Wendover","https://www.wendoverart.com/media/sitemap.xml"),("HTD","https://www.htddirect.com/pub/sitemap.xml"),("Crestview","https://www.crestviewcollection.com/sitemap.xml"),("Bassett","https://bassettmirror.com/sitemap.xml"),("Cooper","https://cooperclassics.com/xmlsitemap.php"),("Wesley","https://wesleyallen.com/sitemap.xml"),("Amity","https://www.amityhome.com/sitemap.xml")]:
    L=locs(sm)
    c=collections.Counter('/'.join(u.split('/')[3:4]) for u in L)
    print(name,len(L),c.most_common(8)); print('  ',L[len(L)//2:len(L)//2+3])
