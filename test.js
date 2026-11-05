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
// Lisäpalvelut: karvanpoisto 10 € / matto (0..matot), hajunpoisto 10 € kerran (kaikki matot). Myyjälle +2 € / yksikkö.
const { buildCustomerEmail, clampExtras, resolveAgreedReturn } = require('./confirmation');
function orderTotal(med, lg, hair, odor, pm, pl) {
  return med * pm + lg * pl + clampExtras(med, lg, hair, odor).extrasSum;
}
function sellerCommission(med, lg, hair, odor, seller) {
  const x = clampExtras(med, lg, hair, odor);
  const total = orderTotal(med, lg, hair, odor, 44, 54);
  return +(cap.commission(total, med + lg, seller, { large: lg, medium: med }) + 2 * x.extrasHair + 2 * x.extrasOdor).toFixed(2);
}
const tot1 = orderTotal(1, 1, 1, 1, 44, 54); // 44+54+10+10 = 118
console.log('Hinta 1 keski + 1 iso + karva + haju:', tot1);
if (tot1 !== 118) { console.error('VIRHE: extras-hinnoittelu'); process.exit(1); }
const tot2 = orderTotal(2, 0, 5, 0, 44, 54); // hair clamped to carpet count 2 → 88+20=108
console.log('Hinta 2 keski + karva clamp 5→2:', tot2);
if (tot2 !== 108) { console.error('VIRHE: extras clamp'); process.exit(1); }
const tot3 = orderTotal(0, 1, 1, 1, 44, 54); // 54+10+10 = 74
console.log('Hinta 1 iso + karva + haju:', tot3);
if (tot3 !== 74) { console.error('VIRHE: extras 1 iso + molemmat'); process.exit(1); }
const totHair = orderTotal(2, 3, 5, 1, 44, 54); // 5 mattoa, karva 5 + haju: 88+162+50+10=310
console.log('Hinta 2 keski + 3 isoa + karva 5 + haju:', totHair);
if (totHair !== 310) { console.error('VIRHE: karvanpoisto qty > 1'); process.exit(1); }
const kept = clampExtras(2, 1, 3, 1);
if (kept.extrasHair !== 3 || kept.extrasOdor !== 1 || kept.extrasSum !== 40) { console.error('VIRHE: clampExtras säilyttää qty 3', kept); process.exit(1); }
const jani = { code: 'JANI669', commissionPerLarge: 20, commissionPerMedium: 16 };
const pr3 = sellerCommission(0, 1, 1, 1, jani); // 20 + 2 + 2 = 24
console.log('Provisio JANI 1 iso + karva + haju:', pr3);
if (pr3 !== 24) { console.error('VIRHE: extras-provisio'); process.exit(1); }
const prHair = sellerCommission(2, 1, 3, 1, jani); // 16*2 + 20 + 2*3 + 2 = 60
console.log('Provisio JANI 2 keski + 1 iso + karva 3 + haju:', prHair);
if (prHair !== 60) { console.error('VIRHE: provisio +2 per karva ja haju'); process.exit(1); }
const retDef = resolveAgreedReturn('2026-11-11', '');
const retMax = resolveAgreedReturn('2026-11-11', '2026-11-17');
const retSame = resolveAgreedReturn('2026-11-11', '2026-11-11');
const retLate = resolveAgreedReturn('2026-11-11', '2026-11-18');
if (!retDef.ok || retDef.date !== '2026-11-15') { console.error('VIRHE: palautusoletus +4', retDef); process.exit(1); }
if (!retMax.ok || retMax.date !== '2026-11-17') { console.error('VIRHE: palautus max +6', retMax); process.exit(1); }
if (retSame.ok || retLate.ok) { console.error('VIRHE: palautus ikkunan ulkopuolella meni läpi'); process.exit(1); }
console.log('Extras- ja palautustestit OK');

