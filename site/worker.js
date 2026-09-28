// Search worker: loads catalog + embeddings, runs CLIP (MobileCLIP-S0) models in-browser.
import { env, pipeline, AutoTokenizer, CLIPTextModelWithProjection, AutoProcessor, CLIPVisionModelWithProjection, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1';
env.allowLocalModels = false;
// AI model files are served from this site (models/…), so a browser or network that blocks huggingface.co still works.
// If the site copy is missing, fall back to huggingface.co.
const SITE_MODELS = new URL('./models/', self.location.href).href;
function useSiteModels() { env.remoteHost = SITE_MODELS; env.remotePathTemplate = '{model}/'; }
function useHF() { env.remoteHost = 'https://huggingface.co/'; env.remotePathTemplate = '{model}/resolve/{revision}/'; }
useSiteModels();
async function fromModels(fn) {
  try { return await retry(fn, 2); }
  catch (e) { if (env.remoteHost !== SITE_MODELS) throw e; useHF(); try { return await retry(fn, 2); } finally { useSiteModels(); } }
}
const MODEL = 'Xenova/mobileclip_s0';
let QS = null, COL = null, META = null, EMB = null, DIM = 0, N = 0, PCA = null, TXT = null, NAMELC = null, VENDORS = [], TYPES = [];
let tok, textModel, proc, visionModel, textReady = null, visionReady = null;

const post = (type, data) => self.postMessage({ type, ...data });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Network blips (or a site update landing mid-load) shouldn't break the page: retry, then explain.
async function retry(fn, tries = 3) {
  for (let k = 1; ; k++) { try { return await fn(); } catch (e) { if (k >= tries) throw e; await sleep(1500 * k); } }
}
const getOk = (url, opt) => fetch(url, opt).then(r => { if (!r.ok) throw new Error(`${r.status} for ${url.split('?')[0]}`); return r; });
class Friendly extends Error {}
let TEXTERR = '';
function aiError(what, e) {
  return new Friendly(`Couldn't download the ${what}. Check your internet connection and try again. (${e && e.message || e})`);
}

async function loadCatalog() {
  let v = '0';
  try { v = (await fetch('data/version.json', { cache: 'no-store' }).then(r => r.json())).v; } catch {}
  const [meta, pca, buf] = await Promise.all([
    retry(() => getOk('data/meta.json?v=' + v).then(r => r.json())),
    retry(() => getOk('data/pca.json?v=' + v).then(r => r.json())),
    retry(() => getOk('data/emb.bin?v=' + v).then(r => r.arrayBuffer())),
  ]).catch((e) => { throw new Friendly(`Couldn't load the catalog. Check your internet connection and reload the page. (${e.message})`); });
  META = meta; PCA = pca; DIM = pca.dim; N = meta.n.length;
  EMB = new Int8Array(buf);
  VENDORS = meta.vendors; TYPES = meta.types;
  // keyword haystacks
  TXT = new Array(N); NAMELC = new Array(N);
  for (let i = 0; i < N; i++) {
    NAMELC[i] = meta.n[i].toLowerCase();
    TXT[i] = (meta.c[i] + ' ' + meta.k[i] + ' ' + meta.s[i] + ' ' + VENDORS[meta.v[i]]).toLowerCase();
  }
  try { const r = await fetch('data/col.bin?v=' + v); if (r.ok) { const b = new Uint8Array(await r.arrayBuffer()); if (b.length === N * 12) COL = b; } } catch {}
  QS = new Uint8Array(N); for (const i of meta.qs || []) QS[i] = 1;
  await loadRules();
  post('catalog', { qsVendors: [...new Set((meta.qs || []).map(i => VENDORS[meta.v[i]]))].sort(), refine: Object.entries(REFINE).map(([k, r]) => [k, r.label]), n: N, vendors: VENDORS, types: TYPES, updated: meta.updated, vcounts: meta.vcounts, typeImg: meta.typeImg || [], tcounts: meta.tcounts || [] });
}


// ---------- special-order rules (applied here, so edits to the list show up without a rebuild) ----------
const RULES_URL = 'https://raw.githubusercontent.com/HavertysDesign/special-order-finder/main/config/special-order-rules.json';
const SOFT = new Set(['Rugs', 'Lighting', 'Wall Art', 'Bedding', 'Mirrors', 'Botanicals']);
async function loadRules() {
  let cfg = null;
  try { const r = await fetch(RULES_URL + '?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) cfg = await r.json(); } catch {}
  if (!cfg) { try { cfg = await fetch('data/special-order-rules.json?v=' + Date.now()).then(r => r.json()); } catch {} }
  applyRules(cfg || { groups: {}, vendors: {} });
}
function applyRules(cfg) {
  const G = META.sogroups || [], bit = (g) => 1 << G.indexOf(g);
  const PILLOW = 1 << 12, STRONG = 1 << 13, SURE = 1 << 14;
  const vr = [], rule = [];
  (META.vkeys || []).forEach((k, vi) => {
    const allow = ((cfg.vendors || {})[k] || null) && cfg.vendors[k].map(x => x === 'lamps' ? 'lighting' : x);
    rule[vi] = allow ? new Set(allow) : null;
    vr[vi] = allow ? allow.map(a => (cfg.groups || {})[a] || a).join('; ') : 'Everything (no restrictions listed)';
  });
  const so = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const a = rule[META.v[i]], f = META.sg ? META.sg[i] : 0, t = TYPES[META.t[i]];
    let s = 1;
    if (a && !a.has('everything')) {
      if (a.has('price_list')) s = 2;
      else if (a.size === 1 && a.has('rugs')) s = (f & PILLOW) ? 0 : 1;
      else if (a.size === 1 && a.has('outdoor')) s = 1;
      else if ([...a].every(x => x === 'upholstery' || x === 'upholstered_beds')) s = SOFT.has(t) ? 0 : 1;
      else if (!a.has('upholstery') && (f & STRONG)) s = 0;
      else { let m = 0; for (const g of a) if (G.includes(g)) m |= bit(g); s = (f & m) ? 1 : ((f & SURE) ? 0 : 2); }
    }
    so[i] = s;
  }
  META.so = so; META.vrules = vr;
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
    tok = await fromModels(() => AutoTokenizer.from_pretrained(MODEL));
    textModel = await fromModels(() => CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: 'q8', progress_callback: progressCb('Loading text AI') }));
    TEXTERR = ''; post('ready', { which: 'text' });
  })().catch((e) => { textReady = null; textModel = null; const f = aiError('search AI', e); TEXTERR = f.message; throw f; });
  return textReady;
}
function loadVision() {
  if (!visionReady) visionReady = (async () => {
    proc = await fromModels(() => AutoProcessor.from_pretrained(MODEL));
    visionModel = await fromModels(() => CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: 'fp16', progress_callback: progressCb('Loading photo AI') }));
    post('ready', { which: 'vision' });
  })().catch((e) => { visionReady = null; visionModel = null; throw aiError('photo AI', e); });
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
let lastImgKey = null, lastImgVec = null;
async function embedImage(blob, key) { if (key != null && key === lastImgKey && lastImgVec) return lastImgVec; const bmp = await createImageBitmap(blob); const v = await embedRegion(bmp, 0, 0, bmp.width, bmp.height); lastImgKey = key; lastImgVec = v; return v; }
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


