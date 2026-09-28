const $ = (s) => document.querySelector(s);
const worker = new Worker('worker.js', { type: 'module' });
const state = { q: '', image: null, likeId: null, likeItem: null, types: new Set(), vendor: '', maxW: null, limit: 60, lastItems: [], catalogReady: false, textReady: false, visionReady: false };
let VENDORS = [], TYPES = [];
// ---------- customer view ----------
const CKEY = 'sof-customer-view';
state.cust = (() => { try { return localStorage.getItem(CKEY) === '1'; } catch { return false; } })();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function custName(it) {
  // piece name a customer can see: no vendor names or item numbers
  let n = ' ' + (it.n || '') + ' ';
  const brands = ['Coastal Living Home Collection', 'Miranda Kerr Home', 'Special Order', 'Havertys'].concat(VENDORS);
  for (const v of brands) n = n.replace(new RegExp('(^|[\\s(\\-|–])' + esc(v.replace(/\s*\(.*\)\s*/, '')) + '(?=[\\s)\\-|–,]|$)', 'ig'), ' ');
  for (const v of VENDORS) {
    const core = v.replace(/\s*\(.*\)\s*/, '').replace(/\s*(&\s*Company|Rugs|Furniture|Furnishings|Home|Company|Collection|Art Group|Group)$/i, '');
    if (core.length > 3) n = n.replace(new RegExp('(^|\\s)' + esc(core) + '(?=\\s|$)', 'ig'), ' ');
  }
  n = n.split(' | ')[0];
  n = n.replace(/\b[A-Z]{2,3}\d{1,2}\b/g, ' ')                                          // HU1, BO4 (rug design codes)
       .replace(/\b(?=[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z])[A-Z0-9]{1,8}(?:[-_/][A-Z0-9]{1,8})+\b/g, ' ')   // ARHI-001, 104-BR-QSB
       .replace(/\b\d{3,}(?:-\d+)+\b/g, ' ')                                                  // 7514-60
       .replace(/\b[A-Z]{1,5}\d{3,}[A-Z0-9]*\b/g, ' ')                                        // CVPDA124B, U533676
       .replace(/\b\d{4,}[A-Z]*\b/g, ' ')                                                     // 10007
       .replace(/\s*[-|–]\s*$/g, '').replace(/\s{2,}/g, ' ').replace(/^[\s\-|–,:]+|[\s\-|–,:]+$/g, '');
  if (n === n.toUpperCase()) n = n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const kind = (it.ty || 'Piece').replace(/ &.*$/, '').replace(/s$/, '');
  const words = n.split(/\s+/).filter((w) => /[a-z]{2}/i.test(w));
  if (!words.length) return kind;
  if (words.length === 1 && !n.toLowerCase().includes(kind.toLowerCase())) return n + ' ' + kind;
  return n;
}
function setCust(on) {
  state.cust = on; try { localStorage.setItem(CKEY, on ? '1' : '0'); } catch {}
  document.body.classList.toggle('cust', on); $('#custBtn').setAttribute('aria-pressed', on);
  if (on && state.vendor !== '') { state.vendor = ''; $('#vendorSel').value = ''; }
  document.querySelectorAll('.card').forEach((c) => { if (c._it) c.replaceWith(card(c._it)); });
  renderBoard();
}

const EXAMPLES = ['curved boucle swivel chair', 'round travertine coffee table', 'navy and rust vintage-style rug', 'rattan pendant light', 'abstract art in blush and gold', 'channel-tufted velvet bed', 'olive tree in planter'];
let TYPEIMG = [], TCOUNTS = [];

