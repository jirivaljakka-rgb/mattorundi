const cap = require('./capacity'); const st = { maxPickupPerDay: 24, storageCapacity: 50, turnaroundDays: 3, washPerDay: 6, workDays: [1,2,3,4,5] };
const orders = []; let i = 0;
const MON = '2026-11-09', TUE = '2026-11-10';
for (let k = 0; k < 4; k++) { const c = cap.check(orders, st, MON, 6, '2026-11-03'); console.log('Ma asiakas', k+1, '6 mattoa ->', c.ok ? 'OK palautus ' + c.returnDate : 'EI: ' + c.reason); if (c.ok) orders.push({ id: 'm'+k, pickupDate: MON, carpetsTotal: 6, createdAt: String(i++) }); }
for (let k = 0; k < 3; k++) { const c = cap.check(orders, st, TUE, 8, '2026-11-03'); console.log('Ti asiakas', k+1, '8 mattoa ->', c.ok ? 'OK palautus ' + c.returnDate : 'EI: ' + c.reason); if (c.ok) orders.push({ id: 't'+k, pickupDate: TUE, carpetsTotal: 8, createdAt: String(i++) }); }
const sim = cap.simulate(orders, st); console.log('Palautukset:', sim.returns);
console.log('Varasto/pv:', Object.entries(sim.days).map(([d,v]) => d.slice(5)+':'+v.storage).join(' '));
for (const n of [1, 3, 10]) console.log('Uusi asiakas', n, 'mattoa:', cap.calendar(orders, st, '2026-11-09', 14, n, '2026-11-03').map(d => d.date.slice(5) + (d.ok ? '✓→' + d.returnDate.slice(5) : '✗')).join(' '));

// Kiinteät noutopäivät (hallin vuokrakausi): vain listatut päivät auki, myös viikonloppu
const fixed = { ...st, pickupDates: ['2026-11-13', '2026-11-14', '2026-11-16'] };
const fx = cap.calendar([], fixed, '2026-11-09', 14, 2, '2026-11-03').filter(d => d.ok).map(d => d.date);
console.log('Kiinteät noutopäivät auki:', fx.join(', '));
if (fx.join() !== '2026-11-13,2026-11-14,2026-11-16') { console.error('VIRHE: kiinteät noutopäivät'); process.exit(1); }
// Provisio: 10 % + 2 €/matto, tilaus 88 € ja 2 mattoa -> 12,80 €
const pr = cap.commission(88, 2, { commissionPct: 10, commissionPerCarpet: 2 });
console.log('Provisio 88 € / 2 mattoa (10 % + 2 €/matto):', pr);
if (pr !== 12.8) { console.error('VIRHE: provisiolaskenta'); process.exit(1); }
// Provisio iso/keski: MYYJA1669 (20 €/iso, 16 €/keski) myy 2 isoa + 1 keski -> 56 €
const m1 = { code: 'MYYJA1669', commissionPerLarge: 20, commissionPerMedium: 16 };
const pr2 = cap.commission(2 * 49 + 39, 3, m1, { large: 2, medium: 1 });
console.log('Provisio MYYJA1669 2 isoa + 1 keski:', pr2);
if (pr2 !== 56) { console.error('VIRHE: iso/keski-provisio'); process.exit(1); }
// Lisäpalvelut: karvanpoisto / hajunpoisto 10 € / tilaus (0|1), myyjälle +2 € / valittu extra
function orderTotal(med, lg, hair, odor, pm, pl) {
  hair = Math.max(0, Math.min(1, hair|0));
  odor = Math.max(0, Math.min(1, odor|0));
  return med * pm + lg * pl + 10 * hair + 10 * odor;
}
function sellerCommission(med, lg, hair, odor, seller) {
  hair = Math.max(0, Math.min(1, hair|0));
  odor = Math.max(0, Math.min(1, odor|0));
  const total = orderTotal(med, lg, hair, odor, 44, 54);
  return +(cap.commission(total, med + lg, seller, { large: lg, medium: med }) + 2 * (hair + odor)).toFixed(2);
}
const tot1 = orderTotal(1, 1, 1, 1, 44, 54); // 44+54+10+10 = 118
console.log('Hinta 1 keski + 1 iso + karva + haju:', tot1);
if (tot1 !== 118) { console.error('VIRHE: extras-hinnoittelu'); process.exit(1); }
const tot2 = orderTotal(2, 0, 5, 0, 44, 54); // hair clamped to 1 → 88+10=98
console.log('Hinta 2 keski + karva clamp 5→1:', tot2);
if (tot2 !== 98) { console.error('VIRHE: extras clamp'); process.exit(1); }
const tot3 = orderTotal(0, 1, 1, 1, 44, 54); // 54+10+10 = 74
console.log('Hinta 1 iso + karva + haju:', tot3);
if (tot3 !== 74) { console.error('VIRHE: extras 1 iso + molemmat'); process.exit(1); }
const jani = { code: 'JANI669', commissionPerLarge: 20, commissionPerMedium: 16 };
const pr3 = sellerCommission(0, 1, 1, 1, jani); // 20 + 2 + 2 = 24
console.log('Provisio JANI 1 iso + karva + haju:', pr3);
if (pr3 !== 24) { console.error('VIRHE: extras-provisio'); process.exit(1); }
console.log('Extras-testit OK');

