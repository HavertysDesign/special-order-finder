const $ = (s) => document.querySelector(s);
const worker = new Worker('worker.js', { type: 'module' });
const state = { q: '', image: null, likeId: null, likeItem: null, types: new Set(), vendor: '', maxW: null, limit: 60, lastItems: [], catalogReady: false, textReady: false, visionReady: false };
let VENDORS = [], TYPES = [];

const EXAMPLES = ['curved boucle swivel chair', 'round travertine coffee table', 'navy and rust vintage-style rug', 'rattan pendant light', 'abstract art in blush and gold', 'channel-tufted velvet bed', 'olive tree in planter'];
let TYPEIMG = [], TCOUNTS = [];

// ---------- saved board (per-browser) ----------
const BKEY = 'sof-board-v1';
function loadBoard() { try { return JSON.parse(localStorage.getItem(BKEY) || '[]'); } catch { return []; } }
function saveBoard(b) { try { localStorage.setItem(BKEY, JSON.stringify(b)); } catch {} renderBoard(); }
let board = loadBoard();
const inBoard = (u) => board.some((x) => x.u === u);
function toggleSave(it, btn) {
  if (inBoard(it.u)) board = board.filter((x) => x.u !== it.u);
  else board.unshift({ n: it.n, u: it.u, i: it.i, v: it.v, d: it.d, s: it.s });
  saveBoard(board);
  if (btn) { btn.setAttribute('aria-pressed', inBoard(it.u)); btn.textContent = inBoard(it.u) ? '♥' : '♡'; }
}
function renderBoard() {
  $('#boardCount').textContent = board.length;
  const L = $('#boardList'); L.innerHTML = '';
  if (!board.length) { L.innerHTML = '<p style="color:var(--muted)">Tap ♡ on any result to save it here for a client.</p>'; return; }
  for (const it of board) {
    const row = document.createElement('div'); row.className = 'bitem';
    const img = document.createElement('img'); img.src = it.i; img.alt = '';
    const a = document.createElement('a'); a.href = it.u; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = it.n; const sm = document.createElement('small'); sm.textContent = [it.v, it.s, it.d].filter(Boolean).join(' · '); a.appendChild(sm);
    const x = document.createElement('button'); x.textContent = '✕'; x.setAttribute('aria-label', 'Remove');
    x.onclick = () => { board = board.filter((b) => b.u !== it.u); saveBoard(board); syncSaveButtons(); };
    row.append(img, a, x); L.appendChild(row);
  }
}
function syncSaveButtons() { document.querySelectorAll('.card').forEach((c) => { const b = c.querySelector('.save'); const u = c.dataset.u; b.setAttribute('aria-pressed', inBoard(u)); b.textContent = inBoard(u) ? '♥' : '♡'; }); }
$('#boardBtn').onclick = () => { $('#board').hidden = false; };
$('#closeBoard').onclick = () => { $('#board').hidden = true; };
$('#clearBoard').onclick = () => { if (confirmClear()) { board = []; saveBoard(board); syncSaveButtons(); } };
function confirmClear() { const b = $('#clearBoard'); if (b.dataset.armed) { delete b.dataset.armed; b.textContent = 'Clear'; return true; } b.dataset.armed = 1; b.textContent = 'Tap again to clear'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Clear'; }, 3000); return false; }
$('#copyBoard').onclick = async () => {
  const txt = board.map((it) => `${it.n} — ${it.v}${it.s ? ' (' + it.s + ')' : ''}${it.d ? ' — ' + it.d : ''}\n${it.u}`).join('\n\n');
  try { await navigator.clipboard.writeText(txt); $('#copyBoard').textContent = 'Copied!'; } catch { $('#copyBoard').textContent = 'Copy failed'; }
  setTimeout(() => ($('#copyBoard').textContent = 'Copy list'), 1800);
};
renderBoard();

// ---------- UI ----------
function setStatus(html) { $('#status').innerHTML = html; }
function progressStatus(label, pct) { setStatus(`${label} (first time only)… <span class="bar"><i style="width:${pct}%"></i></span> ${pct}%`); }

function renderTypes() {
  const box = $('#typeChips'); box.innerHTML = '';
  const all = document.createElement('button'); all.type = 'button'; all.textContent = 'All'; all.setAttribute('aria-pressed', state.types.size === 0);
  all.onclick = () => { state.types.clear(); renderTypes(); run(); }; box.appendChild(all);
  TYPES.forEach((t, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.setAttribute('aria-pressed', state.types.has(i));
    b.onclick = () => { state.types.has(i) ? state.types.delete(i) : state.types.add(i); renderTypes(); run(); };
    box.appendChild(b);
  });
}

function card(it) {
  const n = $('#cardTpl').content.firstElementChild.cloneNode(true);
  n.dataset.u = it.u;
  n.querySelector('.imgwrap').href = it.u;
  const img = n.querySelector('img'); img.src = it.i; img.alt = it.n; img.referrerPolicy = 'no-referrer';
  img.onerror = () => { img.style.opacity = .15; };
  n.querySelector('.vendor').textContent = it.v;
  n.querySelector('.name').textContent = it.n;
  n.querySelector('.meta').textContent = [it.d, it.c].filter(Boolean).join(' · ');
  n.querySelector('.link').href = it.u;
  const sv = n.querySelector('.save'); sv.setAttribute('aria-pressed', inBoard(it.u)); sv.textContent = inBoard(it.u) ? '♥' : '♡';
  sv.onclick = () => toggleSave(it, sv);
  n.querySelector('.similar').onclick = () => {
    state.likeId = it.id; state.likeItem = it; clearPhoto(false);
    $('#likeThumb').src = it.i; $('#likeLabel').textContent = 'Similar to: ' + it.n; $('#likeChip').hidden = false;
    run(); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return n;
}

function render(items, total, ms, note) {
  $('#empty').hidden = true;
  const R = $('#results'); R.innerHTML = '';
  items.forEach((it) => R.appendChild(card(it)));
  $('#moreBtn').hidden = items.length < state.limit;
  let msg = items.length ? `Top ${items.length} matches` : 'No matches. Try fewer words, a wider size, or remove a filter.';
  if (state.lastDims) msg += ` · only pieces within 5" of <b>${state.lastDims}</b>`;
  if (note === 'keyword' && !state.textReady) msg += ' · keyword matches while the smart search loads…';
  setStatus(msg);
}

let pending = false, running = false;
function run() {
  const q = $('#q').value.trim();
  if (!q && !state.image && state.likeId == null && !state.types.size) { $('#results').innerHTML = ''; $('#moreBtn').hidden = true; $('#empty').hidden = false; setStatus(''); return; }
  if (!state.catalogReady) { pending = true; return; }
  if (running) { pending = true; return; }
  running = true;
  if (state.image && !state.visionReady) setStatus('Loading photo AI (first time only)…');
  else setStatus('Searching…');
  worker.postMessage({ type: 'search', q, image: state.image, likeId: state.likeId, limit: state.limit,
    filters: { types: [...state.types], vendors: state.vendor === '' ? [] : [Number(state.vendor)], maxW: state.maxW } });
}

worker.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'catalog') {
    VENDORS = m.vendors; TYPES = m.types; state.catalogReady = true;
    $('#catalogInfo').textContent = `Search ${m.n.toLocaleString()} pieces from ${VENDORS.length} special-order vendors by description or photo`;
    TYPEIMG = m.typeImg; TCOUNTS = m.tcounts; renderTiles();
    $('#updated').textContent = m.updated ? `Catalog updated ${m.updated}.` : '';
    const sel = $('#vendorSel');
    VENDORS.map((v, i) => [v, i]).sort((a, b) => a[0].localeCompare(b[0])).forEach(([v, i]) => { const o = document.createElement('option'); o.value = i; o.textContent = `${v} (${(m.vcounts[i] || 0).toLocaleString()})`; sel.appendChild(o); });
    renderTypes();
    worker.postMessage({ type: 'warm', which: 'text' });
    if (pending) { pending = false; run(); }
  } else if (m.type === 'progress') { if (running || room.busy || !state.textReady) progressStatus(m.label, m.pct); }
  else if (m.type === 'ready') {
    if (m.which === 'text') { state.textReady = true; if ($('#q').value.trim() && state.lastNote === 'keyword') run(); else if (!running) setStatus(''); }
    if (m.which === 'vision') state.visionReady = true;
  } else if (m.type === 'results') {
    running = false; state.lastNote = m.note; state.lastDims = m.dims; render(m.items, m.total, m.ms, m.note);
    if (pending) { pending = false; run(); }
  } else if (m.type === 'roomBoxes') { onRoomBoxes(m); setStatus(''); }
  else if (m.type === 'roomRow') { onRoomRow(m); }
  else if (m.type === 'roomStage') { if (m.text) setStatus(m.text); else { room.busy = false; setStatus(''); } }
  else if (m.type === 'error') { running = false; room.busy = false; setStatus('Something went wrong: ' + m.message); }
};
worker.postMessage({ type: 'init' });