// ---------- client boards (saved on this device) ----------
const BKEY = 'sof-boards-v2';
const uid = () => Math.random().toString(36).slice(2, 9);
function loadBoards() {
  let B = null;
  try { B = JSON.parse(localStorage.getItem(BKEY) || 'null'); } catch {}
  if (!B || !Array.isArray(B.list) || !B.list.length) {
    let old = []; try { old = JSON.parse(localStorage.getItem('sof-board-v1') || '[]'); } catch {}
    const b = { id: uid(), name: old.length ? 'My saved pieces' : 'My board', created: Date.now(), items: old.map((x) => ({ ...x, note: '', qty: 1 })) };
    B = { active: b.id, list: [b] };
  }
  if (!B.list.some((b) => b.id === B.active)) B.active = B.list[0].id;
  return B;
}
let boards = loadBoards();
const active = () => boards.list.find((b) => b.id === boards.active);
function persist() { try { localStorage.setItem(BKEY, JSON.stringify(boards)); } catch {} renderBoard(); }
const inBoard = (u) => active().items.some((x) => x.u === u);
function toast(html) { const t = $('#toast'); t.innerHTML = html; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600); }
function toggleSave(it, btn) {
  const b = active();
  if (inBoard(it.u)) { b.items = b.items.filter((x) => x.u !== it.u); toast(`Removed from <b>${escHtml(b.name)}</b>`); }
  else { b.items.unshift({ n: it.n, u: it.u, i: it.i, v: it.v, d: it.d, s: it.s, c: it.c, ty: it.ty, note: '', qty: 1 }); toast(`Saved to <b>${escHtml(b.name)}</b> · <button type="button" class="linkbtn" onclick="document.getElementById('boardBtn').click()">View</button>`); }
  b.updated = Date.now(); persist();
  if (btn) { btn.setAttribute('aria-pressed', inBoard(it.u)); btn.textContent = inBoard(it.u) ? '♥' : '♡'; }
}
function escHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
function renderBoard() {
  const b = active();
  $('#boardCount').textContent = b.items.length;
  $('#boardPillName').textContent = b.name.length > 22 ? b.name.slice(0, 21) + '…' : b.name;
  const sel = $('#boardSel'); sel.innerHTML = '';
  [...boards.list].sort((x, y) => (y.updated || y.created) - (x.updated || x.created)).forEach((x) => {
    const o = document.createElement('option'); o.value = x.id; o.textContent = `${x.name} (${x.items.length})`; if (x.id === b.id) o.selected = true; sel.appendChild(o);
  });
  if (document.activeElement !== $('#boardName')) $('#boardName').value = b.name;
  const pieces = b.items.reduce((s, x) => s + (+x.qty || 1), 0);
  $('#boardInfo').textContent = `${b.items.length} piece${b.items.length === 1 ? '' : 's'}${pieces !== b.items.length ? ` (${pieces} total)` : ''} · started ${new Date(b.created).toLocaleDateString()}`;
  const L = $('#boardList'); L.innerHTML = '';
  if (!b.items.length) { L.innerHTML = '<p class="small">Tap ♡ on any result to save it to this board.</p>'; return; }
  for (const it of b.items) {
    const row = document.createElement('div'); row.className = 'bitem';
    const img = document.createElement('img'); img.src = it.i; img.alt = ''; img.referrerPolicy = 'no-referrer';
    const body = document.createElement('div'); body.className = 'bbody';
    const a = document.createElement(state.cust ? 'span' : 'a'); a.className = 'bname';
    if (!state.cust) { a.href = it.u; a.target = '_blank'; a.rel = 'noopener'; }
    a.textContent = state.cust ? custName(it) : it.n; const sm = document.createElement('small');
    sm.textContent = (state.cust ? [it.d] : [it.v, it.s, it.d]).filter(Boolean).join(' · '); a.appendChild(sm);
    const opts = document.createElement('div'); opts.className = 'bopts';
    const note = document.createElement('input'); note.className = 'bnote'; note.placeholder = 'Finish, fabric, notes…'; note.value = it.note || ''; note.maxLength = 140; note.setAttribute('aria-label', 'Notes for ' + it.n);
    note.onchange = () => { it.note = note.value.trim(); b.updated = Date.now(); try { localStorage.setItem(BKEY, JSON.stringify(boards)); } catch {} };
    const q = document.createElement('label'); q.className = 'bqty'; q.textContent = 'Qty ';
    const qi = document.createElement('input'); qi.type = 'number'; qi.min = 1; qi.max = 99; qi.value = it.qty || 1; qi.inputMode = 'numeric';
    qi.onchange = () => { it.qty = Math.max(1, Math.min(99, parseInt(qi.value) || 1)); qi.value = it.qty; b.updated = Date.now(); persist(); };
    q.appendChild(qi); opts.append(note, q); body.append(a, opts);
    const x = document.createElement('button'); x.textContent = '✕'; x.setAttribute('aria-label', 'Remove');
    x.onclick = () => { b.items = b.items.filter((y) => y.u !== it.u); b.updated = Date.now(); persist(); syncSaveButtons(); };
    row.append(img, body, x); L.appendChild(row);
  }
}
function syncSaveButtons() { document.querySelectorAll('.card').forEach((c) => { const b = c.querySelector('.save'); const u = c.dataset.u; b.setAttribute('aria-pressed', inBoard(u)); b.textContent = inBoard(u) ? '♥' : '♡'; }); }
function switchBoard(id) { boards.active = id; persist(); syncSaveButtons(); }
$('#custBtn').onclick = () => setCust(!state.cust);
document.body.classList.toggle('cust', state.cust); $('#custBtn').setAttribute('aria-pressed', state.cust);
$('#boardBtn').onclick = () => { $('#board').hidden = false; };
$('#closeBoard').onclick = () => { $('#board').hidden = true; };
$('#boardSel').onchange = (e) => switchBoard(e.target.value);
$('#newBoardBtn').onclick = () => { $('#newBoardForm').hidden = false; $('#newBoardName').value = ''; $('#newBoardName').focus(); };
$('#newBoardCancel').onclick = () => { $('#newBoardForm').hidden = true; };
$('#newBoardForm').onsubmit = (e) => {
  e.preventDefault(); const name = $('#newBoardName').value.trim(); if (!name) return;
  const b = { id: uid(), name, created: Date.now(), updated: Date.now(), items: [] };
  boards.list.push(b); $('#newBoardForm').hidden = true; switchBoard(b.id); toast(`Now saving to <b>${escHtml(name)}</b>`);
};
$('#boardName').onchange = () => { const v = $('#boardName').value.trim(); if (v) { active().name = v; persist(); } else $('#boardName').value = active().name; };
$('#deleteBoard').onclick = () => {
  const btn = $('#deleteBoard');
  if (!btn.dataset.armed) { btn.dataset.armed = 1; btn.textContent = 'Tap again to delete'; setTimeout(() => { delete btn.dataset.armed; btn.textContent = 'Delete board'; }, 3000); return; }
  delete btn.dataset.armed; btn.textContent = 'Delete board';
  const gone = active().name; boards.list = boards.list.filter((b) => b.id !== boards.active);
  if (!boards.list.length) boards.list.push({ id: uid(), name: 'My board', created: Date.now(), items: [] });
  boards.active = boards.list[0].id; persist(); syncSaveButtons(); toast(`Deleted <b>${escHtml(gone)}</b>`);
};
$('#copyBoard').onclick = async () => {
  const b = active();
  const line = (it) => {
    const extra = [it.qty > 1 ? `Qty ${it.qty}` : '', it.note].filter(Boolean).join(' · ');
    return state.cust ? `${custName(it)}${it.d ? ' — ' + it.d : ''}${extra ? '\n   ' + extra : ''}`
      : `${it.n} — ${it.v}${it.s ? ' (' + it.s + ')' : ''}${it.d ? ' — ' + it.d : ''}${extra ? '\n   ' + extra : ''}\n${it.u}`;
  };
  const txt = b.name + '\n\n' + b.items.map(line).join(state.cust ? '\n' : '\n\n');
  try { await navigator.clipboard.writeText(txt); $('#copyBoard').textContent = 'Copied!'; } catch { $('#copyBoard').textContent = 'Copy failed'; }
  setTimeout(() => ($('#copyBoard').textContent = 'Copy list'), 1800);
};
renderBoard();
// ---------- selections sheet (print / text / QR) ----------
async function packSheet(obj) {
  const bytes = new Uint8Array(await new Response(new Blob([new TextEncoder().encode(JSON.stringify(obj))]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  let s = ''; bytes.forEach((x) => { s += String.fromCharCode(x); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
$('#sheetBoard').onclick = async () => {
  const b = active(); if (!b.items.length) { toast('Save a few pieces to this board first.'); return; }
  const w = window.open('', '_blank');   // open right away so pop-up blockers allow it
  let me = {}; try { me = JSON.parse(localStorage.getItem('sof-designer') || '{}'); } catch {}
  const it = b.items.map((x) => { const o = { n: custName(x), d: x.d || '', i: x.i }; if ((+x.qty || 1) > 1) o.q = +x.qty; if (x.note) o.o = x.note; return o; });
  const sig = it.map((x) => x.i || x.n).join('|').length + ':' + it.map((x) => (x.n || '').slice(0, 6)).join('');
  try { localStorage.setItem('sof-sheet-int', JSON.stringify({ sig, items: b.items.map((x) => ({ v: x.v, s: x.s, u: x.u })) })); } catch {}
  const url = new URL('sheet.html', location.href).href + '#d=' + await packSheet({ b: b.name, t: Date.now(), dz: me.dz || '', st: me.st || '', ph: me.ph || '', it });
  if (w) w.location = url; else location.href = url;
};

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
  n.dataset.u = it.u; n._it = it;
  const shownName = state.cust ? custName(it) : it.n;
  if (state.cust) { n.querySelector('.imgwrap').removeAttribute('href'); n.querySelector('.link').remove(); }
  else n.querySelector('.imgwrap').href = it.u;
  const img = n.querySelector('img'); img.src = it.i; img.alt = shownName; img.referrerPolicy = 'no-referrer';
  img.onerror = () => { img.style.opacity = .15; };
  n.querySelector('.vendor').textContent = it.v;
  n.querySelector('.name').textContent = shownName;
  n.querySelector('.meta').textContent = state.cust ? (it.d || '') : [it.d, it.c].filter(Boolean).join(' · ');
  if (!state.cust) n.querySelector('.link').href = it.u;
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
    filters: { types: [...state.types], vendors: state.vendor === '' || state.cust ? [] : [Number(state.vendor)], maxW: state.maxW } });
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
    if (state.cust) setCust(true);
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

// ---------- Refresh catalog (runs the GitHub refresh workflow) ----------
const GH = 'https://api.github.com/repos/HavertysDesign/special-order-finder';
const TKEY = 'sof-gh-refresh-key';
const getKey = () => { try { return localStorage.getItem(TKEY) || ''; } catch { return ''; } };
const setKey = (k) => { try { k ? localStorage.setItem(TKEY, k) : localStorage.removeItem(TKEY); } catch {} };
let pollTimer = null;
function ago(t) { const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} days ago`; }
async function loadRunStatus() {
  const el = $('#runStat');
  try {
    const r = await fetch(GH + '/actions/workflows/refresh.yml/runs?per_page=1', { headers: getKey() ? { Authorization: 'Bearer ' + getKey() } : {} });
    const run = (await r.json()).workflow_runs?.[0];
    if (!run) { el.textContent = 'No refresh has run yet.'; return null; }
    el.className = 'runstat';
    if (run.status !== 'completed') { el.classList.add('busy'); el.innerHTML = `<b>Refresh in progress</b>, started ${ago(run.run_started_at || run.created_at)}. The site updates when it finishes.`; }
    else if (run.conclusion === 'success') el.innerHTML = `Last refresh finished <b>${ago(run.updated_at)}</b>.`;
    else { el.classList.add('bad'); el.innerHTML = `Last refresh (${ago(run.updated_at)}) did not finish. <a href="${run.html_url}" target="_blank" rel="noopener">See details ↗</a>`; }
    return run;
  } catch { el.textContent = "Couldn't check refresh status right now."; return null; }
}
function showKeyUI() { const k = !!getKey(); $('#tokenArea').hidden = k; $('#runArea').hidden = !k; }
$('#refreshOpen').onclick = async () => {
  $('#runMsg').textContent = ''; showKeyUI(); $('#refreshDlg').showModal();
  const run = await loadRunStatus(); $('#runNow').disabled = !!(run && run.status !== 'completed');
  clearInterval(pollTimer); pollTimer = setInterval(async () => { if (!$('#refreshDlg').open) return clearInterval(pollTimer); const r = await loadRunStatus(); $('#runNow').disabled = !!(r && r.status !== 'completed'); }, 30000);
};
$('#tokenSave').onclick = () => { const k = $('#tokenIn').value.trim(); if (!k) return; setKey(k); $('#tokenIn').value = ''; showKeyUI(); $('#runMsg').textContent = 'Key saved on this device.'; };
$('#tokenForget').onclick = () => { setKey(''); showKeyUI(); $('#runMsg').textContent = 'Key removed from this device.'; };
$('#runNow').onclick = async () => {
  const b = $('#runNow'); b.disabled = true; $('#runMsg').textContent = 'Starting…';
  try {
    const r = await fetch(GH + '/actions/workflows/refresh.yml/dispatches', { method: 'POST', headers: { Authorization: 'Bearer ' + getKey(), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: 'main' }) });
    if (r.status === 204) { $('#runMsg').textContent = 'Refresh started. Check back in a couple of hours; you can close this.'; setTimeout(loadRunStatus, 6000); }
    else if (r.status === 401 || r.status === 403 || r.status === 404) { $('#runMsg').textContent = "GitHub didn't accept the key. It may have expired. Forget it and paste a new one."; b.disabled = false; }
    else { $('#runMsg').textContent = `GitHub said ${r.status}. Try again in a minute.`; b.disabled = false; }
  } catch { $('#runMsg').textContent = "Couldn't reach GitHub. Check your connection."; b.disabled = false; }
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