// Asiakasviesti: ei /vahvistus-linkkiä, PDF-HTML ja rakenteinen tilaus ilman provisiota
const { buildCustomerEmail } = require('./confirmation');
const sample = {
  number: 'MR-2026-0007', createdAt: '2026-11-05T08:15:00.000Z', channel: 'verkko', status: 'vahvistettu',
  name: 'Maija <Test>', phone: '0401234567', email: 'maija@example.com', address: 'Testikatu 1', postal: '33100', city: 'Tampere',
  notes: 'Ovikoodi 1234 & raput', medium: 1, large: 1, extrasHair: 1, extrasOdor: 0,
  priceMedium: 44, priceLarge: 54, vatPct: 25.5, total: 108, vat: 21.94,
  payment: 'palautuksen yhteydessä', pickupDate: '2026-11-11', pickupTime: '9–11',
  returnDate: '2026-11-16', commission: 99, sellerCode: 'JANI669', sellerName: 'Jani', signature: null, termsVersion: '2026-11'
};
const mail = buildCustomerEmail(sample);
if (/https?:\/\/|\/vahvistus|onrender\.com/i.test(mail.body)) { console.error('VIRHE: sähköpostin tekstissä on URL'); process.exit(1); }
for (const bit of ['kiitos tilauksesta', '11.11.2026', '16.11.2026', '108,00 €', 'Maija <Test>']) {
  if (!mail.body.includes(bit)) { console.error('VIRHE: tekstistä puuttuu', bit); process.exit(1); }
}
if (mail.pdfFilename !== 'Mattorundi-tilausvahvistus-MR-2026-0007.pdf') { console.error('VIRHE: pdf-tiedostonimi', mail.pdfFilename); process.exit(1); }
for (const bit of ['Valaja Team Osk', '3529504-8', 'Kuntokatu 3 C', 'mattorundi@gmail.com', '040 41 08581', 'Maija &lt;Test&gt;', 'Testikatu 1', '11.11.2026', '16.11.2026', 'Keskikokoinen matto', 'Iso matto', 'Karvanpoisto', '108,00 €', 'ALV', 'palautuksen yhteydessä', 'Peruuttamisoikeus', 'Tilausehdot', 'Peruutuslomake', 'Ovikoodi 1234 &amp; raput']) {
  if (!mail.pdfHtml.includes(bit)) { console.error('VIRHE: pdfHtml:sta puuttuu', bit); process.exit(1); }
}
for (const bad of ['Kopioi linkki', 'Lähetä sähköpostilla', 'Tulosta / tallenna', '/vahvistus', 'Provisio', 'JANI669']) {
  if (mail.pdfHtml.includes(bad)) { console.error('VIRHE: pdfHtml sisältää myyjän näkymän', bad); process.exit(1); }
}
if ('commission' in mail.order || mail.order.returnDate !== '2026-11-16' || mail.order.lines.length !== 3) {
  console.error('VIRHE: order-kentät', mail.order); process.exit(1);
}
if (mail.order.cancelBy !== '2026-11-19') { console.error('VIRHE: peruutuspäivä', mail.order.cancelBy); process.exit(1); }
console.log('Asiakasviesti OK (ei URL:ää, pdfHtml + order.returnDate, ei provisiota)');

