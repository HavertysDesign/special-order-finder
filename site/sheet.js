// Selections sheet (internal): a clean, printable record of a client board.
// The board travels in the link itself (#d=...), so the sheet can be reopened or passed to a colleague.
const $ = (s) => document.querySelector(s);
const b64u = {
  enc: (bytes) => { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec: (str) => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); },
};
async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
async function unpack(str) { return JSON.parse(new TextDecoder().decode(await pipe(b64u.dec(str), new DecompressionStream('deflate-raw')))); }
let data = null;

function render() {
  document.title = `${data.b} · Selections`;
  $('#board').textContent = data.b;
  $('#date').textContent = new Date(data.t || Date.now()).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const pieces = data.it.reduce((s, x) => s + (+x.q || 1), 0);
  $('#count').textContent = `${data.it.length} item${data.it.length === 1 ? '' : 's'}${pieces !== data.it.length ? ` · ${pieces} pieces total` : ''}`;
  const L = $('#items'); L.innerHTML = '';
  data.it.forEach((it, n) => {
    const el = document.createElement('article'); el.className = 'item';
    const ph = document.createElement('div'); ph.className = 'ph';
    if (it.i) { const im = document.createElement('img'); im.src = it.i; im.alt = ''; im.referrerPolicy = 'no-referrer'; im.onerror = () => im.remove(); ph.appendChild(im); }
    const body = document.createElement('div'); body.style.minWidth = '0';
    const sku = it.s && /\d/.test(it.s) && it.s.split(' ').length <= 2 ? it.s : '';
    if (it.v || sku) { const v = document.createElement('div'); v.className = 'vd'; v.textContent = [it.v, sku && '#' + sku].filter(Boolean).join(' · '); body.appendChild(v); }
    if (it.so === 0 || it.so === 2) { const w = document.createElement('div'); w.className = 'so ' + (it.so === 0 ? 'no' : 'check'); w.textContent = it.so === 0 ? `Not on approved list · ${it.v} approved for: ${it.vr}` : (/price list/i.test(it.vr || '') ? 'Check the price list before ordering' : `Check approved list · ${it.v} approved for: ${it.vr}`); body.appendChild(w); }
    const h = document.createElement('h3'); const num = document.createElement('span'); num.className = 'num'; num.textContent = n + 1;
    h.append(num, document.createTextNode(it.n)); body.appendChild(h);
    if (it.d) { const d = document.createElement('div'); d.className = 'dims'; d.textContent = it.d; body.appendChild(d); }
    if ((it.q || 1) > 1) { const q = document.createElement('div'); q.className = 'qty'; q.innerHTML = '<b>Qty</b> '; q.appendChild(document.createTextNode(it.q)); body.appendChild(q); }
    if (it.o) { const o = document.createElement('div'); o.className = 'nt'; o.innerHTML = '<b>Notes</b> '; o.appendChild(document.createTextNode(it.o)); body.appendChild(o); }
    if (it.u) { const l = document.createElement('div'); l.className = 'lnk'; const a = document.createElement('a'); a.href = it.u; a.target = '_blank'; a.rel = 'noopener'; a.textContent = it.u.replace(/^https?:\/\/(www\.)?/, ''); l.appendChild(a); body.appendChild(l); }
    el.append(ph, body); L.appendChild(el);
  });
}
async function init() {
  const m = location.hash.match(/#d=([\w-]+)/);
  try { if (!m) throw 0; data = await unpack(m[1]); } catch { $('#board').textContent = "This sheet couldn't be opened"; return; }
  render();
}
$('#printBtn').onclick = () => window.print();
$('#copyBtn').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); $('#copyBtn').textContent = 'Copied!'; } catch { $('#copyBtn').textContent = 'Copy failed'; }
  setTimeout(() => { $('#copyBtn').textContent = 'Copy link'; }, 1800);
};
init();