// ---------- refine chips: nudge the current results without retyping ----------
const REFINE = {
  lighter: { label: 'Lighter', pos: 'a light colored piece of furniture in white, cream and beige', neg: 'a dark colored piece of furniture in black, charcoal and espresso' },
  darker: { label: 'Darker', pos: 'a dark colored piece of furniture in black, charcoal and espresso', neg: 'a light colored piece of furniture in white, cream and beige' },
  warmer: { label: 'Warmer tones', pos: 'warm tones like honey wood, rust, terracotta, camel and gold', neg: 'cool tones like gray, blue, silver and white' },
  cooler: { label: 'Cooler tones', pos: 'cool tones like gray, blue, silver and white', neg: 'warm tones like honey wood, rust, terracotta, camel and gold' },
  modern: { label: 'More modern', pos: 'a sleek modern contemporary minimalist design', neg: 'a traditional ornate classic design with carved details' },
  traditional: { label: 'More traditional', pos: 'a traditional classic design with carved and turned details', neg: 'a sleek modern contemporary minimalist design' },
  rustic: { label: 'More rustic', pos: 'a rustic farmhouse design in reclaimed natural wood', neg: 'a sleek glossy polished modern design' },
  glam: { label: 'More glam', pos: 'a glamorous luxe design with velvet, mirror, crystal and gold', neg: 'a plain simple casual design' },
  wood: { label: 'Wood', pos: 'made of natural wood with visible wood grain', neg: 'made of metal, glass or upholstered fabric' },
  brass: { label: 'Brass / gold', pos: 'with brass and gold metal finish', neg: 'with black iron or chrome metal finish' },
  black: { label: 'Black metal', pos: 'with black iron metal', neg: 'with brass or gold finish' },
  stone: { label: 'Marble / stone', pos: 'with marble, travertine or stone', neg: 'made of wood' },
  velvet: { label: 'Velvet', pos: 'upholstered in plush velvet', neg: 'upholstered in linen', kw: ['velvet'] },
  leather: { label: 'Leather', pos: 'upholstered in leather', neg: 'upholstered in fabric', kw: ['leather'] },
  performance: { label: 'Performance fabric', kw: ['performance', 'crypton', 'sunbrella', 'revolution fabric', 'inside out', 'stain resistant', 'stain-resistant', 'livesmart', 'bella-dura'] },
  outdoor: { label: 'Outdoor', kw: ['outdoor', 'patio', 'all-weather', 'all weather', 'sunbrella'], type: 'Outdoor' },
};
const REFDIR = {};
async function refineDir(k) {
  if (REFDIR[k]) return REFDIR[k];
  const r = REFINE[k]; if (!r.pos) return null;
  const [p, n] = [await embedText(r.pos), await embedText(r.neg)];
  const d = new Float32Array(DIM); for (let j = 0; j < DIM; j++) d[j] = p[j] - n[j];
  return (REFDIR[k] = norm(d));
}
function zs(arr) { let m = 0; for (const x of arr) m += x; m /= arr.length || 1; let v = 0; for (const x of arr) v += (x - m) ** 2; const s = Math.sqrt(v / (arr.length || 1)) || 1; return arr.map(x => (x - m) / s); }
async function applyRefine(idx, score, keys) {
  const cand = idx.slice(0, 600); if (!cand.length) return idx;
  let total = zs(cand.map(i => score[i]));
  for (const k of keys) {
    const r = REFINE[k]; if (!r) continue;
    let add = new Array(cand.length).fill(0);
    if (r.pos) {
      await loadText(); const d = await refineDir(k);
      add = zs(cand.map(i => { let a = 0; const o = i * DIM; for (let j = 0; j < DIM; j++) a += EMB[o + j] * d[j]; return a; }));
    }
    if (r.kw || r.type) {
      const ti = r.type ? TYPES.indexOf(r.type) : -1;
      add = add.map((x, c) => { const i = cand[c]; const hit = (ti >= 0 && META.t[i] === ti) || (r.kw || []).some(w => TXT[i].includes(w) || NAMELC[i].includes(w)); return x + (hit ? (r.pos ? 1.2 : 2.5) : 0); });
    }
    total = total.map((x, c) => x + add[c]);
  }
  const order = cand.map((i, c) => [i, total[c]]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  return order;
}

// ---------- color / swatch match ----------
// Each photo carries up to 3 dominant colors (Lab + share). Distance is CIEDE2000 (how different two colors
// look to the eye) with lightness counted half, since studio lighting shifts it; small clusters (legs, trim) pay extra.
const RAD = Math.PI / 180;
function de2000(L1, a1, b1, L2, a2, b2) {
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb7 = ((C1 + C2) / 2) ** 7, G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + 6103515625)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1 = (Math.atan2(b1, a1p) / RAD + 360) % 360, h2 = (Math.atan2(b2, a2p) / RAD + 360) % 360;
  let dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; if (C1p * C2p === 0) dh = 0;
  const dL = L2 - L1, dC = C2p - C1p, dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh * RAD / 2);
  const Lb = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2, hs = h1 + h2;
  const hb = C1p * C2p === 0 ? hs : Math.abs(h1 - h2) <= 180 ? hs / 2 : hs < 360 ? (hs + 360) / 2 : (hs - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hb - 30) * RAD) + 0.24 * Math.cos(2 * hb * RAD) + 0.32 * Math.cos((3 * hb + 6) * RAD) - 0.2 * Math.cos((4 * hb - 63) * RAD);
  const SL = 1 + 0.015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T;
  const Cbp7 = Cbp ** 7, RT = -Math.sin(2 * 30 * Math.exp(-(((hb - 275) / 25) ** 2)) * RAD) * 2 * Math.sqrt(Cbp7 / (Cbp7 + 6103515625));
  const x = dL / (2 * SL), y = dC / SC, z = dH / SH;
  return Math.sqrt(x * x + y * y + z * z + RT * y * z);
}
function colorDist(i, c) {
  if (!COL) return 999; const o = i * 12; let best = 999;
  for (let k = 0; k < 3; k++) {
    const sh = COL[o + k * 4 + 3] / 255; if (sh < 0.1) continue;
    const d = de2000(c.L, c.a, c.b, COL[o + k * 4] / 2.55, COL[o + k * 4 + 1] - 128, COL[o + k * 4 + 2] - 128) + 8 * Math.max(0, 0.5 - sh);
    if (d < best) best = d;
  }
  return best;
}
function applyColor(idx, score, c, browse) {
  const cand = browse ? idx : idx.slice(0, 800); if (!cand.length) return idx;
  const d = cand.map(i => colorDist(i, c));
  const rel = browse ? cand.map(() => 0) : zs(cand.map(i => score[i]));
  const t = cand.map((i, k) => [i, rel[k] * 0.8 - d[k] / 2, d[k]]);
  const near = t.filter(x => x[2] <= 9).sort((a, b) => b[1] - a[1]), far = t.filter(x => x[2] > 9).sort((a, b) => a[2] - b[2]);
  COLORNEAR = near.length;
  return near.concat(far).map(x => x[0]);
}
let COLORNEAR = 0;

