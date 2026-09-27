#!/usr/bin/env bash
# Downloads the MobileCLIP-S0 ONNX files used to embed catalog photos (same model the site runs in the browser).
set -e
cd "$(dirname "$0")"; M=models/Xenova/mobileclip_s0; mkdir -p $M/onnx
for f in tokenizer.json onnx/vision_model.onnx onnx/text_model.onnx; do
  [ -s "$M/$f" ] || curl -sSL -o "$M/$f" "https://huggingface.co/Xenova/mobileclip_s0/resolve/main/$f"
done
