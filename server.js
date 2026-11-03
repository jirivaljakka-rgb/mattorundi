const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const cap = require('./capacity');
const PORT = process.env.PORT || 8080;
const DATA = process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json');
const ADMIN_PIN = process.env.ADMIN_PIN || 'matto2026';
const DEFAULTS = { maxPickupPerDay: 24, storageCapacity: 50, turnaroundDays: 3, washPerDay: 6, workDays: [1,2,3,4,5],
  priceMedium: 39, priceLarge: 49, vatPct: 25.5, sellerCodes: ['ROOPE','AHMED'], bookingHorizonDays: 60 };
function load() { try { const db = JSON.parse(fs.readFileSync(DATA)); db.settings = { ...DEFAULTS, ...db.settings }; return db; } catch { return { settings: { ...DEFAULTS }, orders: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(DATA), { recursive: true }); fs.writeFileSync(DATA + '.tmp', JSON.stringify(db, null, 2)); fs.renameSync(DATA + '.tmp', DATA); }
let db = load();
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Helsinki' });
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const body = req => new Promise(r => { let b = ''; req.on('data', c => { b += c; if (b.length > 15e6) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
const isAdmin = req => req.headers['x-admin-pin'] === ADMIN_PIN;
function publicOrder(o) { return o; }
function withReturns() { const sim = cap.simulate(db.orders, db.settings); return db.orders.map(o => ({ ...o, returnDate: sim.returns[o.id] || null })); }

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); const p = u.pathname;
  try {
    if (p === '/api/public-settings') { const s = db.settings; return send(res, 200, { priceMedium: s.priceMedium, priceLarge: s.priceLarge, vatPct: s.vatPct, workDays: s.workDays, turnaroundDays: s.turnaroundDays, bookingHorizonDays: s.bookingHorizonDays }); }
    if (p === '/api/calendar') {
      const n = Math.max(1, parseInt(u.searchParams.get('n')) || 1);
      const from = u.searchParams.get('from') || today();
      const days = cap.calendar(db.orders, db.settings, from, Math.min(90, parseInt(u.searchParams.get('days')) || 42), n, today());
      const first = days.find(d => d.ok);
      return send(res, 200, { days: days.map(d => ({ date: d.date, ok: d.ok, reason: d.ok ? null : d.reason, returnDate: d.returnDate || null })), nextFree: first ? first.date : null });
    }
    if (p === '/api/orders' && req.method === 'POST') {
      const b = await body(req); const s = db.settings;
      const med = Math.max(0, parseInt(b.medium) || 0), lg = Math.max(0, parseInt(b.large) || 0), n = med + lg;
      if (!n) return send(res, 400, { error: 'Valitse vähintään yksi matto.' });
      if (!b.name || !b.phone || !b.address || !b.pickupDate) return send(res, 400, { error: 'Nimi, puhelin, osoite ja noutopäivä vaaditaan.' });
      if (!b.acceptTerms) return send(res, 400, { error: 'Ehtojen hyväksyntä puuttuu.' });
      if (b.channel === 'kotimyynti') {
        if (!s.sellerCodes.map(x => x.toUpperCase()).includes(String(b.sellerCode || '').toUpperCase())) return send(res, 400, { error: 'Tuntematon myyjäkoodi.' });
        if (b.photo && !/^data:image\/(jpeg|png|webp);base64,/.test(String(b.photo))) return send(res, 400, { error: 'Kuva ei kelpaa.' });
      }
      const c = cap.check(db.orders, s, b.pickupDate, n, today());
      if (!c.ok) return send(res, 409, { error: 'Päivä ei ole enää vapaana (' + c.reason + '). Valitse toinen päivä.' });
      const total = med * s.priceMedium + lg * s.priceLarge;
      const o = { id: crypto.randomUUID(), number: 'MR-' + new Date().getFullYear() + '-' + String(db.orders.length + 1).padStart(4, '0'),
        createdAt: new Date().toISOString(), channel: b.channel === 'kotimyynti' ? 'kotimyynti' : 'verkko', status: 'vahvistettu',
        name: String(b.name).slice(0,120), phone: String(b.phone).slice(0,40), email: String(b.email||'').slice(0,120), address: String(b.address).slice(0,200),
        postal: String(b.postal||'').slice(0,10), city: String(b.city||'Tampere').slice(0,60), notes: String(b.notes||'').slice(0,1000),
        medium: med, large: lg, carpetsTotal: n, priceMedium: s.priceMedium, priceLarge: s.priceLarge, vatPct: s.vatPct, total,
        vat: Math.round(total - total / (1 + s.vatPct / 100)) === 0 ? 0 : +(total - total / (1 + s.vatPct / 100)).toFixed(2),
        payment: b.payment === 'heti' ? 'maksettu heti' : 'palautuksen yhteydessä', pickupDate: b.pickupDate, pickupTime: String(b.pickupTime||'').slice(0,40),
        startEarly: !!b.startEarly, marketingConsent: !!b.marketingConsent, sellerCode: b.channel === 'kotimyynti' ? String(b.sellerCode).toUpperCase() : null,
        signature: null, hasPhoto: !!(b.channel === 'kotimyynti' && b.photo), termsVersion: 'LUONNOS-2026-11', estReturnAtBooking: c.returnDate };
      if (o.hasPhoto) { const mm = String(b.photo).match(/^data:image\/(\w+);base64,(.*)$/); const dir = path.join(path.dirname(DATA), 'photos'); fs.mkdirSync(dir, { recursive: true }); o.photoFile = o.id + '.' + (mm[1] === 'jpeg' ? 'jpg' : mm[1]); fs.writeFileSync(path.join(dir, o.photoFile), Buffer.from(mm[2], 'base64')); }
      db.orders.push(o); save(db);
      return send(res, 201, { id: o.id });
    }
    let m;
    if ((m = p.match(/^\/api\/orders\/([\w-]{36})$/)) && req.method === 'GET') {
      const o = withReturns().find(x => x.id === m[1]); return o ? send(res, 200, o) : send(res, 404, { error: 'Ei löydy' });
    }
    if ((m = p.match(/^\/api\/admin\/photo\/([\w-]{36})$/))) {
      if (u.searchParams.get('pin') !== ADMIN_PIN && !isAdmin(req)) return send(res, 401, { error: 'Väärä PIN' });
      const o = db.orders.find(x => x.id === m[1]); if (!o || !o.photoFile) return send(res, 404, {});
      res.writeHead(200, { 'Content-Type': MIME[path.extname(o.photoFile)] || 'image/webp' }); return res.end(fs.readFileSync(path.join(path.dirname(DATA), 'photos', o.photoFile)));
    }
    if (p.startsWith('/api/admin/')) {
      if (!isAdmin(req)) return send(res, 401, { error: 'Väärä PIN' });
      if (p === '/api/admin/orders') return send(res, 200, withReturns().map(o => ({ ...o, signature: o.signature ? '(tallennettu)' : null })));
      if (p === '/api/admin/settings' && req.method === 'GET') return send(res, 200, db.settings);
      if (p === '/api/admin/settings' && req.method === 'PUT') {
        const b = await body(req); const s = db.settings;
        for (const k of ['maxPickupPerDay','storageCapacity','turnaroundDays','washPerDay','priceMedium','priceLarge','vatPct','bookingHorizonDays']) if (b[k] !== undefined && !isNaN(+b[k]) && +b[k] >= 0) s[k] = +b[k];
        if (Array.isArray(b.workDays)) s.workDays = b.workDays.map(Number).filter(x => x >= 1 && x <= 7);
        if (Array.isArray(b.sellerCodes)) s.sellerCodes = b.sellerCodes.map(x => String(x).trim().toUpperCase()).filter(Boolean);
        save(db); return send(res, 200, s);
      }
      if (p === '/api/admin/capacity') {
        const sim = cap.simulate(db.orders, db.settings); const from = u.searchParams.get('from') || today(); const out = [];
        for (let i = 0; i < 28; i++) { const d = cap.addDays(from, i); const v = sim.days[d] || { pickups: 0, storage: 0 };
          const returns = withReturns().filter(o => o.status !== 'peruttu' && o.returnDate === d).reduce((a, o) => a + o.carpetsTotal, 0);
          out.push({ date: d, work: cap.isWork(d, db.settings), pickups: v.pickups, storage: v.storage, returns }); }
        return send(res, 200, { days: out, settings: db.settings });
      }
      if ((m = p.match(/^\/api\/admin\/orders\/([\w-]{36})$/)) && req.method === 'PATCH') {
        const b = await body(req); const o = db.orders.find(x => x.id === m[1]); if (!o) return send(res, 404, {});
        if (['vahvistettu','noudettu','pesussa','palautettu','peruttu'].includes(b.status)) o.status = b.status;
        if (b.paid !== undefined) o.payment = b.paid ? 'maksettu' : o.payment;
        save(db); return send(res, 200, o);
      }
      if (p === '/api/admin/export') { res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename=mattorundi.json' }); return res.end(JSON.stringify(db, null, 2)); }
    }
    // staattiset
    let f = path.normalize(path.join(__dirname, 'public', p === '/' ? 'index.html' : p));
    if (!f.startsWith(path.join(__dirname, 'public'))) return send(res, 403, {});
    if (!path.extname(f)) f += '.html';
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('404'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
  } catch (e) { console.error(e); send(res, 500, { error: 'Palvelinvirhe' }); }
}).listen(PORT, () => console.log('Mattorundi http://localhost:' + PORT));
