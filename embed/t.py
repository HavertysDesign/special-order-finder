from emb import *
import numpy as np, io, requests, json
urls=['https://www.amini.com/images/collections/09000N/NR09050SA-201.jpg','https://s3.amazonaws.com/emuncloud-staticassets/productImages/bh074/medium/306512.jpg','https://suryacomsafd-cffmgqambnd5awaz.z02.azurefd.net/prod/Resources/Preview/arhi001-201717.jpg']
ims=[Image.open(io.BytesIO(requests.get(u,timeout=30).content)) for u in urls]
import time; t=time.time(); E=embed(ims); print('ms/img',(time.time()-t)/3*1000)
for i,im in enumerate(ims): im.convert('RGB').save(f'img{i}.jpg')
np.save('pyE.npy',E)