async function search({ q, image, imageKey, likeId, filters, limit, refine, color }) {
  const t0 = performance.now();
  const dq = parseDims(q || ''); const hasDims = !!(dq.rug || dq.cons.length);
  q = hasDims ? dq.rest : q;
  const qt = tokens(q || '');
  let score = new Float32Array(N), hasVec = false, note = '';
  if (!qt.length && !image && likeId == null) { // browse: stable shuffle so vendors are mixed
    for (let i = 0; i < N; i++) { let h = (i * 2654435761) >>> 0; h ^= h >>> 15; score[i] = h / 4294967296; }
  }
  if (image) { const v = await embedImage(image, imageKey); const s = dotAll(v); for (let i = 0; i < N; i++) score[i] += s[i]; hasVec = true; }
  if (likeId != null) { const s = dotAll(itemVec(likeId)); for (let i = 0; i < N; i++) score[i] += s[i]; hasVec = true; }
  if (qt.length) {
    let useClip = true;
    if (!textModel) { useClip = false; note = TEXTERR ? 'nomodel' : 'keyword'; loadText().catch(() => {}); }
    if (useClip) { const v = await embedText(q); const s = dotAll(v); const w = hasVec ? 0.8 : 1.0; for (let i = 0; i < N; i++) score[i] += w * s[i] * (hasVec ? 1 : 1); }
    // keyword boost
    const scale = useClip || hasVec ? 0.02 : 1;
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
    if (f.soOnly && META.so && META.so[i] === 0) continue;
    if (f.quick && !QS[i]) continue;
    if (hasDims) { const fd = fitsDims(i, dq); if (fd <= 0) { if (fd === 0 && score[i] > 0.2) noSize++; continue; } }
    if (f.maxW && META.w[i] && META.w[i] > f.maxW) continue;
    if (f.maxW && f.strictDims && !META.w[i]) continue;
    idx.push(i);
  }
  idx.sort((a, b) => score[b] - score[a]);
  let ordered = idx;
  if (refine && refine.length) ordered = await applyRefine(idx, score, refine);
  if (color && COL) ordered = applyColor(ordered, score, color, !qt.length && !image && likeId == null);
  // dedupe variants: same image, or same vendor+name
  const out = [], seenImg = new Set(), seenName = new Set();
  // variety: in the first 30 results, no more than 5 from one vendor (the rest follow after)
  const perV = {}, later = [];
  for (const i of ordered) {
    if (likeId != null && i === likeId) continue;
    const key = META.v[i] + '|' + NAMELC[i].replace(/[^a-z0-9]/g, '');
    if (seenImg.has(META.i[i]) || seenName.has(key)) continue;
    seenImg.add(META.i[i]); seenName.add(key);
    if (out.length < 30 && (perV[META.v[i]] || 0) >= 5 && !(vset && vset.size === 1)) { later.push(i); continue; }
    perV[META.v[i]] = (perV[META.v[i]] || 0) + 1;
    out.push(i); if (out.length >= limit) break;
    if (out.length === 30) { while (later.length && out.length < limit) out.push(later.shift()); if (out.length >= limit) break; }
  }
  while (later.length && out.length < limit) out.push(later.shift());
  const items = out.map(i => ({ id: i, n: META.n[i], i: META.i[i], u: META.u[i], v: VENDORS[META.v[i]], c: META.c[i], d: META.d[i], s: META.s[i], ty: TYPES[META.t[i]], qs: QS[i], so: META.so ? META.so[i] : 1, vr: META.vrules ? META.vrules[META.v[i]] : '', W: META.w[i], D: META.dd[i], H: META.dh[i], score: score[i] }));
  post('results', { noteMsg: TEXTERR, items, total: idx.length, colorOk: !!COL, colorNear: color && COL ? COLORNEAR : null, ms: Math.round(performance.now() - t0), note, dims: hasDims ? describeDims(dq) : '', noSize });
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
    detector = await fromModels(() => pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32', { dtype: 'q8', progress_callback: progressCb('Loading room AI') }));
    post('ready', { which: 'detector' });
  })().catch((e) => { detReady = null; detector = null; throw aiError('room AI', e); });
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
    if (f.soOnly && META.so && META.so[i] === 0) continue;
    if (f.quick && !QS[i]) continue;
    if (f.maxW && META.w[i] && META.w[i] > f.maxW) continue;
    idx.push(i);
  }
  idx.sort((a, b) => s[b] - s[a]);
  const out = [], seenImg = new Set(), seenName = new Set();
  for (const i of idx) { const k = META.v[i] + '|' + NAMELC[i]; if (seenImg.has(META.i[i]) || seenName.has(k)) continue; seenImg.add(META.i[i]); seenName.add(k); out.push(i); if (out.length >= (limit || 12)) break; }
  post('roomRow', { id: box.id, typeName: TYPES[ti], title: (DET_LABELS[box.label] === TYPES[ti] ? box.label : null), debug: box.debug, items: out.map(i => ({ id: i, n: META.n[i], i: META.i[i], u: META.u[i], v: VENDORS[META.v[i]], c: META.c[i], d: META.d[i], s: META.s[i], ty: TYPES[META.t[i]], qs: QS[i], so: META.so ? META.so[i] : 1, vr: META.vrules ? META.vrules[META.v[i]] : '', W: META.w[i], D: META.dd[i], H: META.dh[i] })) });
}


