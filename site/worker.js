// Search worker: loads catalog + embeddings, runs CLIP (MobileCLIP-S0) models in-browser.
import { env, AutoTokenizer, CLIPTextModelWithProjection, AutoProcessor, CLIPVisionModelWithProjection, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1';
env.allowLocalModels = false;
const MODEL = 'Xenova/mobileclip_s0';
let META = null, EMB = null, DIM = 0, N = 0, PCA = null, TXT = null, NAMELC = null, VENDORS = [], TYPES = [];
let tok, textModel, proc, visionModel, textReady = null, visionReady = null;

const post = (type, data) => self.postMessage({ type, ...data });

async function loadCatalog() {
  let v = '0';
  try { v = (await fetch('data/version.json', { cache: 'no-store' }).then(r => r.json())).v; } catch {}
  const [meta, pca, buf] = await Promise.all([
    fetch('data/meta.json?v=' + v).then(r => r.json()),
    fetch('data/pca.json?v=' + v).then(r => r.json()),
    fetch('data/emb.bin?v=' + v).then(r => r.arrayBuffer()),
  ]);
  META = meta; PCA = pca; DIM = pca.dim; N = meta.n.length;
  EMB = new Int8Array(buf);
  VENDORS = meta.vendors; TYPES = meta.types;
  // keyword haystacks
  TXT = new Array(N); NAMELC = new Array(N);
  for (let i = 0; i < N; i++) {
    NAMELC[i] = meta.n[i].toLowerCase();
    TXT[i] = (meta.c[i] + ' ' + meta.k[i] + ' ' + meta.s[i] + ' ' + VENDORS[meta.v[i]]).toLowerCase();
  }
  post('catalog', { n: N, vendors: VENDORS, types: TYPES, updated: meta.updated, vcounts: meta.vcounts, typeImg: meta.typeImg || [], tcounts: meta.tcounts || [] });
}

function progressCb(label) {
  const seen = {};
  return (p) => {
    if (p.status === 'progress' && p.total) { seen[p.file] = [p.loaded, p.total];
      let a = 0, b = 0; for (const k in seen) { a += seen[k][0]; b += seen[k][1]; }
      post('progress', { label, pct: Math.round(100 * a / b) }); }
  };
}
function loadText() {
  if (!textReady) textReady = (async () => {
    tok = await AutoTokenizer.from_pretrained(MODEL);
    textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: 'q8', progress_callback: progressCb('Loading text AI') });
    post('ready', { which: 'text' });
  })();
  return textReady;
}
function loadVision() {
  if (!visionReady) visionReady = (async () => {
    proc = await AutoProcessor.from_pretrained(MODEL);
    visionModel = await CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: 'fp16', progress_callback: progressCb('Loading photo AI') });
    post('ready', { which: 'vision' });
  })();
  return visionReady;
}

function project(vec) { // 512-d -> PCA space, normalized
  const out = new Float32Array(DIM); const m = PCA.mean, C = PCA.comp;
  for (let j = 0; j < DIM; j++) { let s = 0; const row = C[j]; for (let i = 0; i < 512; i++) s += (vec[i] - m[i]) * row[i]; out[j] = s; }
  let n = 0; for (let j = 0; j < DIM; j++) n += out[j] * out[j]; n = Math.sqrt(n) || 1;
  for (let j = 0; j < DIM; j++) out[j] /= n; return out;
}
function norm(v) { let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1; return Float32Array.from(v, x => x / n); }

async function embedText(q) {
  await loadText();
  const inputs = tok([q], { padding: 'max_length', truncation: true });
  const { text_embeds } = await textModel(inputs);
  return project(norm(text_embeds.data));
}
async function embedImage(blob) {
  await loadVision();
  // pad to white square so whole object is kept (matches catalog processing)
  const bmp = await createImageBitmap(blob);
  const S = Math.max(bmp.width, bmp.height), T = 512, sc = T / S;
  const cv = new OffscreenCanvas(T, T), cx = cv.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, T, T);
  cx.drawImage(bmp, (T - bmp.width * sc) / 2, (T - bmp.height * sc) / 2, bmp.width * sc, bmp.height * sc);
  const d = cx.getImageData(0, 0, T, T);
  const img = new RawImage(d.data, T, T, 4).rgb();
  const { image_embeds } = await visionModel(await proc(img));
  return project(norm(image_embeds.data));
}
function itemVec(i) { const o = i * DIM, v = new Float32Array(DIM); for (let j = 0; j < DIM; j++) v[j] = EMB[o + j] / 127; return norm(v); }

