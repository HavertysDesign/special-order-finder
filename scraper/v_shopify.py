from run import *
import json,os
V={'dalyn':'https://dalyn.com','ann-gish':'https://www.anngish.com','jamie-young':'https://www.jamieyoung.com','karastan':'https://www.karastanrugs.com','oriental-weavers':'https://owrugs.com'}
for k,b in V.items():
    ps=shopify(b); json.dump(ps,open(f'{OUT}/{k}.json','w')); print(k,len(ps),flush=True)
