// Selections sheet: renders a client board from the link itself (#d=...), so the customer's
// phone can open it from the QR code without any account or server.
const $ = (s) => document.querySelector(s);
const DKEY = 'sof-designer';
const b64u = {
  enc: (bytes) => { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec: (str) => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); },
};
async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
async function pack(obj) { return b64u.enc(await pipe(new TextEncoder().encode(JSON.stringify(obj)), new CompressionStream('deflate-raw'))); }
async function unpack(str) { return JSON.parse(new TextDecoder().decode(await pipe(b64u.dec(str), new DecompressionStream('deflate-raw')))); }
const sig = (items) => items.map((x) => x.i || x.n).join('|').length + ':' + items.map((x) => (x.n || '').slice(0, 6)).join('');
const base = () => location.href.split('#')[0];
let data = null, internal = null;

function get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }
function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

function render() {
  document.title = `${data.b} · Selections`;
  $('#board').textContent = data.b;
  $('#date').textContent = new Date(data.t || Date.now()).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  for (const k of ['dz', 'st', 'ph']) $('#' + k).textContent = data[k] || '';
  const showInt = internal && $('#intChk').checked;
  const L = $('#items'); L.innerHTML = '';
  data.it.forEach((it, n) => {
    const el = document.createElement('article'); el.className = 'item';
    const ph = document.createElement('div'); ph.className = 'ph';
    if (it.i) { const im = document.createElement('img'); im.src = it.i; im.alt = ''; im.referrerPolicy = 'no-referrer'; im.onerror = () => im.remove(); ph.appendChild(im); }
    const body = document.createElement('div');
    const h = document.createElement('h3'); const num = document.createElement('span'); num.className = 'num'; num.textContent = n + 1;
    h.append(num, document.createTextNode(it.n)); body.appendChild(h);
    if (it.d) { const d = document.createElement('div'); d.className = 'dims'; d.textContent = it.d; body.appendChild(d); }
    if ((it.q || 1) > 1) { const q = document.createElement('div'); q.className = 'qty'; q.innerHTML = '<b>Qty</b> '; q.appendChild(document.createTextNode(it.q)); body.appendChild(q); }
    if (it.o) { const o = document.createElement('div'); o.className = 'nt'; o.innerHTML = '<b>Notes</b> '; o.appendChild(document.createTextNode(it.o)); body.appendChild(o); }
    if (showInt && internal[n]) { const x = document.createElement('div'); x.className = 'int'; x.textContent = [internal[n].v, internal[n].s, internal[n].u].filter(Boolean).join(' · '); body.appendChild(x); }
    el.append(ph, body); L.appendChild(el);
  });
}

async function makeQR() {
  // the QR holds the whole sheet; if it's too much, drop photos (then notes) from the QR copy only
  const tries = [
    [data, ''],
    [{ ...data, it: data.it.map(({ i, ...r }) => r) }, 'The QR code shows piece names, sizes and notes. Text the link to include photos.'],
    [{ ...data, it: data.it.map(({ i, o, ...r }) => r) }, 'The QR code shows piece names and sizes. Text the link to include photos and notes.'],
  ];
  for (const [obj, msg] of tries) {
    const url = base() + '#d=' + await pack(obj);
    try {
      const q = qrcode(0, 'L'); q.addData(url, 'Byte'); q.make();
      if (q.getModuleCount() > 97) continue;   // denser than this is hard for phone cameras to read on paper
      $('#qr').src = q.createDataURL(4, 2); $('#qrBox').hidden = false; $('#qrNote').textContent = msg; return;
    } catch { /* too long for a QR code, try a smaller version */ }
  }
  $('#qrBox').hidden = true; $('#qrNote').textContent = 'Too many pieces for a QR code. Text or copy the link instead.';
}
async function fullLink() { return base() + '#d=' + await pack(data); }
async function refresh() { history.replaceState(null, '', await fullLink()); render(); await makeQR(); }

async function init() {
  const m = location.hash.match(/#d=([\w-]+)/);
  if (!m) { $('#board').textContent = 'No selections found'; $('#items').innerHTML = '<p>This link is incomplete. Ask your designer to send it again.</p>'; $('#qrBox').hidden = true; return; }
  try { data = await unpack(m[1]); } catch { $('#board').textContent = "This link couldn't be opened"; $('#qrBox').hidden = true; return; }
  // opened by the designer from the finder on this device? then allow edits and the internal copy
  const stash = get('sof-sheet-int');
  if (stash && stash.sig === sig(data.it)) {
    internal = stash.items; $('#intWrap').hidden = false; $('#editNote').hidden = false; document.body.classList.add('editing');
    const me = get(DKEY) || {};
    for (const k of ['dz', 'st', 'ph']) { if (!data[k] && me[k]) data[k] = me[k]; }
    for (const k of ['dz', 'st', 'ph']) {
      const el = $('#' + k); el.contentEditable = 'plaintext-only';
      el.onblur = async () => { data[k] = el.textContent.trim(); const d = get(DKEY) || {}; d[k] = data[k]; set(DKEY, d); await refresh(); };
      el.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } };
    }
    $('#intChk').onchange = render;
    await refresh();
  } else {
    // customer's copy: read only, just print and share
    $('#toolbar .title').textContent = 'Your Selections';
    render(); await makeQR();
  }
}
$('#printBtn').onclick = () => window.print();
$('#copyBtn').onclick = async () => {
  try { await navigator.clipboard.writeText(await fullLink()); $('#copyBtn').textContent = 'Copied!'; } catch { $('#copyBtn').textContent = 'Copy failed'; }
  setTimeout(() => { $('#copyBtn').textContent = 'Copy link'; }, 1800);
};
$('#shareBtn').onclick = async () => {
  const url = await fullLink(), text = `Your Havertys selections: ${data.b}`;
  if (navigator.share) { try { await navigator.share({ title: text, text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  location.href = `sms:?&body=${encodeURIComponent(text + ' ' + url)}`;
};
init();