// ---------- complete the room: pieces in other categories that share this piece's style and color ----------
const PAIRS = {
  'Sofas & Sectionals': ['Rugs', 'Tables', 'Chairs & Seating', 'Lighting', 'Pillows & Throws', 'Wall Art'],
  'Chairs & Seating': ['Tables', 'Rugs', 'Lighting', 'Pillows & Throws', 'Wall Art', 'Sofas & Sectionals'],
  'Tables': ['Chairs & Seating', 'Rugs', 'Lighting', 'Sofas & Sectionals', 'Decor & Accessories', 'Wall Art'],
  'Beds': ['Dressers & Nightstands', 'Bedding', 'Lighting', 'Rugs', 'Mirrors', 'Wall Art'],
  'Dressers & Nightstands': ['Beds', 'Mirrors', 'Lighting', 'Bedding', 'Rugs', 'Wall Art'],
  'Dining Storage': ['Tables', 'Chairs & Seating', 'Lighting', 'Mirrors', 'Wall Art', 'Decor & Accessories'],
  'Cabinets & Shelving': ['Decor & Accessories', 'Lighting', 'Chairs & Seating', 'Rugs', 'Wall Art', 'Botanicals'],
  'Desks & Office': ['Chairs & Seating', 'Lighting', 'Cabinets & Shelving', 'Rugs', 'Wall Art', 'Decor & Accessories'],
  'Lighting': ['Tables', 'Sofas & Sectionals', 'Chairs & Seating', 'Rugs', 'Wall Art', 'Decor & Accessories'],
  'Rugs': ['Sofas & Sectionals', 'Chairs & Seating', 'Tables', 'Pillows & Throws', 'Lighting', 'Wall Art'],
  'Wall Art': ['Sofas & Sectionals', 'Chairs & Seating', 'Lighting', 'Decor & Accessories', 'Rugs', 'Pillows & Throws'],
  'Mirrors': ['Dining Storage', 'Tables', 'Lighting', 'Decor & Accessories', 'Dressers & Nightstands', 'Botanicals'],
  'Pillows & Throws': ['Sofas & Sectionals', 'Chairs & Seating', 'Rugs', 'Bedding', 'Wall Art', 'Lighting'],
  'Bedding': ['Beds', 'Pillows & Throws', 'Dressers & Nightstands', 'Lighting', 'Rugs', 'Wall Art'],
  'Decor & Accessories': ['Tables', 'Cabinets & Shelving', 'Lighting', 'Wall Art', 'Botanicals', 'Mirrors'],
  'Botanicals': ['Decor & Accessories', 'Tables', 'Wall Art', 'Lighting', 'Cabinets & Shelving', 'Rugs'],
  'Outdoor': ['Outdoor', 'Rugs', 'Lighting', 'Pillows & Throws', 'Botanicals', 'Decor & Accessories'],
};
let CENT = null;
function centroids() {
  if (CENT) return CENT;
  CENT = TYPES.map(() => new Float32Array(DIM)); const cnt = new Array(TYPES.length).fill(0);
  for (let i = 0, o = 0; i < N; i++, o += DIM) { const c = CENT[META.t[i]]; for (let j = 0; j < DIM; j++) c[j] += EMB[o + j] / 127; cnt[META.t[i]]++; }
  CENT.forEach((c, t) => { for (let j = 0; j < DIM; j++) c[j] /= cnt[t] || 1; });
  return CENT;
}
async function complete({ id, filters, per }) {
  const C = centroids(), src = META.t[id], v = itemVec(id);
  const style = new Float32Array(DIM); for (let j = 0; j < DIM; j++) style[j] = v[j] - C[src][j];
  const sn = norm(style);
  const f = filters || {}, vset = f.vendors && f.vendors.length ? new Set(f.vendors) : null;
  const targets = (PAIRS[TYPES[src]] || ['Rugs', 'Lighting', 'Wall Art', 'Decor & Accessories', 'Pillows & Throws', 'Tables']).map(t => TYPES.indexOf(t)).filter(t => t >= 0);
  const rows = [];
  for (const tt of targets) {
    const ct = C[tt], sc = [];
    for (let i = 0, o = 0; i < N; i++, o += DIM) {
      if (META.t[i] !== tt || i === id) continue;
      if (f.soOnly && META.so && META.so[i] === 0) continue;
      if (f.quick && !QS[i]) continue;
      if (vset && !vset.has(META.v[i])) continue;
      let a = 0, b = 0; for (let j = 0; j < DIM; j++) { const x = EMB[o + j] / 127; a += (x - ct[j]) * sn[j]; b += x * v[j]; }
      sc.push([i, a + 0.35 * b]);
    }
    sc.sort((x, y) => y[1] - x[1]);
    const out = [], seen = new Set(), perV = {};
    for (const [i] of sc) {
      const k = META.v[i] + '|' + NAMELC[i].replace(/[^a-z0-9]/g, ''); if (seen.has(k) || seen.has(META.i[i])) continue;
      if ((perV[META.v[i]] || 0) >= 3) continue;
      seen.add(k); seen.add(META.i[i]); perV[META.v[i]] = (perV[META.v[i]] || 0) + 1;
      out.push(i); if (out.length >= (per || 12)) break;
    }
    rows.push({ type: TYPES[tt], items: out.map(i => ({ id: i, n: META.n[i], i: META.i[i], u: META.u[i], v: VENDORS[META.v[i]], c: META.c[i], d: META.d[i], s: META.s[i], ty: TYPES[META.t[i]], qs: QS[i], so: META.so ? META.so[i] : 1, vr: META.vrules ? META.vrules[META.v[i]] : '', W: META.w[i], D: META.dd[i], H: META.dh[i] })) });
  }
  post('complete', { id, rows });
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') await loadCatalog();
    else if (m.type === 'warm') { (m.which === 'vision' ? loadVision() : loadText()).catch(() => {}); }
    else if (m.type === 'search') await search(m);
    else if (m.type === 'rules') { applyRules(m.cfg); post('rulesApplied', {}); }
    else if (m.type === 'room') await roomDetect(m);
    else if (m.type === 'complete') await complete(m);
    else if (m.type === 'roomMatch') await roomMatch(m);
  } catch (err) { post('error', { message: String(err && err.message || err) }); }
};
