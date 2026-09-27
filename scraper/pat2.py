from common import *
import collections,sys
for u in sys.argv[1:]:
    L=sitemap_locs(u)
    c=collections.Counter('/'.join(x.split('/')[3:4])[:30] for x in L)
    print('==',u,len(L),c.most_common(7)); print('   ',L[len(L)//2:len(L)//2+3])