function renderTiles() {
  const T = $('#tiles'); T.innerHTML = '';
  TYPES.forEach((t, i) => {
    const b = document.createElement('button'); b.className = 'tile'; b.type = 'button';
    const d = document.createElement('div'); d.className = 'ti'; const im = document.createElement('img'); im.loading = 'lazy'; im.alt = ''; im.src = TYPEIMG[i] || ''; im.referrerPolicy = 'no-referrer'; d.appendChild(im);
    const s = document.createElement('strong'); s.textContent = t; const sm = document.createElement('small'); sm.textContent = (TCOUNTS[i] || 0).toLocaleString() + ' pieces';
    b.append(d, s, sm); b.onclick = () => { state.types = new Set([i]); renderTypes(); state.limit = 60; run(); window.scrollTo({ top: $('.filters').offsetTop - 8, behavior: 'smooth' }); };
    T.appendChild(b);
  });
}
$('#browseLink').onclick = (e) => { e.preventDefault(); $('#q').value = ''; clearPhoto(false); state.likeId = null; $('#likeChip').hidden = true; state.types.clear(); renderTypes(); run(); $('#tiles').scrollIntoView({ behavior: 'smooth' }); };
// examples
EXAMPLES.forEach((x) => { const b = document.createElement('button'); b.textContent = x; b.onclick = () => { $('#q').value = x; state.limit = 60; run(); }; $('#examples').appendChild(b); });

