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
  let msg = items.length ? `Top ${items.length} matches` : 'No matches — try fewer words or remove a filter.';
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
  } else if (m.type === 'progress') { if (running || !state.textReady) progressStatus(m.label, m.pct); }
  else if (m.type === 'ready') {
    if (m.which === 'text') { state.textReady = true; if ($('#q').value.trim() && state.lastNote === 'keyword') run(); else if (!running) setStatus(''); }
    if (m.which === 'vision') state.visionReady = true;
  } else if (m.type === 'results') {
    running = false; state.lastNote = m.note; render(m.items, m.total, m.ms, m.note);
    if (pending) { pending = false; run(); }
  } else if (m.type === 'error') { running = false; setStatus('Something went wrong: ' + m.message); }
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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
