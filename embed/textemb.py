import onnxruntime as ort, numpy as np
from tokenizers import Tokenizer
M='/home/claude/vs/embed/models/Xenova/mobileclip_s0/'
tk=Tokenizer.from_file(M+'tokenizer.json'); tk.enable_padding(length=77,pad_id=0); tk.enable_truncation(77)
ts=ort.InferenceSession(M+'onnx/text_model.onnx')
def etext(qs):
    enc=tk.encode_batch(qs); ids=np.array([e.ids for e in enc],dtype=np.int64)
    feed={ts.get_inputs()[0].name:ids}
    o=[x for x in ts.run(None,feed) if x.ndim==2][0]
    return o/np.linalg.norm(o,axis=1,keepdims=True)