$('#searchForm').onsubmit = (e) => { e.preventDefault(); state.limit = 60; $('#q').blur(); run(); };
$('#vendorSel').onchange = (e) => { state.vendor = e.target.value; run(); };
$('#maxW').onchange = (e) => { const v = parseFloat(e.target.value); state.maxW = v > 0 ? v : null; run(); };
$('#moreBtn').onclick = () => { state.limit += 60; run(); };

// photo input
function setPhoto(file) {
  if (!file || !file.type.startsWith('image/')) return;
  state.image = file; state.likeId = null; $('#likeChip').hidden = true;
  $('#photoThumb').src = URL.createObjectURL(file); $('#photoChip').hidden = false;
  worker.postMessage({ type: 'warm', which: 'vision' });
  state.limit = 60; run();
}
function clearPhoto(rerun = true) { state.image = null; $('#photoChip').hidden = true; $('#photo').value = ''; if (rerun) run(); }
$('#photo').onchange = (e) => setPhoto(e.target.files[0]);
$('#clearPhoto').onclick = () => clearPhoto();
$('#clearLike').onclick = () => { state.likeId = null; $('#likeChip').hidden = true; run(); };
document.addEventListener('paste', (e) => { const f = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/')); if (f) { e.preventDefault(); setPhoto(f); } });
const dz = document.body;
dz.addEventListener('dragover', (e) => { e.preventDefault(); $('#dropZone').classList.add('drag'); });
dz.addEventListener('dragleave', (e) => { if (!e.relatedTarget) $('#dropZone').classList.remove('drag'); });
dz.addEventListener('drop', (e) => { e.preventDefault(); $('#dropZone').classList.remove('drag'); setPhoto(e.dataTransfer.files[0]); });


// ---------- Shop the room ----------
const room = { boxes: [], W: 0, H: 0, active: null, drawing: false, nextId: 100, busy: false };
function roomFilters() { return { vendors: state.vendor === '' ? [] : [Number(state.vendor)], maxW: state.maxW }; }
function startRoom(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (!state.catalogReady) { setStatus('One moment, the catalog is still loading…'); setTimeout(() => startRoom(file), 800); return; }
  $('#room').hidden = false; $('#results').innerHTML = ''; $('#moreBtn').hidden = true; $('#empty').hidden = true;
  $('#roomImg').src = URL.createObjectURL(file); $('#roomBoxes').innerHTML = '';
  $('#roomRows').innerHTML = '<div class="rrwait">Looking at the photo… The first time, the room AI takes a minute to download.</div>';
  room.boxes = []; room.busy = true; setDraw(false);
  worker.postMessage({ type: 'room', image: file });
  $('#room').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const NICE = { 'picture frame': 'wall art', 'painting': 'wall art', 'framed wall art': 'wall art' };
function titleFor(b) { if (b.title) { const t = NICE[b.title] || b.title; return t.charAt(0).toUpperCase() + t.slice(1); } return b.typeName ? b.typeName : (b.label || 'Piece'); }
function drawBoxes() {
  const L = $('#roomBoxes'); L.innerHTML = '';
  for (const b of room.boxes) {
    const d = document.createElement('div'); d.className = 'rbox' + (b.drawn ? ' drawn' : '') + (room.active === b.id ? ' on' : '');
    d.style.left = (100 * b.x / room.W) + '%'; d.style.top = (100 * b.y / room.H) + '%';
    d.style.width = (100 * b.w / room.W) + '%'; d.style.height = (100 * b.h / room.H) + '%';
    const s = document.createElement('span'); s.textContent = b.n; d.appendChild(s);
    d.onclick = (e) => { if (room.drawing) return; e.stopPropagation(); focusRow(b.id); };
    L.appendChild(d);
  }
}
function focusRow(id) {
  room.active = id; drawBoxes();
  document.querySelectorAll('.rrow').forEach((r) => r.classList.toggle('on', r.dataset.id == id));
  const r = document.querySelector(`.rrow[data-id="${id}"]`); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function renumber() { room.boxes.forEach((b, i) => { b.n = i + 1; }); }
function rowFor(b) {
  let r = document.querySelector(`.rrow[data-id="${b.id}"]`);
  if (!r) {
    const wait = $('#roomRows .rrwait'); if (wait) wait.remove();
    r = document.createElement('div'); r.className = 'rrow'; r.dataset.id = b.id;
    r.innerHTML = '<div class="rrhead"><span class="num"></span><strong></strong><select aria-label="Type of piece"></select><button class="x" type="button" aria-label="Remove this piece">✕</button></div><div class="rrscroll"><div class="rrwait">Finding matches…</div></div>';
    const sel = r.querySelector('select');
    TYPES.forEach((t) => { const o = document.createElement('option'); o.value = t; o.textContent = t; sel.appendChild(o); });
    sel.onchange = () => { b.typeName = sel.value; b.title = null; r.querySelector('.rrscroll').innerHTML = '<div class="rrwait">Finding matches…</div>'; worker.postMessage({ type: 'roomMatch', box: b, typeName: sel.value, filters: roomFilters() }); };
    r.querySelector('.x').onclick = () => { room.boxes = room.boxes.filter((x) => x !== b); r.remove(); renumber(); drawBoxes(); document.querySelectorAll('.rrow').forEach((rr) => { const bb = room.boxes.find((x) => x.id == rr.dataset.id); if (bb) rr.querySelector('.num').textContent = bb.n; }); };
    r.onclick = (e) => { if (e.target.closest('select,button,a')) return; room.active = b.id; drawBoxes(); document.querySelectorAll('.rrow').forEach((x) => x.classList.toggle('on', x === r)); };
    $('#roomRows').appendChild(r);
  }
  r.querySelector('.num').textContent = b.n; r.querySelector('strong').textContent = titleFor(b);
  if (b.typeName) r.querySelector('select').value = b.typeName;
  return r;
}
function onRoomBoxes(m) {
  room.W = m.W; room.H = m.H; room.boxes = m.boxes.map((b) => ({ ...b })); renumber(); drawBoxes();
  $('#roomRows').innerHTML = room.boxes.length ? '' : '<div class="rrwait">No pieces found automatically. Tap <b>Draw a box</b> and drag around a piece.</div>';
  room.boxes.forEach(rowFor);
}
function onRoomRow(m) {
  const b = room.boxes.find((x) => x.id === m.id); if (!b) return;
  b.typeName = m.typeName; b.title = m.title; const r = rowFor(b); const sc = r.querySelector('.rrscroll'); sc.innerHTML = '';
  if (!m.items.length) sc.innerHTML = '<div class="rrwait">No matches with the current vendor or width filter.</div>';
  m.items.forEach((it) => { const c = card(it); c.querySelector('.similar').remove(); sc.appendChild(c); });
}
function setDraw(on) {
  room.drawing = on; $('#drawBtn').setAttribute('aria-pressed', on);
  $('#roomPhotoWrap').classList.toggle('drawing', on);
  $('#roomHint').innerHTML = on ? '<b>Drag on the photo</b> around the piece you want to match.' : 'Numbered boxes show the pieces we found. Tap a box to jump to its matches. Missing something? Tap <b>Draw a box</b> and drag around it.';
}
$('#drawBtn').onclick = () => setDraw(!room.drawing);
$('#closeRoom').onclick = () => { $('#room').hidden = true; room.boxes = []; setDraw(false); run(); };
$('#roomPhoto').onchange = (e) => { startRoom(e.target.files[0]); e.target.value = ''; };
(() => {
  const wrap = $('#roomPhotoWrap'); let start = null, ghost = null;
  const pt = (e) => { const r = $('#roomImg').getBoundingClientRect(); return { x: Math.min(Math.max(e.clientX - r.left, 0), r.width), y: Math.min(Math.max(e.clientY - r.top, 0), r.height), r }; };
  wrap.addEventListener('pointerdown', (e) => {
    if (!room.drawing || !room.W) return; e.preventDefault(); wrap.setPointerCapture(e.pointerId);
    start = pt(e); ghost = document.createElement('div'); ghost.className = 'rbox drawn on'; $('#roomBoxes').appendChild(ghost);
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!start) return; const p = pt(e);
    Object.assign(ghost.style, { left: Math.min(p.x, start.x) + 'px', top: Math.min(p.y, start.y) + 'px', width: Math.abs(p.x - start.x) + 'px', height: Math.abs(p.y - start.y) + 'px' });
  });
  wrap.addEventListener('pointerup', (e) => {
    if (!start) return; const p = pt(e), r = p.r, k = room.W / r.width;
    const box = { x: Math.min(p.x, start.x) * k, y: Math.min(p.y, start.y) * k, w: Math.abs(p.x - start.x) * k, h: Math.abs(p.y - start.y) * k };
    start = null; ghost.remove(); ghost = null;
    if (box.w < 15 || box.h < 15) return;
    const b = { ...box, id: room.nextId++, drawn: true, label: 'Your selection' };
    room.boxes.push(b); renumber(); drawBoxes(); rowFor(b); setDraw(false); focusRow(b.id);
    worker.postMessage({ type: 'roomMatch', box: b, filters: roomFilters() });
  });
})();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
