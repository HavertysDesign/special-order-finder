#!/usr/bin/env bash
# Copies the in-browser AI model files onto the site itself, so browsers or networks that block huggingface.co still work.
set -e
cd "$(dirname "$0")"
get() { # model file
  local out="site/models/$1/$2"; mkdir -p "$(dirname "$out")"
  [ -s "$out" ] || curl -sSfL --retry 3 -o "$out" "https://huggingface.co/$1/resolve/main/$2"
}
for f in config.json tokenizer.json tokenizer_config.json preprocessor_config.json onnx/text_model_quantized.onnx onnx/vision_model_fp16.onnx; do get Xenova/mobileclip_s0 $f; done
for f in config.json tokenizer.json tokenizer_config.json preprocessor_config.json onnx/model_quantized.onnx; do get Xenova/owlvit-base-patch32 $f; done
du -sh site/models
