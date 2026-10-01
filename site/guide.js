// Help guide: ask a question in plain words, get simple steps, and "Show me where" points at the right button.
// Works entirely in the page (no downloads), so it answers instantly.
(() => {
  const $ = (s) => document.querySelector(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(sel, ms = 20000) { const t = Date.now(); while (Date.now() - t < ms) { const el = $(sel); if (el && el.offsetParent !== null) return el; await wait(250); } return null; }
  // Some buttons only show up on product cards, so run a quick sample search first.
  async function needResults() {
    if ($('.grid .card')) return true;
    const q = $('#q'); q.value = 'sofa'; $('#searchForm').requestSubmit();
    return !!(await waitFor('.grid .card'));
  }
  const closeBoard = () => { const b = $('#board'); if (b && !b.hidden) $('#closeBoard').click(); };

  // Each topic: title, words people might use, steps (plain language), and where to point.
  const T = [
    { id: 'describe', title: 'Search by describing a piece', group: 'Finding pieces',
      words: 'search find look describe type words name typing search box looking for want need',
      steps: ['Click the long white box at the top that says <b>Describe the piece</b>.', 'Type what you want in everyday words, like <i>curved boucle swivel chair</i> or <i>round travertine coffee table</i>.', 'Press <b>Enter</b> on your keyboard, or click the brown <b>Search</b> button.', 'Scroll down to see the matches. Click any picture to open it on the vendor’s website.'],
      show: { sel: '#q', say: 'Type what you’re looking for here' } },
    { id: 'photo', title: 'Search with a photo', group: 'Finding pieces',
      words: 'photo picture image pic camera upload screenshot snapshot looks like this picture paste drag inspiration',
      steps: ['Click the small <b>camera</b> button next to the search box.', 'Pick the photo from your computer or phone.', 'Wait a few seconds. The first time takes a little longer.', 'You’ll see pieces that look like the one in your photo. You can also add words in the search box to narrow it down, like <i>leather</i>.', '<b>Tip:</b> you can also copy a picture (right-click it, then <b>Copy image</b>) and press <b>Ctrl + V</b> on this page.'],
      show: { sel: '.qrow .iconbtn', say: 'Click the camera to pick a photo' } },
    { id: 'room', title: 'Find every piece in a room photo', group: 'Finding pieces',
      words: 'shop the room whole room every piece all pieces inspiration photo room picture customer photo everything in the photo pinterest',
      steps: ['Click <b>Shop the room</b> under the search box.', 'Pick the room photo.', 'Numbered boxes appear on the photo, one for each piece it finds. Matches for each piece are listed next to it.', 'Missed a piece? Click <b>Draw a box</b>, then drag your mouse around that piece.'],
      show: { sel: 'label.roombtn', say: 'Click here and pick a room photo' } },
    { id: 'helper', title: 'Find one piece that goes with a room', group: 'Finding pieces',
      words: 'goes with match room go with coordinate rug for this room pillows colors in the room one piece help me pick room helper what would go',
      steps: ['Click <b>Find a piece for this room</b> under the search box.', 'Pick the room photo.', 'In the box, type what you need in your own words. For example: <i>I need a rug. Use the colors in the pillows.</i>', 'Click <b>Find it</b>.', 'It shows the colors it used. Click a color circle to leave that color out.'],
      show: { sel: '#helpOpen', say: 'Click here to start' } },
    { id: 'size', title: 'Find pieces that fit a certain size', group: 'Finding pieces',
      words: 'size dimension dimensions width wide inches measure measurement fit space small big long deep tall height 84 inches too big narrow',
      steps: ['Type the size right in the search box, like <i>sofa 84 inches wide</i> or <i>rug 8x10</i>.', 'You’ll only see pieces within 5 inches of that size.', 'Or type a number in the <b>Max width</b> box to hide anything wider than that.'],
      show: { sel: '#maxW', say: 'Type the widest size you can fit here' } },
    { id: 'type', title: 'Show only one kind of furniture', group: 'Narrowing results',
      words: 'type category kind only sofas only chairs filter lighting lamps lamp rugs beds tables browse shop by type department just',
      steps: ['Look for the row of buttons like <b>Sofas & Sectionals</b>, <b>Chairs & Seating</b>, <b>Tables</b>.', 'Click one to see only that kind of piece. Click it again to turn it off.', 'Click <b>All</b> to see everything again.'],
      show: { sel: '#typeChips', say: 'Click a type to see only those' } },
    { id: 'vendor', title: 'Show one vendor only', group: 'Narrowing results',
      words: 'vendor brand company manufacturer four hands bernhardt one vendor only specific supplier maker',
      steps: ['Find the box labeled <b>Vendor</b>.', 'Click it and pick the vendor from the list.', 'To see all vendors again, pick <b>All vendors</b>.'],
      show: { sel: '#vendorSel', say: 'Pick a vendor here' } },
    { id: 'approved', title: 'What we can special order (approved list)', group: 'Narrowing results',
      words: 'approved list allowed can we order special order only not approved check price list badge red yellow label warning categories rules hidden missing cant see where is vendor gone',
      steps: ['The box <b>Only what we can special order</b> is checked when you open the page. It hides pieces we can’t order from that vendor.', 'Uncheck it to see everything. Pieces we can’t order will show a red <b>Not on approved list</b> label.', 'A yellow <b>Check price list</b> label means look it up on the vendor’s price list before ordering.', 'Click <b>(list)</b> next to the checkbox to see which vendors are approved for what.'],
      show: { sel: 'label.sotoggle', say: 'This hides pieces we can’t special order' } },
    { id: 'quick', title: 'Show only quick ship / in stock', group: 'Narrowing results',
      words: 'quick ship in stock fast shipping available now ready soon stock inventory how fast delivery',
      steps: ['Check the box <b>Quick ship only</b>.', 'You’ll only see pieces the vendor lists as in stock or quick ship. They have a green <b>Quick ship</b> label.', 'Only some vendors share their stock, so fewer vendors show up while this is on.', 'Always confirm the delivery date with the vendor before promising it.'],
      show: { sel: '#quickWrap', say: 'Check this for quick ship pieces' } },
    { id: 'color', title: 'Match a color or fabric swatch', group: 'Narrowing results',
      words: 'color colour match swatch fabric sample same color navy blue green sage paint shade tone',
      steps: ['Click the <b>Color</b> button.', 'Click one of the color squares, like <b>Sage</b> or <b>Navy</b>.', 'Have a fabric swatch? Click <b>Swatch photo</b>, pick a photo of it, then click on the photo right on the color you want.', 'To stop matching a color, click the small <b>✕</b> on the Color button.'],
      show: { sel: '#colorBtn', say: 'Click here to pick a color' } },
    { id: 'refine', title: 'Make results lighter, darker, more modern…', group: 'Narrowing results',
      words: 'refine lighter darker warmer cooler modern traditional rustic glam wood brass leather velvet performance fabric adjust tweak change results',
      steps: ['Search first.', 'Right above the results you’ll see a row of buttons: <b>Lighter</b>, <b>Darker</b>, <b>More modern</b>, <b>Leather</b> and more.', 'Click one or more to reorder the results. Click again to undo, or click <b>Clear</b>.'],
      show: { sel: '#refineBar', say: 'Click these to adjust your results', results: true } },
    { id: 'similar', title: 'See more like a piece you found', group: 'Working with a piece',
      words: 'similar more like this like that alike same style other options alternatives',
      steps: ['Find the piece you like in the results.', 'Click the <b>≈</b> button under its picture.', 'You’ll see pieces that look similar from all the vendors.'],
      show: { sel: '.grid .card .similar', say: 'Click ≈ for similar pieces', results: true } },
    { id: 'complete', title: 'Find what goes with a piece', group: 'Working with a piece',
      words: 'complete the room goes with pair with coordinate accessorize what goes with rug for this sofa lamp for matching pieces',
      steps: ['Find the piece in the results, like a sofa.', 'Click the <b>✦</b> (star) button under its picture.', 'You’ll see rugs, tables, lighting, pillows and art that go with it.'],
      show: { sel: '.grid .card .pair', say: 'Click ✦ for pieces that go with it', results: true } },
    { id: 'compare', title: 'Compare pieces side by side', group: 'Working with a piece',
      words: 'compare side by side difference between two pieces versus vs comparison',
      steps: ['Click the <b>⇄</b> button under each piece you want to compare (up to 4).', 'A bar appears at the bottom of the screen.', 'Click <b>Compare</b> in that bar to see sizes and details side by side.'],
      show: { sel: '.grid .card .cmp', say: 'Click ⇄ on each piece to compare', results: true } },
    { id: 'price', title: 'See the price or more details', group: 'Working with a piece',
      words: 'price cost pricing how much details specs specifications availability vendor website more info open link view login',
      steps: ['Click the piece’s picture, or <b>View ↗</b> under it.', 'The vendor’s own website opens in a new tab with the full details.', 'Some vendors only show prices after you sign in to their site.'],
      show: { sel: '.grid .card .link', say: 'Click here to open it on the vendor’s site', results: true } },
    { id: 'save', title: 'Save pieces for a client (boards)', group: 'Client boards',
      words: 'save keep favorite heart bookmark remember list client customer board shortlist add hold later',
      steps: ['Click the <b>♡</b> (heart) under a piece to save it. It fills in when saved.', 'Click <b>My board</b> (the \u2665 button) at the top right to see what you saved.', 'In the board you can add notes and a quantity for each piece.', 'Everything saves on this computer automatically.'],
      show: { sel: '.grid .card .save', say: 'Click the heart to save a piece', results: true } },
    { id: 'boards', title: 'Make a board for each client', group: 'Client boards',
      words: 'new board another client rename board switch board different client multiple boards delete board name',
      steps: ['Click <b>My board</b> (the \u2665 button) at the top right.', 'Click <b>+ New board</b> and type a name, like <i>Johnson – Living room</i>. Click <b>Create</b>.', 'To switch clients, pick a different board from the <b>Board</b> list.', 'To rename it, click the name and type.'],
      show: { sel: '#boardBtn', say: 'Click here to open your boards' } },
    { id: 'sheet', title: 'Print or share the selections', group: 'Client boards',
      words: 'print selections sheet share send copy list email paperwork pdf record order write up',
      steps: ['Click <b>My board</b> (the \u2665 button) at the top right.', 'Click <b>Selections sheet</b>. A clean page opens with every piece, item number, size and your notes.', 'Click <b>Print</b> on that page, or <b>Copy link</b> to send it to a coworker.', 'Want it as text instead? Click <b>Copy list</b> in the board and paste it into an email.'],
      show: { sel: '#boardBtn', say: 'Open your board, then click Selections sheet' } },
    { id: 'customer', title: 'Show the screen to a customer', group: 'With customers',
      words: 'customer view hide vendor names show customer client looking at screen hide item numbers hide links private',
      steps: ['Click <b>Customer view</b> at the top of the page. On a phone it\u2019s the \ud83d\udc41 eye button.', 'Vendor names, item numbers and vendor links are hidden, so you can turn the screen toward your customer.', 'Click it again to turn it off.'],
      show: { sel: '#custBtn', say: 'Click here before showing a customer' } },
    { id: 'more', title: 'See more results', group: 'Finding pieces',
      words: 'more results show more show me more next page load more see more only 60 keep going',
      steps: ['Scroll to the bottom of the results.', 'Click <b>Show more</b>.'],
      show: { sel: '#moreBtn', say: 'Click here for more', results: true } },
    { id: 'clear', title: 'Start over', group: 'Finding pieces',
      words: 'start over clear reset remove photo go back home beginning undo',
      steps: ['Delete the words in the search box.', 'If there’s a photo, click the small <b>✕</b> next to it.', 'Or click <b>SOF</b> in the top left corner to go back to the start.'],
      show: { sel: '.logo', say: 'Click here to start over' } },
    { id: 'rules', title: 'Change the approved vendor list', group: 'Settings',
      words: 'edit approved list change rules add vendor category allowed update list manager',
      steps: ['Scroll to the very bottom of the page and click <b>Approved vendor list</b>.', 'Check or uncheck what each vendor is approved for.', 'Click <b>Save</b>. You’ll need the GitHub key the first time.'],
      show: { sel: '.foot a[href="rules.html"]', say: 'Click here to see or edit the list' } },
    { id: 'refresh', title: 'How up to date is the catalog?', group: 'Settings',
      words: 'refresh update new products discontinued current up to date latest catalog old missing product',
      steps: ['The catalog updates itself every Sunday with new and discontinued pieces.', 'The date of the last update is at the very bottom of the page.', 'Need it sooner? Click <b>Refresh catalog</b> at the bottom. It takes about 2 to 3 hours.'],
      show: { sel: '#refreshOpen', say: 'The update date and Refresh button are here' } },
    { id: 'phone', title: 'Use it on a phone or tablet', group: 'Settings',
      words: 'phone iphone android tablet ipad mobile home screen app shortcut install',
      steps: ['Open this same web address on your phone.', 'iPhone: tap the <b>Share</b> button, then <b>Add to Home Screen</b>.', 'Android: tap the <b>⋮</b> menu, then <b>Add to Home screen</b>.', 'Now it opens like an app.'] },
    { id: 'trouble', title: 'Something isn’t working', group: 'Settings',
      words: 'not working broken error wrong stuck page loading slow failed nothing happens problem issue help fix frozen blank',
      steps: ['Reload the page: press <b>F5</b>, or click the circle-arrow at the top of your browser.', 'If a message says <b>Try again</b>, click it.', 'Photo search takes a few extra seconds the first time.', 'Still stuck? Try closing the tab and opening the site again, or let Scott know what you clicked and what you saw.'] },
  ];
  const POPULAR = ['describe', 'photo', 'save', 'sheet', 'customer', 'price', 'helper', 'size'];

  // --- matching: everyday words, a few synonyms, and small typos ---
  const SYN = { pic: 'photo', pics: 'photo', picture: 'photo', pictures: 'photo', image: 'photo', images: 'photo', cam: 'camera', favourite: 'favorite', fave: 'favorite',
    couch: 'sofa', couches: 'sofa', sofas: 'sofa', settee: 'sofa', cost: 'price', costs: 'price', prices: 'price', $: 'price', colour: 'color', colours: 'color', colors: 'color',
    wishlist: 'save', favorites: 'favorite', hearts: 'heart', saved: 'save', saving: 'save', printing: 'print', printout: 'print', client: 'customer', clients: 'customer',
    customers: 'customer', instock: 'stock', measurements: 'size', dimensions: 'size', wide: 'width', inch: 'inches', broke: 'broken', doesnt: 'not', dont: 'not', isnt: 'not', cant: 'not', wont: 'not' };
  const STOP = new Set('how do i can to the a an is it of for on in my me you we what where does this that with be get see show find make want need there way please which'.split(' '));
  const lev1 = (a, b) => { // one letter wrong, missing, extra, or two letters swapped
    if (a === b) return true; if (Math.abs(a.length - b.length) > 1) return false;
    if (a.length === b.length) { const d = []; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d.push(i); return d.length === 1 || (d.length === 2 && d[1] === d[0] + 1 && a[d[0]] === b[d[1]] && a[d[1]] === b[d[0]]); }
    const [s, l] = a.length < b.length ? [a, b] : [b, a]; for (let i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === s) return true; return false; };
  const SYNK = Object.keys(SYN).filter((k) => k.length >= 5);
  const VOCAB = new Set(T.flatMap((t) => (t.words + ' ' + t.title).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)).concat(['stuck', 'have', 'save', 'where', 'there']));
  const norm = (w) => { w = w.toLowerCase().replace(/[^a-z0-9$]/g, ''); if (!w) return w;
    if (!SYN[w] && w.length >= 5 && !VOCAB.has(w)) { const k = SYNK.find((x) => lev1(x, w)); if (k) w = k; }
    w = SYN[w] || w; if (w.length > 4) w = w.replace(/(ing|ed|es|s)$/, ''); return w; };
  const words = (s) => s.split(/\s+/).map(norm).filter((w) => w && !STOP.has(w));
  const close = (a, b) => { if (a === b) return 1; if (a.length < 5 || b.length < 5) return 0; if (a.startsWith(b) || b.startsWith(a)) return 0.8; return lev1(a, b) ? 0.7 : 0; };
  T.forEach((t) => { t.kw = [...new Set(words(t.words + ' ' + t.title))]; t.tw = new Set(words(t.title)); t.phr = ' ' + (t.words + ' ' + t.title).toLowerCase() + ' '; });
  // rare words tell topics apart ("print"); common ones ("more", "list") count less
  const DF = {}; T.forEach((t) => t.kw.forEach((k) => { DF[k] = (DF[k] || 0) + 1; }));
  const idf = (k) => Math.log(1 + T.length / (DF[k] || 1)) / Math.log(1 + T.length);
  function ask(q) {
    const qw = words(q); if (!qw.length) return [];
    const raw = q.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    return T.map((t, n) => {
      let s = 0;
      // a real word ("stuck") is never treated as a typo of another ("stock")
      for (const w of qw) { let b = 0, bk = null; const known = !!DF[w]; for (const k of t.kw) { const c0 = close(w, k), c = (known && c0 === 0.7 ? 0 : c0) * idf(k); if (c > b) { b = c; bk = k; } } s += b * (bk && t.tw.has(bk) ? 1.4 : 1); }
      for (let i = 0; i < raw.length - 1; i++) { const bg = raw[i] + ' ' + raw[i + 1]; if (!(STOP.has(raw[i]) && STOP.has(raw[i + 1])) && t.phr.includes(' ' + bg + ' ')) s += 0.6; }
      return { t, s: s / Math.sqrt(qw.length) - n * 0.001 };
    }).filter((r) => r.s > 0.3).sort((a, b) => b.s - a.s).slice(0, 3);
  }

  // --- UI ---
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const root = document.createElement('div'); root.className = 'guide';
  root.innerHTML = `
    <button type="button" class="gbtn" id="gOpen" aria-haspopup="dialog" aria-controls="gPanel" title="Drag to move"><span aria-hidden="true">?</span> Need help?<i class="gdot" hidden></i></button>
    <div class="gpanel" id="gPanel" role="dialog" aria-label="Help" hidden>
      <div class="ghead" id="gHead" title="Drag here to move">
        <b>How can I help?</b>
        <div class="gtools">
          <button type="button" id="gClear" class="gclear" title="Start a new conversation">Clear</button>
          <button type="button" id="gMin" aria-label="Minimize help (your conversation is kept)" title="Minimize (your conversation is kept)">&#8211;</button>
        </div>
      </div>
      <div class="gbody" id="gBody"><div id="gThread"></div><div id="gMenu"></div></div>
      <form class="gask" id="gForm" autocomplete="off">
        <label for="gQ" class="gl">Type your question in your own words</label>
        <div class="grow"><input id="gQ" type="search" placeholder="e.g. how do I save a chair for my client?"><button class="gasknow">Ask</button></div>
      </form>
    </div>
    <div class="gspot" id="gSpot" hidden><div class="gtip" id="gTip"></div></div>`;
  document.body.appendChild(root);
  const panel = $('#gPanel'), body = $('#gBody'), thread = $('#gThread'), menu = $('#gMenu'), btn = $('#gOpen');
  const byId = (id) => T.find((x) => x.id === id);

  // The conversation: [{q, t, o:[ids]}], kept in this browser so it survives minimizing, closing and reloading.
  let chat = store.get('sof-guide-chat', []).filter((m) => !m.t || byId(m.t)).slice(-30);
  const topicButtons = (ids) => `<div class="glist">${ids.map((id) => `<button type="button" data-t="${id}">${esc(byId(id).title)}</button>`).join('')}</div>`;
  function msgHtml(m, i) {
    const you = `<div class="gyou">${esc(m.q)}</div>`;
    if (!m.t) return you + `<div class="gans"><p class="gmiss">I’m not sure about that one. Try asking with different words, or pick a topic below.</p></div>`;
    const t = byId(m.t);
    return you + `<div class="gans"><h3 class="gt">${esc(t.title)}</h3><ol class="gsteps">${t.steps.map((x) => `<li>${x}</li>`).join('')}</ol>
      ${t.show ? `<button type="button" class="gshow" data-show="${t.id}">👉 Show me where</button>` : ''}
      ${m.o && m.o.length ? `<div class="gsub">Or did you mean…</div>${topicButtons(m.o)}` : ''}</div>`;
  }
  function render(scrollToLast) {
    thread.innerHTML = chat.map(msgHtml).join('');
    menu.innerHTML = chat.length
      ? `<button type="button" class="glink" data-menu="all">See all help topics</button>`
      : `<div class="gsub">Popular questions</div><div class="gpop">${POPULAR.map((id) => `<button type="button" data-t="${id}">${esc(byId(id).title)}</button>`).join('')}</div><button type="button" class="glink" data-menu="all">See all help topics</button><p class="gnote">Tip: drag the <b>Need help?</b> button anywhere on the screen. Click <b>\u2013</b> to tuck this away; your conversation stays here until you click <b>Clear</b>.</p>`;
    $('.gdot').hidden = !chat.length; $('#gClear').hidden = !chat.length;
    if (scrollToLast) { const last = thread.lastElementChild && thread.lastElementChild.previousElementSibling; if (last) body.scrollTop = last.offsetTop - 8; }
  }
  function add(m) { chat.push(m); chat = chat.slice(-30); store.set('sof-guide-chat', chat); render(true); layout(); }
  function showAll() {
    const groups = [...new Set(T.map((t) => t.group))];
    menu.innerHTML = `<button type="button" class="glink back" data-menu="less">← Hide topics</button>` + groups.map((g) => `<div class="gsub">${esc(g)}</div>${topicButtons(T.filter((t) => t.group === g).map((t) => t.id))}`).join('');
    body.scrollTop = menu.offsetTop - 8;
  }
  body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-t]'); if (t) { add({ q: byId(t.dataset.t).title, t: t.dataset.t }); return; }
    const sh = e.target.closest('[data-show]'); if (sh) { showMe(byId(sh.dataset.show)); return; }
    const mm = e.target.closest('[data-menu]'); if (mm) { if (mm.dataset.menu === 'all') showAll(); else render(false); }
  });
  $('#gForm').onsubmit = (e) => {
    e.preventDefault(); const q = $('#gQ').value.trim(); if (!q) return;
    const r = ask(q); $('#gQ').value = '';
    add(r.length ? { q, t: r[0].t.id, o: r.slice(1).filter((x) => x.s > r[0].s * 0.6).map((x) => x.t.id) } : { q, t: null });
  };
  $('#gClear').onclick = () => { chat = []; store.set('sof-guide-chat', chat); render(false); $('#gQ').focus(); };

  // --- open / minimize; the panel sits next to the button wherever it has been moved ---
  function open() { panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); store.set('sof-guide-open', true); render(true); layout(); setTimeout(() => $('#gQ').focus({ preventScroll: true }), 50); }
  function shut() { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); store.set('sof-guide-open', false); }
  $('#gMin').onclick = shut;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('#gSpot').hidden) unspot(); else if (!panel.hidden) shut(); } });

  // pos = where the button's bottom-right corner sits, as distances from the right/bottom edges (survives window resizing)
  let pos = store.get('sof-guide-pos', null);
  // full height the panel would like: header + question box + the whole conversation (never its current, squeezed size)
  function naturalHeight() { return $('#gHead').offsetHeight + $('#gForm').offsetHeight + body.scrollHeight + 2; }
  // once the panel has been dragged by its header, it stays where it was put
  let ppos = store.get('sof-guide-ppos', null);
  function placePanel(W, H, m) {
    const pw = Math.min(400, W - 16); panel.style.width = pw + 'px';
    const left = Math.min(Math.max(ppos.l, m), W - pw - m), top = Math.min(Math.max(ppos.t, m), H - 200 - m);
    Object.assign(panel.style, { left: left + 'px', top: top + 'px', right: 'auto', bottom: 'auto', maxHeight: Math.min(640, H - top - m) + 'px' });
  }
  function layout() {
    const W = innerWidth, H = innerHeight, bw = btn.offsetWidth, bh = btn.offsetHeight, m = 8;
    const lift = !pos && root.classList.contains('lift') ? 66 : 0;
    let r = pos ? pos.r : (W < 560 ? 12 : 18), bt = pos ? pos.b : (W < 560 ? 12 : 18) + lift;
    r = Math.min(Math.max(r, m), W - bw - m); bt = Math.min(Math.max(bt, m), H - bh - m);
    Object.assign(btn.style, { right: r + 'px', bottom: bt + 'px', left: 'auto', top: 'auto' });
    if (panel.hidden) return;
    if (ppos) { placePanel(W, H, m); return; }
    const pw = Math.min(400, W - 16); panel.style.width = pw + 'px';
    const bx = W - r - bw, by = H - bt - bh; // button's top-left
    // panel above or below the button, whichever has room (shrinking to fit); if neither does, beside it
    const want = Math.min(naturalHeight(), 640), up = by - 10 - m, down = H - (by + bh + 10) - m;
    let top, left, maxH;
    const sideX = bx + bw / 2 < W / 2 ? bx : bx + bw - pw;
    if (want <= up) { top = by - 10 - want; maxH = want; left = sideX; }
    else if (want <= down) { top = by + bh + 10; maxH = want; left = sideX; }
    else if (Math.max(up, down) >= 300) { maxH = Math.max(up, down); top = up >= down ? by - 10 - maxH : by + bh + 10; left = sideX; }
    else { maxH = Math.min(want, H - 2 * m); top = Math.min(Math.max(by + bh / 2 - maxH / 2, m), H - maxH - m); left = bx - pw - 10 >= m ? bx - pw - 10 : bx + bw + 10; }
    left = Math.min(Math.max(left, m), W - pw - m); top = Math.max(top, m);
    Object.assign(panel.style, { left: left + 'px', top: top + 'px', right: 'auto', bottom: 'auto', maxHeight: maxH + 'px' });
  }
  addEventListener('resize', layout);

  // Drag the button, or the panel by its header. A tap (no real movement) still opens/minimizes.
  function draggable(handle, onTap) {
    let st = null;
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.gtools')) return;
      const br = btn.getBoundingClientRect(); st = { x: e.clientX, y: e.clientY, r: innerWidth - br.right, b: innerHeight - br.bottom, moved: false };
      e.preventDefault(); handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!st) return; const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.moved && Math.hypot(dx, dy) < 6) return;
      if (!st.moved && ppos) { ppos = null; store.set('sof-guide-ppos', null); }
      st.moved = true; root.classList.add('dragging');
      pos = { r: st.r - dx, b: st.b - dy }; layout();
    });
    const end = (e) => { if (!st) return; const moved = st.moved; st = null; root.classList.remove('dragging');
      if (moved) { layout(); const br = btn.getBoundingClientRect(); pos = { r: innerWidth - br.right, b: innerHeight - br.bottom }; store.set('sof-guide-pos', pos); }
      else if (onTap && e.type === 'pointerup') onTap(); };
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
  }
  draggable(btn, () => (panel.hidden ? open() : shut()));
  (() => {
    const head = $('#gHead'); let st = null;
    head.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.gtools')) return;
      const pr = panel.getBoundingClientRect(); st = { x: e.clientX, y: e.clientY, l: pr.left, t: pr.top };
      e.preventDefault(); head.setPointerCapture(e.pointerId); root.classList.add('dragging');
    });
    head.addEventListener('pointermove', (e) => {
      if (!st) return; const W = innerWidth, H = innerHeight, pw = panel.offsetWidth, ph = panel.offsetHeight, m = 8;
      const l = Math.min(Math.max(st.l + e.clientX - st.x, m), W - pw - m), t = Math.min(Math.max(st.t + e.clientY - st.y, m), H - Math.min(ph, 200) - m);
      Object.assign(panel.style, { left: l + 'px', top: t + 'px' }); // move only: width and height stay the same
    });
    const end = () => { if (!st) return; st = null; root.classList.remove('dragging');
      const pr = panel.getBoundingClientRect(); ppos = { l: pr.left, t: pr.top }; store.set('sof-guide-ppos', ppos);
      panel.style.maxHeight = Math.min(640, innerHeight - pr.top - 8) + 'px'; };
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
  })();
  btn.addEventListener('click', (e) => { if (e.detail === 0) (panel.hidden ? open() : shut()); }); // keyboard (Enter/Space)
  btn.addEventListener('dblclick', () => { pos = null; ppos = null; store.set('sof-guide-pos', null); store.set('sof-guide-ppos', null); layout(); }); // double-click: back to the corner

  render(false); layout();
  if (store.get('sof-guide-open', false) && chat.length) open();

  // --- "Show me where": scroll to the control and circle it ---
  let spotTimer = null;
  function unspot() { $('#gSpot').hidden = true; document.querySelectorAll('.ghl').forEach((e) => e.classList.remove('ghl')); clearTimeout(spotTimer); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); }
  let target = null;
  function place() {
    if (!target) return; const r = target.getBoundingClientRect(), tip = $('#gTip');
    const below = r.bottom + 90 < innerHeight; tip.style.left = Math.max(12, Math.min(innerWidth - tip.offsetWidth - 12, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
    tip.style.top = (below ? r.bottom + 14 : Math.max(12, r.top - tip.offsetHeight - 14)) + 'px'; tip.classList.toggle('up', !below);
  }
  async function showMe(t) {
    const s = t.show;
    if (t.id === 'sheet' || t.id === 'boards') closeBoard();
    if (s.results && !(await needResults())) return;
    if (t.id === 'refine' || t.id === 'more') await wait(400);
    let el = $(s.sel);
    if (el && el.hidden) el = el.parentElement;
    if (!el) return;
    if (innerWidth < 700) shut();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' }); await wait(450);
    unspot(); target = el; el.classList.add('ghl');
    $('#gTip').innerHTML = `${esc(s.say)} <button type="button" id="gGot">Got it</button>`;
    $('#gSpot').hidden = false; place(); $('#gGot').onclick = unspot;
    window.addEventListener('scroll', place, true); window.addEventListener('resize', place);
    spotTimer = setTimeout(unspot, 12000);
    el.addEventListener('click', unspot, { once: true });
  }

  // One friendly nudge for first-time visitors
  try { if (!localStorage.getItem('sof-guide-seen')) { setTimeout(() => { const b = $('#gOpen'); b.classList.add('nudge'); setTimeout(() => b.classList.remove('nudge'), 6000); }, 2500); localStorage.setItem('sof-guide-seen', '1'); } } catch {}
  // Lift the button above the compare bar when it's showing
  const tray = $('#cmpTray'); if (tray) new MutationObserver(() => { root.classList.toggle('lift', !tray.hidden); layout(); }).observe(tray, { attributes: true, attributeFilter: ['hidden'] });
  window.sofGuide = { ask, topics: T };
})();