// Asiakasviesti: ei /vahvistus-linkkiä, PDF-HTML ja rakenteinen tilaus ilman provisiota
const sample = {
  number: 'MR-2026-0007', createdAt: '2026-11-05T08:15:00.000Z', channel: 'verkko', status: 'vahvistettu',
  name: 'Maija <Test>', phone: '0401234567', email: 'maija@example.com', address: 'Testikatu 1', postal: '33100', city: 'Tampere',
  notes: 'Ovikoodi 1234 & raput', medium: 1, large: 1, extrasHair: 1, extrasOdor: 0,
  priceMedium: 44, priceLarge: 54, vatPct: 25.5, total: 108, vat: 21.94,
  payment: 'palautuksen yhteydessä', pickupDate: '2026-11-11', pickupTime: '9–11',
  returnDate: '2026-11-16', commission: 99, sellerCode: 'JANI669', sellerName: 'Jani', signature: null, termsVersion: '2026-11'
};
const mail = buildCustomerEmail(sample);
if (/https?:\/\/|\/vahvistus|onrender\.com/i.test(mail.body) || /https?:\/\/|\/vahvistus|onrender\.com/i.test(mail.htmlBody || '')) { console.error('VIRHE: sähköpostissa on URL'); process.exit(1); }
for (const bit of ['kiitos, että valitsit', 'PDF', '11.11.2026', '16.11.2026', '108,00 €', 'Maija <Test>', 'Arvioitu palautus']) {
  if (!mail.body.includes(bit)) { console.error('VIRHE: tekstistä puuttuu', bit); process.exit(1); }
}
if (!mail.htmlBody || /<img/i.test(mail.htmlBody)) { console.error('VIRHE: htmlBody puuttuu tai sisältää kuvan'); process.exit(1); }
for (const bit of ['kiitos, että valitsit', 'PDF', 'Nouto', 'Arvioitu palautus', 'Summa', '11.11.2026', '16.11.2026', '108,00 €', 'Maija &lt;Test&gt;', 'Ystävällisin terveisin']) {
  if (!mail.htmlBody.includes(bit)) { console.error('VIRHE: htmlBody:sta puuttuu', bit); process.exit(1); }
}
if (mail.body.includes('koko tilaus') || mail.htmlBody.includes('koko tilaus') || mail.pdfHtml.includes('koko tilaus')) { console.error('VIRHE: vanha "koko tilaus" -teksti'); process.exit(1); }
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
const hairLine = mail.order.lines.find(l => l.name === 'Karvanpoisto (per matto)');
if (!hairLine || hairLine.qty !== 1 || hairLine.unitPrice !== 10 || hairLine.sum !== 10) { console.error('VIRHE: PDF-rivi karvanpoisto', hairLine); process.exit(1); }
const many = buildCustomerEmail({ ...sample, medium: 2, large: 3, extrasHair: 5, extrasOdor: 1, total: 310, agreedReturnDate: '2026-11-17' });
const manyHair = many.order.lines.find(l => l.name === 'Karvanpoisto (per matto)');
const manyOdor = many.order.lines.find(l => l.name === 'Hajunpoisto (kaikki matot)');
if (!manyHair || manyHair.qty !== 5 || manyHair.unitPrice !== 10 || manyHair.sum !== 50) { console.error('VIRHE: karva qty PDF', manyHair); process.exit(1); }
if (!manyOdor || manyOdor.qty !== 1 || manyOdor.unitPrice !== 10 || manyOdor.sum !== 10) { console.error('VIRHE: haju PDF', manyOdor); process.exit(1); }
if (many.order.returnDate !== '2026-11-17' || !many.body.includes('17.11.2026') || !many.htmlBody.includes('17.11.2026') || !many.pdfHtml.includes('17.11.2026')) { console.error('VIRHE: sovittu palautus ei näy'); process.exit(1); }
if (!many.pdfHtml.includes('Karvanpoisto (per matto)') || !many.pdfHtml.includes('Hajunpoisto (kaikki matot)')) { console.error('VIRHE: pdfHtml-rivien nimet'); process.exit(1); }
console.log('Asiakasviesti OK (ei URL:ää, htmlBody + pdfHtml, ei provisiota)');

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
      pickupDate: '2026-11-11', pickupTime: '9–11', returnDate: '2026-11-12', medium: 1, large: 1, extrasHair: 1, extrasOdor: 0, acceptTerms: true, notes: 'Ovikoodi 1234'
    })});
    const created = await orderRes.json();
    if (orderRes.status !== 201 || !created.id) throw new Error('tilauksen luonti ' + orderRes.status + ' ' + JSON.stringify(created));
    const t1 = Date.now();
    while (!posts.some(p => !p.action && p.order) && Date.now() - t1 < 3000) await new Promise(r => setTimeout(r, 40));
    const sync = posts.find(p => !p.action && p.order);
    if (!sync || sync.secret !== 'test-secret' || sync.order.commission == null || sync.order.number == null) throw new Error('Sheets-kirjaus rikki: ' + JSON.stringify(sync));
    if (sync.pdfHtml || sync.action) throw new Error('Sheets-kirjaus sai sähköpostikenttiä');
    if (sync.order.returnDate !== '2026-11-15' || !sync.order.notes.includes('Palautus 15.11.2026') || !sync.order.notes.includes('Karvanpoisto 1 kpl') || sync.order.notes.includes('koko tilaus')) throw new Error('Sheets-huomio: ' + sync.order.notes + ' / ' + sync.order.returnDate);
    const pub = await (await fetch('http://127.0.0.1:' + appPort + '/api/orders/' + created.id)).json();
    if (pub.returnDate !== '2026-11-15' || pub.extrasHair !== 1) throw new Error('verkon tilaus ' + JSON.stringify({ returnDate: pub.returnDate, extrasHair: pub.extrasHair }));
    const emailRes = await fetch('http://127.0.0.1:' + appPort + '/api/orders/' + created.id + '/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const emailJson = await emailRes.json();
    if (emailRes.status !== 200 || emailJson.ok !== true) throw new Error('email ' + emailRes.status + ' ' + JSON.stringify(emailJson) + ' log ' + log);
    const sent = posts.find(p => p.action === 'email');
    if (!sent) throw new Error('email-webhook puuttuu');
    const keys = Object.keys(sent).sort().join(',');
    if (keys !== 'action,body,htmlBody,order,pdfFilename,pdfHtml,secret,subject,to') throw new Error('email-kentät: ' + keys);
    if (sent.secret !== 'test-secret' || sent.to !== 'maija@example.com') throw new Error('email osoite/secret');
    if (/https?:\/\/|\/vahvistus/i.test(sent.body) || /https?:\/\/|\/vahvistus/i.test(sent.htmlBody || '')) throw new Error('webhook-viesti sisältää URL:n');
    if (!sent.body.includes('kiitos, että valitsit') || !sent.body.includes('PDF') || !sent.body.includes('15.11.2026') || !sent.htmlBody.includes('kiitos, että valitsit') || !sent.pdfHtml.includes('Peruuttamisoikeus') || sent.order.returnDate !== '2026-11-15') throw new Error('email sisältö puutteellinen');
    if ('commission' in sent.order) throw new Error('email order sisältää provision');
    if (!/^Mattorundi-tilausvahvistus-MR-.*\.pdf$/.test(sent.pdfFilename)) throw new Error('pdfFilename ' + sent.pdfFilename);
    const page = await fetch('http://127.0.0.1:' + appPort + '/vahvistus?id=' + created.id);
    const html = await page.text();
    if (html.includes('Kopioi linkki asiakkaalle') || html.includes('koko tilaus') || !html.includes('PDF-liitteenä') || !html.includes('Lähetä sähköpostilla') || !html.includes('Karvanpoisto (per matto)') || !html.includes('Hajunpoisto (kaikki matot)')) throw new Error('vahvistussivun tekstit');
    const sellerRes = await fetch('http://127.0.0.1:' + appPort + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      channel: 'kotimyynti', sellerCode: 'JANI669', name: 'Matti Myynti', phone: '0409999999', email: 'matti@example.com', address: 'Myyntikatu 2',
      pickupDate: '2026-11-12', returnDate: '2026-11-18', medium: 2, large: 1, extrasHair: 3, extrasOdor: 1, acceptTerms: true
    })});
    const sellerCreated = await sellerRes.json();
    if (sellerRes.status !== 201) throw new Error('myyjätilaus ' + sellerRes.status + ' ' + JSON.stringify(sellerCreated));
    const sellerPub = await (await fetch('http://127.0.0.1:' + appPort + '/api/orders/' + sellerCreated.id)).json();
    if (sellerPub.returnDate !== '2026-11-18' || sellerPub.extrasHair !== 3 || sellerPub.extrasOdor !== 1 || sellerPub.total !== 182) throw new Error('myyjätilauksen kentät ' + JSON.stringify({ returnDate: sellerPub.returnDate, extrasHair: sellerPub.extrasHair, total: sellerPub.total }));
    const tSale = Date.now();
    while (!posts.some(p => p.order && p.order.extrasHair === 3) && Date.now() - tSale < 3000) await new Promise(r => setTimeout(r, 40));
    const saleSync = posts.find(p => p.order && p.order.extrasHair === 3);
    if (!saleSync || saleSync.order.commission !== 60 || saleSync.order.returnDate !== '2026-11-18' || !saleSync.order.notes.includes('Karvanpoisto 3 kpl') || !saleSync.order.notes.includes('Hajunpoisto (kaikki matot)') || !saleSync.order.notes.includes('Palautus 18.11.2026')) throw new Error('myyjän sheets ' + JSON.stringify(saleSync && saleSync.order));
    const clampRes = await fetch('http://127.0.0.1:' + appPort + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      channel: 'kotimyynti', sellerCode: 'JANI669', name: 'Clamp Test', phone: '0401111111', address: 'Clampkatu 1',
      pickupDate: '2026-11-13', medium: 2, large: 0, extrasHair: 5, extrasOdor: 0, acceptTerms: true
    })});
    const clampCreated = await clampRes.json();
    if (clampRes.status !== 201) throw new Error('clamp-tilaus ' + clampRes.status + ' ' + JSON.stringify(clampCreated));
    const clampPub = await (await fetch('http://127.0.0.1:' + appPort + '/api/orders/' + clampCreated.id)).json();
    if (clampPub.extrasHair !== 2 || clampPub.total !== 108 || clampPub.returnDate !== '2026-11-17') throw new Error('clamp/palautusoletus ' + JSON.stringify({ extrasHair: clampPub.extrasHair, total: clampPub.total, returnDate: clampPub.returnDate }));
    const badRes = await fetch('http://127.0.0.1:' + appPort + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      channel: 'kotimyynti', sellerCode: 'JANI669', name: 'Liian Myöhään', phone: '0402222222', address: 'Myohakatu 1',
      pickupDate: '2026-11-14', returnDate: '2026-11-22', medium: 1, large: 0, acceptTerms: true
    })});
    if (badRes.status !== 400) throw new Error('liian myöhäinen palautus meni läpi ' + badRes.status);
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
