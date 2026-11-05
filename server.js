const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const cap = require('./capacity');
const { buildCustomerEmail, clampExtras, fiDate, resolveAgreedReturn, assertOutgoingEmail } = require('./confirmation');
const PORT = process.env.PORT || 8080;
const DATA = process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json');
const ADMIN_PIN = process.env.ADMIN_PIN || 'matto2026';
const DEFAULTS = { maxPickupPerDay: 24, storageCapacity: 50, turnaroundDays: 3, washPerDay: 6, workDays: [1,2,3,4,5],
  priceMedium: 44, priceLarge: 54, vatPct: 25.5, bookingHorizonDays: 60,
  // Kiinteät noutopäivät (hallin vuokrakausi marraskuu 2026). Tyhjä lista = normaalit työpäivät.
  pickupDates: ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'] };
// Oletusmyyjät: koodi = nimi isoin kirjaimin + 669. Perustajilla ei provisiota, muilla 20 € / iso ja 16 € / keski-/pieni matto.
const DEFAULT_SELLERS = [
  { code: 'ROOPE669', name: 'Roope Liimatainen', commissionPct: 0, commissionPerCarpet: 0, commissionPerLarge: 0, commissionPerMedium: 0, active: true },
  { code: 'AHMED669', name: 'Ahmed Alguvercin', commissionPct: 0, commissionPerCarpet: 0, commissionPerLarge: 0, commissionPerMedium: 0, active: true },
  { code: 'JANI669', name: 'Jani', commissionPct: 0, commissionPerCarpet: 0, commissionPerLarge: 20, commissionPerMedium: 16, active: true },
  { code: 'VILMA669', name: 'Vilma', commissionPct: 0, commissionPerCarpet: 0, commissionPerLarge: 20, commissionPerMedium: 16, active: true },
  { code: 'SEPI669', name: 'Sepi', commissionPct: 0, commissionPerCarpet: 0, commissionPerLarge: 20, commissionPerMedium: 16, active: true },
  { code: 'JERE669', name: 'Jere', commissionPct: 0, commissionPerCarpet: 0, commissionPerLarge: 20, commissionPerMedium: 16, active: true },
];
DEFAULTS.sellers = DEFAULT_SELLERS;
const OLD_CODES = ['ROOPE', 'AHMED', 'MYYJA1669', 'MYYJA2669', 'MYYJA3669', 'MYYJA4669']; // korvattu ROOPE669 / AHMED669
// Myyjät: koodi, nimi, provisio-%, €/matto sekä €/iso matto ja €/keski- tai pieni matto. Vanha sellerCodes-lista muunnetaan myyjiksi automaattisesti.
const cleanSellers = list => { const seen = new Set(); return (Array.isArray(list) ? list : []).map(x => ({
  code: String(x.code || '').toUpperCase().replace(/[^A-Z0-9ÅÄÖ_-]/g, '').slice(0, 20), name: String(x.name || '').trim().slice(0, 80),
  commissionPct: Math.max(0, +x.commissionPct || 0), commissionPerCarpet: Math.max(0, +x.commissionPerCarpet || 0),
  commissionPerLarge: Math.max(0, +x.commissionPerLarge || 0), commissionPerMedium: Math.max(0, +x.commissionPerMedium || 0), active: x.active !== false
})).filter(x => x.code && !seen.has(x.code) && seen.add(x.code)); };
function normalize(s) {
  if (!Array.isArray(s.sellers)) s.sellers = (s.sellerCodes || []).map(c => ({ code: c, name: c, commissionPct: 0, commissionPerCarpet: 0, active: true }));
  s.sellers = cleanSellers(s.sellers).filter(x => !OLD_CODES.includes(x.code));
  s.sellerCodes = s.sellers.filter(x => x.active).map(x => x.code);
  s.pickupDates = (Array.isArray(s.pickupDates) ? s.pickupDates : []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return s;
}
function load() { try { const db = JSON.parse(fs.readFileSync(DATA)); db.settings = normalize({ ...DEFAULTS, ...db.settings });
  // uudet oletusmyyjät lisätään olemassa olevaan tietokantaan, jos niitä ei vielä ole (ladattaessa)
  for (const d of DEFAULT_SELLERS) if (!db.settings.sellers.some(x => x.code === d.code)) db.settings.sellers.push({ ...d });
  db.settings.sellerCodes = db.settings.sellers.filter(x => x.active).map(x => x.code); return db; } catch { return { settings: normalize({ ...DEFAULTS, sellers: DEFAULT_SELLERS.map(x => ({ ...x })) }), orders: [] }; } }
const findSeller = code => db.settings.sellers.find(x => x.active && x.code === String(code || '').trim().toUpperCase());
// Google Sheets -kirjaus (kestävä tallennus). Fire-and-forget: virhe ei koskaan estä tilausta.
function toSheets(o) {
  const url = process.env.SHEETS_WEBHOOK_URL; if (!url || typeof fetch !== 'function') return;
  let ret = null; try { ret = cap.simulate(db.orders, db.settings).returns[o.id] || null; } catch {}
  const sl = o.sellerCode ? db.settings.sellers.find(x => x.code === String(o.sellerCode).toUpperCase()) : null;
  const shownReturn = o.agreedReturnDate || o.estReturnAtBooking || ret || '';
  const extraBits = [];
  if (o.extrasHair) extraBits.push('Karvanpoisto ' + o.extrasHair + ' kpl');
  if (o.extrasOdor) extraBits.push('Hajunpoisto (kaikki matot)');
  if (shownReturn) extraBits.push('Palautus ' + fiDate(shownReturn));
  const notesOut = [o.notes, extraBits.join(', ')].filter(Boolean).join(' · ');
  const order = { number: o.number, createdAt: o.createdAt, channel: o.channel, sellerCode: o.sellerCode || '', sellerName: o.sellerName || (sl && sl.name) || '',
    name: o.name, phone: o.phone, email: o.email, address: o.address, postal: o.postal, city: o.city, pickupDate: o.pickupDate, pickupTime: o.pickupTime,
    large: o.large || 0, medium: o.medium || 0, total: o.total, commission: o.commission || 0, returnDate: shownReturn, notes: notesOut, status: o.status, payment: o.payment,
    extrasHair: o.extrasHair || 0, extrasOdor: o.extrasOdor || 0 };
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: (process.env.SHEETS_SECRET || '').trim(), order }), redirect: 'manual', signal: AbortSignal.timeout(20000) })
    .then(r => { if (r.status >= 400) console.error('Sheets HTTP', r.status, o.number); })
    .catch(e => console.error('Sheets-virhe', o.number, e.message));
}
async function sendEmailViaSheets({ to, subject, body: plainBody, htmlBody, pdfHtml, pdfFilename, order }) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) throw new Error('Sähköpostipalvelu ei ole käytössä (SHEETS_WEBHOOK_URL puuttuu).');
  if (typeof fetch !== 'function') throw new Error('Sähköpostipalvelu ei ole käytössä.');
  // plainBody ei saa viitata requestin body-parseriin. Sekä body että htmlBody ovat
  // aina ei-tyhjiä ja JSON-kenttinä ennen pdfHtml:ää (katso OHJE-email.md).
  // Apps Script v6: if (b.htmlBody) msg.htmlBody = String(b.htmlBody).
  // Jos body on tyhjä, Gmail voi näyttää tyhjän viestin kun htmlBody ei renderöidy.
  const message = assertOutgoingEmail(plainBody, htmlBody);
  const fields = {
    secret: (process.env.SHEETS_SECRET || '').trim(),
    action: 'email',
    to,
    subject: subject || '',
    body: message.body,
    htmlBody: message.htmlBody
  };
  if (pdfFilename) fields.pdfFilename = pdfFilename;
  if (pdfHtml) fields.pdfHtml = pdfHtml;
  if (order) fields.order = order;
  const payload = JSON.stringify(fields);
  const iBody = payload.indexOf('"body":');
  const iHtml = payload.indexOf('"htmlBody":');
  const iPdf = payload.indexOf('"pdfHtml":');
  if (iBody < 0 || iHtml < iBody || (iPdf !== -1 && iPdf < iHtml)) {
    throw new Error('Sähköpostin kenttäjärjestys on väärä.');
  }
  // Apps Script palauttaa 302 → echo-URL; follow ei toimi POST:lle, joten haetaan Location erikseen.
  let r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, redirect: 'manual', signal: AbortSignal.timeout(25000) });
  if (r.status >= 300 && r.status < 400) {
    const loc = r.headers.get('location');
    if (!loc) throw new Error('Sähköpostipalvelu ei vastannut (puuttuva ohjaus).');
    r = await fetch(loc, { signal: AbortSignal.timeout(25000) });
  }
  let j = null; try { j = await r.json(); } catch {}
  if (r.status >= 400 || !j || j.ok !== true) {
    const msg = (j && j.error) || ('Sähköpostin lähetys epäonnistui (HTTP ' + r.status + ').');
    throw new Error(String(msg).slice(0, 300));
  }
  return j;
}
const emailCooldown = new Map(); // orderId -> last send ms
function save(db) { fs.mkdirSync(path.dirname(DATA), { recursive: true }); fs.writeFileSync(DATA + '.tmp', JSON.stringify(db, null, 2)); fs.renameSync(DATA + '.tmp', DATA); }
let db = load();
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Helsinki' });
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
const body = req => new Promise(r => { let b = ''; req.on('data', c => { b += c; if (b.length > 15e6) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
const isAdmin = req => req.headers['x-admin-pin'] === ADMIN_PIN;
// Asiakkaalle näytettävä tilaus: ei myyjän provisiota eikä sisäisiä tiedostonimiä
function publicOrder(o) { const { commission, photoFile, ...rest } = o; return rest; }
function withReturns() { const sim = cap.simulate(db.orders, db.settings); return db.orders.map(o => ({ ...o, returnDate: o.agreedReturnDate || o.estReturnAtBooking || sim.returns[o.id] || null })); }

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); const p = u.pathname;
  try {
    if (p === '/api/public-settings') { const s = db.settings; return send(res, 200, { priceMedium: s.priceMedium, priceLarge: s.priceLarge, vatPct: s.vatPct, workDays: s.workDays, turnaroundDays: s.turnaroundDays, bookingHorizonDays: s.bookingHorizonDays, pickupDates: s.pickupDates.filter(d => d > today()) }); }
    if (p === '/api/calendar') {
      const n = Math.max(1, parseInt(u.searchParams.get('n')) || 1);
      const from = u.searchParams.get('from') || today();
      const days = cap.calendar(db.orders, db.settings, from, Math.min(90, parseInt(u.searchParams.get('days')) || 42), n, today());
      const first = days.find(d => d.ok);
      return send(res, 200, { days: days.map(d => ({ date: d.date, ok: d.ok, reason: d.ok ? null : d.reason, returnDate: d.ok ? cap.addDays(d.date, 4) : null })), nextFree: first ? first.date : null });
    }
    if (p === '/api/orders' && req.method === 'POST') {
      const b = await body(req); const s = db.settings;
      const med = Math.max(0, parseInt(b.medium) || 0), lg = Math.max(0, parseInt(b.large) || 0), n = med + lg;
      if (!n) return send(res, 400, { error: 'Valitse vähintään yksi matto.' });
      if (!b.name || !b.phone || !b.address || !b.pickupDate) return send(res, 400, { error: 'Nimi, puhelin, osoite ja noutopäivä vaaditaan.' });
      if (!b.acceptTerms) return send(res, 400, { error: 'Ehtojen hyväksyntä puuttuu.' });
      if (b.channel === 'kotimyynti') {
        if (!findSeller(b.sellerCode)) return send(res, 400, { error: 'Tuntematon myyjäkoodi.' });
        if (b.photo && !/^data:image\/(jpeg|png|webp);base64,/.test(String(b.photo))) return send(res, 400, { error: 'Kuva ei kelpaa.' });
      }
      const c = cap.check(db.orders, s, b.pickupDate, n, today());
      if (!c.ok) return send(res, 409, { error: 'Päivä ei ole enää vapaana (' + c.reason + '). Valitse toinen päivä.' });
      const channel = b.channel === 'kotimyynti' ? 'kotimyynti' : 'verkko';
      const agreed = resolveAgreedReturn(b.pickupDate, channel === 'kotimyynti' ? b.returnDate : null);
      if (!agreed.ok) return send(res, 400, { error: agreed.error });
      const xtra = clampExtras(med, lg, b.extrasHair ?? b.hairRemoval, b.extrasOdor ?? b.odorRemoval);
      const hair = xtra.extrasHair, odor = xtra.extrasOdor, extrasSum = xtra.extrasSum;
      const total = med * s.priceMedium + lg * s.priceLarge + extrasSum;
      const o = { id: crypto.randomUUID(), number: 'MR-' + new Date().getFullYear() + '-' + String(db.orders.length + 1).padStart(4, '0'),
        createdAt: new Date().toISOString(), channel, status: 'vahvistettu',
        name: String(b.name).slice(0,120), phone: String(b.phone).slice(0,40), email: String(b.email||'').slice(0,120), address: String(b.address).slice(0,200),
        postal: String(b.postal||'').slice(0,10), city: String(b.city||'Tampere').slice(0,60), notes: String(b.notes||'').slice(0,1000),
        medium: med, large: lg, carpetsTotal: n, extrasHair: hair, extrasOdor: odor, priceMedium: s.priceMedium, priceLarge: s.priceLarge, vatPct: s.vatPct, total,
        vat: Math.round(total - total / (1 + s.vatPct / 100)) === 0 ? 0 : +(total - total / (1 + s.vatPct / 100)).toFixed(2),
        payment: b.payment === 'heti' ? 'maksettu heti' : b.payment === 'lasku' ? 'lasku 14 vrk' : 'palautuksen yhteydessä', pickupDate: b.pickupDate, pickupTime: String(b.pickupTime||'').slice(0,40),
        startEarly: !!b.startEarly, marketingConsent: !!b.marketingConsent, sellerCode: b.channel === 'kotimyynti' ? findSeller(b.sellerCode).code : null,
        sellerName: b.channel === 'kotimyynti' ? findSeller(b.sellerCode).name : null,
        commission: b.channel === 'kotimyynti' ? +(cap.commission(total, n, findSeller(b.sellerCode), { large: lg, medium: med }) + 2 * (hair + odor)).toFixed(2) : 0,
        signature: null, hasPhoto: !!(channel === 'kotimyynti' && b.photo), termsVersion: '2026-11', agreedReturnDate: agreed.date, estReturnAtBooking: agreed.date };
      if (o.hasPhoto) { const mm = String(b.photo).match(/^data:image\/(\w+);base64,(.*)$/); const dir = path.join(path.dirname(DATA), 'photos'); fs.mkdirSync(dir, { recursive: true }); o.photoFile = o.id + '.' + (mm[1] === 'jpeg' ? 'jpg' : mm[1]); fs.writeFileSync(path.join(dir, o.photoFile), Buffer.from(mm[2], 'base64')); }
      db.orders.push(o); save(db); toSheets(o);
      return send(res, 201, { id: o.id });
    }
    let m;
    if ((m = p.match(/^\/api\/orders\/([\w-]{36})\/email$/)) && req.method === 'POST') {
      const o = withReturns().find(x => x.id === m[1]);
      if (!o) return send(res, 404, { error: 'Ei löydy' });
      const b = await body(req);
      const to = String(b.to || o.email || '').trim();
      if (!to || !to.includes('@')) return send(res, 400, { error: 'Asiakkaalla ei ole sähköpostiosoitetta.' });
      const last = emailCooldown.get(o.id) || 0;
      if (Date.now() - last < 15000) return send(res, 429, { error: 'Odota hetki ennen uudelleenlähetystä.' });
      const mail = buildCustomerEmail(o);
      try {
        await sendEmailViaSheets({ to, subject: mail.subject, body: mail.body, htmlBody: mail.htmlBody, pdfHtml: mail.pdfHtml, pdfFilename: mail.pdfFilename, order: mail.order });
        emailCooldown.set(o.id, Date.now());
        return send(res, 200, { ok: true, to });
      } catch (err) {
        console.error('Email-virhe', o.number, err.message);
        return send(res, 502, { error: err.message || 'Sähköpostin lähetys epäonnistui.' });
      }
    }
    if ((m = p.match(/^\/api\/orders\/([\w-]{36})$/)) && req.method === 'GET') {
      const o = withReturns().find(x => x.id === m[1]); return o ? send(res, 200, publicOrder(o)) : send(res, 404, { error: 'Ei löydy' });
    }
    if ((m = p.match(/^\/api\/admin\/photo\/([\w-]{36})$/))) {
      if (u.searchParams.get('pin') !== ADMIN_PIN && !isAdmin(req)) return send(res, 401, { error: 'Väärä PIN' });
      const o = db.orders.find(x => x.id === m[1]); if (!o || !o.photoFile) return send(res, 404, {});
      res.writeHead(200, { 'Content-Type': MIME[path.extname(o.photoFile)] || 'image/webp' }); return res.end(fs.readFileSync(path.join(path.dirname(DATA), 'photos', o.photoFile)));
    }
    if (p.startsWith('/api/admin/')) {
      if (!isAdmin(req)) return send(res, 401, { error: 'Väärä PIN' });
      if (p === '/api/admin/orders') return send(res, 200, withReturns().map(o => {
        // vanhoille tilauksille (ennen provisio-ominaisuutta) provisio ja nimi lasketaan myyjärekisteristä, kuten raportissa
        const sl = o.sellerCode ? db.settings.sellers.find(x => x.code === String(o.sellerCode).toUpperCase()) : null;
        return { ...o, signature: o.signature ? '(tallennettu)' : null, sellerName: o.sellerName || (sl && sl.name) || o.sellerCode,
          commission: o.commission !== undefined ? o.commission : (o.channel === 'kotimyynti' ? cap.commission(o.total, o.carpetsTotal, sl, { large: o.large || 0, medium: o.medium || 0 }) : 0) };
      }));
      if (p === '/api/admin/settings' && req.method === 'GET') return send(res, 200, db.settings);
      if (p === '/api/admin/settings' && req.method === 'PUT') {
        const b = await body(req); const s = db.settings;
        for (const k of ['maxPickupPerDay','storageCapacity','turnaroundDays','washPerDay','priceMedium','priceLarge','vatPct','bookingHorizonDays']) if (b[k] !== undefined && !isNaN(+b[k]) && +b[k] >= 0) s[k] = +b[k];
        if (Array.isArray(b.workDays)) s.workDays = b.workDays.map(Number).filter(x => x >= 1 && x <= 7);
        if (Array.isArray(b.sellers)) s.sellers = cleanSellers(b.sellers);
        else if (Array.isArray(b.sellerCodes)) s.sellers = cleanSellers(b.sellerCodes.map(c => s.sellers.find(x => x.code === String(c).trim().toUpperCase()) || { code: c, name: c }));
        if (Array.isArray(b.pickupDates)) s.pickupDates = b.pickupDates;
        normalize(s); save(db); return send(res, 200, s);
      }
      // Provisioraportti: myynnit ja provisiot myyjittäin aikaväliltä (sopimuspäivän mukaan), perutut eivät mukana
      if (p === '/api/admin/commissions') {
        const from = u.searchParams.get('from') || '0000-01-01', to = u.searchParams.get('to') || '9999-12-31';
        const rows = {};
        for (const o of db.orders) {
          if (o.channel !== 'kotimyynti' || !o.sellerCode || o.status === 'peruttu') continue;
          const day = new Date(o.createdAt).toLocaleDateString('sv-SE', { timeZone: 'Europe/Helsinki' });
          if (day < from || day > to) continue;
          const sl = db.settings.sellers.find(x => x.code === String(o.sellerCode).toUpperCase());
          const r = rows[o.sellerCode] = rows[o.sellerCode] || { code: o.sellerCode, name: (sl && sl.name) || o.sellerName || o.sellerCode, orders: 0, carpets: 0, large: 0, medium: 0, sales: 0, commission: 0 };
          r.orders++; r.carpets += o.carpetsTotal; r.large += o.large || 0; r.medium += o.medium || 0; r.sales += o.total;
          r.commission += o.commission !== undefined ? o.commission : cap.commission(o.total, o.carpetsTotal, sl, { large: o.large || 0, medium: o.medium || 0 });
        }
        const list = Object.values(rows).map(r => ({ ...r, sales: +r.sales.toFixed(2), commission: +r.commission.toFixed(2) })).sort((a, b) => b.sales - a.sales);
        return send(res, 200, { from, to, sellers: list });
      }
      if (p === '/api/admin/capacity') {
        const sim = cap.simulate(db.orders, db.settings); const from = u.searchParams.get('from') || today(); const out = [];
        for (let i = 0; i < 28; i++) { const d = cap.addDays(from, i); const v = sim.days[d] || { pickups: 0, storage: 0 };
          const returns = withReturns().filter(o => o.status !== 'peruttu' && o.returnDate === d).reduce((a, o) => a + o.carpetsTotal, 0);
          out.push({ date: d, work: cap.isPickupDay(d, db.settings), pickups: v.pickups, storage: v.storage, returns }); }
        return send(res, 200, { days: out, settings: db.settings });
      }
      if ((m = p.match(/^\/api\/admin\/orders\/([\w-]{36})$/)) && req.method === 'PATCH') {
        const b = await body(req); const o = db.orders.find(x => x.id === m[1]); if (!o) return send(res, 404, {});
        if (['vahvistettu','noudettu','pesussa','palautettu','peruttu'].includes(b.status)) o.status = b.status;
        if (b.paid !== undefined) o.payment = b.paid ? 'maksettu' : o.payment;
        save(db); toSheets(o); return send(res, 200, o);
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
