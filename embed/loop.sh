#!/usr/bin/env bash
# rerun until the embedder finishes normally (it exits early if memory climbs)
for i in $(seq 1 60); do
  python3 "$(dirname "$0")/run_embed.py" "$@" && break
  sleep 2
done
