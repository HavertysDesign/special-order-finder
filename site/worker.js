// Search worker: loads catalog + embeddings, runs CLIP (MobileCLIP-S0) models in-browser.
import { env, pipeline, AutoTokenizer, CLIPTextModelWithProjection, AutoProcessor, CLIPVisionModelWithProjection, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1';
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
async function embedImage(blob) { const bmp = await createImageBitmap(blob); return embedRegion(bmp, 0, 0, bmp.width, bmp.height); }
async function embedRegion(bmp, sx, sy, sw, sh) {
  await loadVision();
  // pad to white square so whole object is kept (matches catalog processing)
  const S = Math.max(sw, sh), T = 512, sc = T / S;
  const cv = new OffscreenCanvas(T, T), cx = cv.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, T, T);
  cx.drawImage(bmp, sx, sy, sw, sh, (T - sw * sc) / 2, (T - sh * sc) / 2, sw * sc, sh * sc);
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


// ---------- dimensions in the search text ----------
// "84 inch sofa", "84"W x 40"D", "36 in round", "30" tall lamp", "8x10 rug", "9' round rug".
// Results must be within ±TOL inches of every size given; pieces with no listed size are left out.
const TOL = 5;
const LBL = { w: 'W', wide: 'W', width: 'W', l: 'W', long: 'W', length: 'W', dia: 'W', diam: 'W', diameter: 'W', round: 'W', d: 'D', deep: 'D', depth: 'D', h: 'H', high: 'H', tall: 'H', height: 'H', ht: 'H' };
function parseDims(q) {
  let s = ' ' + q.toLowerCase().replace(/[”“″]/g, '"').replace(/’/g, "'") + ' ';
  const cons = []; let rug = null;
  const cut = (m) => { s = s.replace(m, ' '); };
  const isRug = /\b(rugs?|runner|carpet)\b/.test(s);
  // rug sizes in feet: 8'x10', 5'3" x 7'6", 8x10 (when the search is about rugs), 8 ft round
  let m = s.match(/(\d{1,2})\s*(?:'|ft\b|feet\b|foot\b)\s*(?:(\d{1,2})\s*(?:"|in\b))?\s*(?:x|by|×)\s*(\d{1,2})\s*(?:'|ft\b|feet\b|foot\b)?\s*(?:(\d{1,2})\s*(?:"|in\b))?/)
    || (isRug && s.match(/\b(\d{1,2})()\s*(?:x|by|×)\s*(\d{1,2})()\b/));
  if (m) { const a = (+m[1]) * 12 + (+m[2] || 0), b = (+m[3]) * 12 + (+m[4] || 0); rug = [Math.min(a, b), Math.max(a, b)]; cut(m[0]); }
  else if ((m = s.match(/(\d{1,2})\s*(?:'|ft\b|feet\b|foot\b)\s*(?:(\d{1,2})\s*(?:"|in\b))?\s*(round|square)?/)) && (isRug || m[3])) {
    const a = (+m[1]) * 12 + (+m[2] || 0); if (isRug) rug = [a, a]; else cons.push({ k: 'W', v: a }); cut(m[0]);
  }
  const NUM = '(\\d{1,3}(?:\\.\\d+)?)(?:\\s*(\\d)\\/(\\d))?';
  const val = (m, i) => +m[i] + (m[i + 1] ? m[i + 1] / m[i + 2] : 0);
  const UNIT = '\\s*(?:"|-?\\s*inch(?:es)?\\b|in\\b\\.?)?\\s*';
  // 84 x 40 x 36 (inches)
  if (!rug && (m = s.match(new RegExp(NUM + '\\s*"?\\s*(?:x|×|by)\\s*' + NUM + '\\s*"?(?:\\s*(?:x|×|by)\\s*' + NUM + '\\s*"?)?')))) {
    cons.push({ k: 'W', v: val(m, 1) }, { k: 'D', v: val(m, 4) }); if (m[7]) cons.push({ k: 'H', v: val(m, 7) }); cut(m[0]);
  }
  // 84"W, 84 inches wide, 30" tall, 60 in round, 20 deep
  let re = new RegExp(NUM + UNIT + '(wide|width|long|length|diameter|diam|dia|round|deep|depth|high|tall|height|ht|w|l|d|h)\\b');
  while ((m = s.match(re))) { const k = LBL[m[4]]; if (k && !cons.some(c => c.k === k)) cons.push({ k, v: val(m, 1) }); cut(m[0]); if (m[4] === 'round' || m[4] === 'diameter' || m[4] === 'dia') s += ' round '; }
  // width 84 / W: 84
  re = new RegExp('\\b(width|depth|height|diameter|w|d|h)\\s*[:=]?\\s*' + NUM + '\\s*(?:"|in\\b|inch(?:es)?\\b)');
  while ((m = s.match(re))) { const k = LBL[m[1]]; if (k && !cons.some(c => c.k === k)) cons.push({ k, v: val(m, 2) }); cut(m[0]); }
  // a lone size with a unit: 84" sofa, 84 inch sofa, 84-inch
  re = new RegExp(NUM + '\\s*(?:"|-?\\s*inch(?:es)?\\b|in\\b(?=\\s))');
  while ((m = s.match(re))) { cons.push({ k: 'ANY', v: val(m, 1) }); cut(m[0]); }
  return { cons, rug, rest: s.replace(/\s+/g, ' ').trim() };
}
function fitsDims(i, dq) {
  if (dq.rug) {
    const rs = META.rs[i]; if (!rs) return 0;
    for (let j = 0; j < rs.length; j += 2) if (Math.abs(rs[j] - dq.rug[0]) <= TOL && Math.abs(rs[j + 1] - dq.rug[1]) <= TOL) return 1;
    return -1;
  }
  const W = META.w[i], D = META.dd[i], H = META.dh[i];
  for (const c of dq.cons) {
    const have = c.k === 'W' ? W : c.k === 'D' ? D : c.k === 'H' ? H : Math.max(W, D, H);
    if (!have) return 0;                  // size not listed
    if (Math.abs(have - c.v) > TOL) return -1;
  }
  return 1;
}
function describeDims(dq) {
  const ft = (x) => Math.floor(x / 12) + "'" + (x % 12 ? (x % 12) + '"' : '');
  if (dq.rug) return dq.rug[0] === dq.rug[1] ? `${ft(dq.rug[0])} rugs` : `${ft(dq.rug[0])} x ${ft(dq.rug[1])} rugs`;
  const nm = { W: 'wide', D: 'deep', H: 'tall', ANY: '' };
  return dq.cons.map(c => `${+c.v.toFixed(2)}"${nm[c.k] ? ' ' + nm[c.k] : ''}`).join(', ');
}

async function search({ q, image, likeId, filters, limit }) {
  const t0 = performance.now();
  const dq = parseDims(q || ''); const hasDims = !!(dq.rug || dq.cons.length);
  q = hasDims ? dq.rest : q;
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
  const idx = []; let noSize = 0;
  for (let i = 0; i < N; i++) {
    if (score[i] <= -1) continue;
    if (vset && !vset.has(META.v[i])) continue;
    if (tset && !tset.has(META.t[i])) continue;
    if (hasDims) { const fd = fitsDims(i, dq); if (fd <= 0) { if (fd === 0 && score[i] > 0.2) noSize++; continue; } }
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
  post('results', { items, total: idx.length, ms: Math.round(performance.now() - t0), note, dims: hasDims ? describeDims(dq) : '', noSize });
}


// ---------- Shop the room ----------
// Open-vocabulary detector (OWL-ViT) finds the pieces; each piece is then matched with the same photo search.
const DET_LABELS = {
  'sofa': 'Sofas & Sectionals', 'sectional sofa': 'Sofas & Sectionals', 'armchair': 'Chairs & Seating', 'accent chair': 'Chairs & Seating',
  'dining chair': 'Chairs & Seating', 'ottoman': 'Chairs & Seating', 'bench': 'Chairs & Seating', 'bar stool': 'Chairs & Seating',
  'coffee table': 'Tables', 'side table': 'Tables', 'console table': 'Tables', 'dining table': 'Tables',
  'bed': 'Beds', 'nightstand': 'Dressers & Nightstands', 'dresser': 'Dressers & Nightstands', 'sideboard': 'Dining Storage',
  'bookcase': 'Cabinets & Shelving', 'cabinet': 'Cabinets & Shelving', 'desk': 'Desks & Office', 'rug': 'Rugs',
  'table lamp': 'Lighting', 'floor lamp': 'Lighting', 'pendant light': 'Lighting', 'chandelier': 'Lighting',
  'mirror': 'Mirrors', 'framed wall art': 'Wall Art', 'painting': 'Wall Art', 'picture frame': 'Wall Art', 'throw pillow': 'Pillows & Throws', 'throw blanket': 'Pillows & Throws',
  'vase': 'Decor & Accessories', 'decorative bowl': 'Decor & Accessories', 'potted plant': 'Botanicals',
};
let detReady = null, detector = null, ROOM = null, TYPE_EMB = null;
const TYPE_PROMPTS = {
  'Sofas & Sectionals': ['a sofa', 'a sectional sofa', 'a loveseat'], 'Chairs & Seating': ['an armchair', 'an accent chair', 'an ottoman', 'a pouf', 'a bench', 'a stool', 'a dining chair'],
  'Tables': ['a coffee table', 'a side table', 'a dining table', 'a console table'], 'Beds': ['a bed', 'an upholstered bed', 'a headboard'],
  'Dressers & Nightstands': ['a dresser', 'a nightstand', 'a chest of drawers'], 'Dining Storage': ['a sideboard', 'a buffet cabinet'],
  'Cabinets & Shelving': ['a bookcase', 'a cabinet', 'a media console'], 'Desks & Office': ['a desk'], 'Lighting': ['a table lamp', 'a floor lamp', 'a pendant light', 'a chandelier', 'a wall sconce'],
  'Rugs': ['an area rug', 'a round rug on the floor', 'a carpet'], 'Wall Art': ['framed wall art', 'an abstract painting', 'a framed print'], 'Mirrors': ['a wall mirror', 'a mirror'],
  'Pillows & Throws': ['a throw pillow', 'a decorative cushion', 'a throw blanket'], 'Bedding': ['a duvet cover', 'bed sheets and shams'],
  'Decor & Accessories': ['a vase', 'a decorative bowl', 'a sculpture', 'decorative objects'], 'Botanicals': ['a potted plant', 'flowering branches in a vase', 'a faux tree'], 'Outdoor': ['outdoor patio furniture'],
};
async function typeEmbeddings() {
  if (TYPE_EMB) return TYPE_EMB;
  await loadText(); TYPE_EMB = [];
  for (const t of TYPES) {
    const ps = (TYPE_PROMPTS[t] || [t]).map(p => 'a photo of ' + p);
    const { text_embeds } = await textModel(tok(ps, { padding: 'max_length', truncation: true }));
    const d = text_embeds.dims[1], avg = new Float32Array(d);
    for (let r = 0; r < ps.length; r++) { const v = norm(text_embeds.data.slice(r * d, (r + 1) * d)); for (let j = 0; j < d; j++) avg[j] += v[j]; }
    TYPE_EMB.push(project(norm(avg)));
  }
  return TYPE_EMB;
}
function loadDetector() {
  if (!detReady) detReady = (async () => {
    detector = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32', { dtype: 'q8', progress_callback: progressCb('Loading room AI') });
    post('ready', { which: 'detector' });
  })();
  return detReady;
}
function iou(a, b) {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1); return inter / (a.w * a.h + b.w * b.h - inter);
}
async function roomDetect({ image }) {
  const bmp = await createImageBitmap(image);
  ROOM = { bmp, W: bmp.width, H: bmp.height };
  await Promise.all([loadDetector(), loadVision()]);
  post('roomStage', { text: 'Finding the pieces in the photo…' });
  const S = 768, sc = Math.min(1, S / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * sc), h = Math.round(bmp.height * sc);
  const cv = new OffscreenCanvas(w, h); cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const img = new RawImage(cv.getContext('2d').getImageData(0, 0, w, h).data, w, h, 4).rgb();
  const labels = Object.keys(DET_LABELS);
  const raw = await detector(img, labels.map(l => 'a photo of a ' + l), { threshold: 0.06, topk: 80 });
  let boxes = raw.map(o => ({ label: o.label.replace('a photo of a ', ''), score: o.score,
    x: o.box.xmin / sc, y: o.box.ymin / sc, w: (o.box.xmax - o.box.xmin) / sc, h: (o.box.ymax - o.box.ymin) / sc }))
    .filter(b => b.w > 12 && b.h > 12 && (b.w * b.h) / (ROOM.W * ROOM.H) < 0.8);
  boxes.sort((a, b) => b.score - a.score);
  const keep = [];
  const perType = {};
  for (const b of boxes) {
    const t = DET_LABELS[b.label], cap = t === 'Chairs & Seating' || t === 'Wall Art' ? 4 : 2;
    if ((perType[t] || 0) >= cap) continue;
    if (keep.every(k => iou(k, b) < (DET_LABELS[k.label] === t ? 0.4 : 0.75))) { keep.push(b); perType[t] = (perType[t] || 0) + 1; }
    if (keep.length >= 14) break;
  }
  keep.sort((a, b) => (b.w * b.h) - (a.w * a.h)); // biggest pieces first
  keep.forEach((b, i) => { b.id = i + 1; });
  post('roomBoxes', { boxes: keep, W: ROOM.W, H: ROOM.H });
  for (const b of keep) await roomMatch({ box: b });
  post('roomStage', { text: '' });
}
async function roomMatch({ box, typeName, filters, limit }) {
  if (!ROOM) return;
  const pad = 0.06, x = Math.max(0, box.x - box.w * pad), y = Math.max(0, box.y - box.h * pad);
  const w = Math.min(ROOM.W - x, box.w * (1 + 2 * pad)), h = Math.min(ROOM.H - y, box.h * (1 + 2 * pad));
  const v = await embedRegion(ROOM.bmp, x, y, w, h);
  const s = dotAll(v);
  // decide the piece's type: detector label, checked against what the photo actually matches
  let ti = typeName != null ? TYPES.indexOf(typeName) : -1;
  if (ti < 0) {
    // zero-shot: how much does the cut-out look like each type (photo vs. type descriptions)
    const TE = await typeEmbeddings();
    const zs = TE.map(e => { let a = 0; for (let j = 0; j < DIM; j++) a += e[j] * v[j]; return a; });
    const mx = Math.max(...zs), ex = zs.map(z => Math.exp((z - mx) * 60)), se = ex.reduce((a, b) => a + b, 0);
    const score = ex.map(x => x / se);
    // plus what the closest catalog products are, plus the detector's own label
    const top = [...s.keys()].sort((a, b) => s[b] - s[a]).slice(0, 30), votes = new Array(TYPES.length).fill(0);
    top.forEach((i) => { votes[META.t[i]] += 1 / 30; });
    const lt = TYPES.indexOf(DET_LABELS[box.label] || '');
    const tot = score.map((z, k) => z + 0.35 * votes[k]);
    ti = tot.indexOf(Math.max(...tot));
    // the detector's label wins when the photo agrees it's at least plausible (it sees context the cut-out loses)
    const rank = [...score.keys()].sort((a, b) => score[b] - score[a]);
    if (lt >= 0 && (rank.indexOf(lt) < 3 || score[lt] > 0.08)) ti = lt;
    box.debug = { label: box.label, zs: TYPES[score.indexOf(Math.max(...score))], vote: TYPES[votes.indexOf(Math.max(...votes))] };
  }
  const f = filters || {}; const vset = f.vendors && f.vendors.length ? new Set(f.vendors) : null;
  const idx = [];
  for (let i = 0; i < N; i++) {
    if (META.t[i] !== ti) continue;
    if (vset && !vset.has(META.v[i])) continue;
    if (f.maxW && META.w[i] && META.w[i] > f.maxW) continue;
    idx.push(i);
  }
  idx.sort((a, b) => s[b] - s[a]);
  const out = [], seenImg = new Set(), seenName = new Set();
  for (const i of idx) { const k = META.v[i] + '|' + NAMELC[i]; if (seenImg.has(META.i[i]) || seenName.has(k)) continue; seenImg.add(META.i[i]); seenName.add(k); out.push(i); if (out.length >= (limit || 12)) break; }
  post('roomRow', { id: box.id, typeName: TYPES[ti], title: (DET_LABELS[box.label] === TYPES[ti] ? box.label : null), debug: box.debug, items: out.map(i => ({ id: i, n: META.n[i], i: META.i[i], u: META.u[i], v: VENDORS[META.v[i]], c: META.c[i], d: META.d[i], s: META.s[i] })) });
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') await loadCatalog();
    else if (m.type === 'warm') { m.which === 'vision' ? loadVision() : loadText(); }
    else if (m.type === 'search') await search(m);
    else if (m.type === 'room') await roomDetect(m);
    else if (m.type === 'roomMatch') await roomMatch(m);
  } catch (err) { post('error', { message: String(err && err.message || err) }); }
};
