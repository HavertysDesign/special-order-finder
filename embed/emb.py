import onnxruntime as ort, numpy as np, io, requests
from PIL import Image
M='models/Xenova/mobileclip_s0/onnx/'
so=ort.SessionOptions(); so.intra_op_num_threads=int(__import__('os').environ.get('ORT_THREADS','2')); so.enable_cpu_mem_arena=False
vs=ort.InferenceSession(M+'vision_model.onnx',so)
def prep(im):
    im=im.convert('RGB'); w,h=im.size; S=max(w,h)
    bg=Image.new('RGB',(S,S),(255,255,255)); bg.paste(im,((S-w)//2,(S-h)//2)); im=bg; w,h=im.size; s=256/min(w,h)
    im=im.resize((max(256,round(w*s)),max(256,round(h*s))),Image.BILINEAR)
    w,h=im.size; l=(w-256)//2; t=(h-256)//2; im=im.crop((l,t,l+256,t+256))
    return (np.asarray(im,dtype=np.float32)/255.).transpose(2,0,1)
def embed(ims):
    x=np.stack([prep(i) for i in ims]); o=vs.run(None,{vs.get_inputs()[0].name:x})
    out=[v for v in o if v.ndim==2 and v.shape[1]==512][0] if any(v.ndim==2 for v in o) else o[0]
    return out/np.linalg.norm(out,axis=1,keepdims=True)
if __name__=='__main__':
    print([ (i.name,i.shape) for i in vs.get_inputs()],[ (o.name,o.shape) for o in vs.get_outputs()])