function dotAll(q) {
  const s = new Float32Array(N);
  for (let i = 0, o = 0; i < N; i++, o += DIM) { let a = 0; for (let j = 0; j < DIM; j++) a += EMB[o + j] * q[j]; s[i] = a / 127; }
  return s;
}
const STOP = new Set('a an the and or with for in of to on by w/ x ft in. inch inches'.split(' '));
function tokens(q) { return q.toLowerCase().replace(/[^a-z0-9"'./ -]/g, ' ').split(/\s+/).filter(t => t.length > 1 && !STOP.has(t)); }

async function search({ q, image, likeId, filters, limit }) {
  const t0 = performance.now();
  const qt = tokens(q || '');
  let score = new Float32Array(N), hasVec = false, note = '';
  if (!qt.length && !image && likeId == null) { // browse: stable shuffle so vendors are mixed
    for (let i = 0; i < N; i++) { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; score[i] = h / 4294967296; }
  }
  if (image) { const v = await embedImage(image); const s = dotAll(v); for (let i = 0; i < N; i++) score[i] += s[i]; hasVec = true; }
  if (likeId != null) { const s = dotAll(itemVec(likeId)); for (let i = 0; i < N; i++) score[i] += s[i]; hasVec = true; }
  if (qt.length) {
    let useClip = true;
    if (!textModel) { useClip = false; note = 'keyword'; loadText(); }
    if (useClip) { const v = await embedText(q); const s = dotAll(v); const w = hasVec ? 0.8 : 1.0; for (let i = 0; i < N; i++) score[i] += w * s[i] * (hasVec ? 1 : 1); }
    // keyword boost
    const scale = useClip || hasVec ? 0.035 : 1;
    for (let i = 0; i < N; i++) {
      let k = 0; const nm = NAMELC[i], tx = TXT[i];
      for (const t of qt) { if (nm.includes(t)) k += 2; else if (tx.includes(t)) k += 1; }
      if (k) score[i] += scale * k / qt.length;
      else if (!useClip && !hasVec) score[i] = -1;
    }
  }
  // filters
  const f = filters || {};
  const vset = f.vendors && f.vendors.length ? new Set(f.vendors) : null;
  const tset = f.types && f.types.length ? new Set(f.types) : null;
  const idx = [];
  for (let i = 0; i < N; i++) {
    if (score[i] <= -1) continue;
    if (vset && !vset.has(META.v[i])) continue;
    if (tset && !tset.has(META.t[i])) continue;
    if (f.maxW && META.w[i] && META.w[i] > f.maxW) continue;
    if (f.maxW && f.strictDims && !META.w[i]) continue;
    idx.push(i);
  }
  idx.sort((a, b) => score[b] - score[a]);
  // dedupe variants: same image, or same vendor+name
  const out = [], seenImg = new Set(), seenName = new Set();
  for (const i of idx) {
    if (likeId != null && i === likeId) continue;
    const key = META.v[i] + '|' + NAMELC[i];
    if (seenImg.has(META.i[i]) || seenName.has(key)) continue;
    seenImg.add(META.i[i]); seenName.add(key);
    out.push(i); if (out.length >= limit) break;
  }
  const items = out.map(i => ({ id: i, n: META.n[i], i: META.i[i], u: META.u[i], v: VENDORS[META.v[i]], c: META.c[i], d: META.d[i], s: META.s[i], score: score[i] }));
  post('results', { items, total: idx.length, ms: Math.round(performance.now() - t0), note });
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') await loadCatalog();
    else if (m.type === 'warm') { m.which === 'vision' ? loadVision() : loadText(); }
    else if (m.type === 'search') await search(m);
  } catch (err) { post('error', { message: String(err && err.message || err) }); }
};