const http = require('http');
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = http.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(e => e ? reject(e) : resolve(p)); });
  });
}
(async () => {
  const hookPort = await freePort();
  const appPort = await freePort();
  const posts = [];
  const hook = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/hook') {
      let b = '';
      req.on('data', c => { b += c; });
      req.on('end', () => {
        let json = {};
        try { json = JSON.parse(b); } catch { json = { parseError: true }; }
        posts.push(json);
        if (json.action === 'email') {
          res.writeHead(302, { Location: 'http://127.0.0.1:' + hookPort + '/done' });
          return res.end();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      return;
    }
    if (req.url === '/done') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{"ok":true}');
    }
    res.writeHead(404); res.end();
  });
  await new Promise(r => hook.listen(hookPort, '127.0.0.1', r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(appPort), DATA_FILE: path.join(dir, 'db.json'), SHEETS_WEBHOOK_URL: 'http://127.0.0.1:' + hookPort + '/hook', SHEETS_SECRET: 'test-secret', PUBLIC_BASE_URL: 'https://example.test' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  const kill = () => { try { child.kill(); } catch {} hook.close(); };
  try {
    const t0 = Date.now();
    while (!log.includes('Mattorundi') && Date.now() - t0 < 8000) await new Promise(r => setTimeout(r, 40));
    if (!log.includes('Mattorundi')) throw new Error('palvelin ei käynnistynyt: ' + log);
    const orderRes = await fetch('http://127.0.0.1:' + appPort + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      name: 'Maija <Test>', phone: '0401234567', email: 'maija@example.com', address: 'Testikatu 1', postal: '33100', city: 'Tampere',
      pickupDate: '2026-11-11', pickupTime: '9–11', medium: 1, large: 1, extrasHair: 1, extrasOdor: 0, acceptTerms: true, notes: 'Ovikoodi 1234'
    })});
    const created = await orderRes.json();
    if (orderRes.status !== 201 || !created.id) throw new Error('tilauksen luonti ' + orderRes.status + ' ' + JSON.stringify(created));
    const t1 = Date.now();
    while (!posts.some(p => !p.action && p.order) && Date.now() - t1 < 3000) await new Promise(r => setTimeout(r, 40));
    const sync = posts.find(p => !p.action && p.order);
    if (!sync || sync.secret !== 'test-secret' || sync.order.commission == null || sync.order.number == null) throw new Error('Sheets-kirjaus rikki: ' + JSON.stringify(sync));
    if (sync.pdfHtml || sync.action) throw new Error('Sheets-kirjaus sai sähköpostikenttiä');
    const emailRes = await fetch('http://127.0.0.1:' + appPort + '/api/orders/' + created.id + '/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const emailJson = await emailRes.json();
    if (emailRes.status !== 200 || emailJson.ok !== true) throw new Error('email ' + emailRes.status + ' ' + JSON.stringify(emailJson) + ' log ' + log);
    const sent = posts.find(p => p.action === 'email');
    if (!sent) throw new Error('email-webhook puuttuu');
    const keys = Object.keys(sent).sort().join(',');
    if (keys !== 'action,body,order,pdfFilename,pdfHtml,secret,subject,to') throw new Error('email-kentät: ' + keys);
    if (sent.secret !== 'test-secret' || sent.to !== 'maija@example.com') throw new Error('email osoite/secret');
    if (/https?:\/\/|\/vahvistus/i.test(sent.body)) throw new Error('webhook-body sisältää URL:n: ' + sent.body);
    if (!sent.body.includes('11.11.2026') || !sent.pdfHtml.includes('Peruuttamisoikeus') || !sent.order.returnDate) throw new Error('email sisältö puutteellinen');
    if ('commission' in sent.order) throw new Error('email order sisältää provision');
    if (!/^Mattorundi-tilausvahvistus-MR-.*\.pdf$/.test(sent.pdfFilename)) throw new Error('pdfFilename ' + sent.pdfFilename);
    const page = await fetch('http://127.0.0.1:' + appPort + '/vahvistus?id=' + created.id);
    const html = await page.text();
    if (html.includes('Kopioi linkki asiakkaalle') || !html.includes('PDF-liitteenä') || !html.includes('Lähetä sähköpostilla')) throw new Error('vahvistussivun tekstit');
    console.log('Webhook-email OK, kentät:', keys);
    console.log('Kaikki testit OK');
  } catch (e) {
    console.error('VIRHE:', e.message);
    process.exitCode = 1;
  } finally {
    kill();
    setTimeout(() => process.exit(process.exitCode || 0), 50);
  }
})();
