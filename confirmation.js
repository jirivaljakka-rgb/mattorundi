/**
 * Asiakkaan tilausvahvistus sähköpostiin (teksti + HTML-runko + PDF-HTML).
 * Ei linkkiä /vahvistus-sivulle eikä myyjän toimintoja.
 * Apps Script tekee pdfHtml:sta liitteen. Katso OHJE-email.md.
 */
const { COMPANY, TERMS_HTML, CANCEL_FORM_HTML } = require('./public/terms');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function escBr(s) { return esc(s).replace(/\r\n|\n|\r/g, '<br>'); }
function oneLine(s) { return String(s ?? '').replace(/[\r\n]+/g, ' ').trim(); }

function ymd(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Helsinki' });
}
function addDaysYmd(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function fiDate(value) {
  const iso = ymd(value);
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${+d}.${+m}.${y}`;
}
function fiDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fiDate(value);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Helsinki', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(d).map(p => [p.type, p.value]));
  return `${+parts.day}.${+parts.month}.${parts.year} klo ${parts.hour}.${parts.minute}`;
}
function eur(n) {
  const v = Number(n);
  const x = Number.isFinite(v) ? v : 0;
  const neg = x < 0;
  const [a, b] = Math.abs(x).toFixed(2).split('.');
  return (neg ? '−' : '') + a.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + b + ' €';
}
function fiPct(n) { return String(n).replace('.', ','); }

// Karvanpoisto 0..mattojen määrä (10 € / matto). Hajunpoisto 0 tai 1 (10 €, kaikki matot).
function clampExtras(medium, large, hair, odor) {
  const n = Math.max(0, (parseInt(medium, 10) || 0) + (parseInt(large, 10) || 0));
  let h = parseInt(hair, 10);
  if (!Number.isFinite(h) || h < 0) h = 0;
  if (h > n) h = n;
  let o = parseInt(odor, 10);
  if (!Number.isFinite(o) || o < 0) o = 0;
  if (o > 1) o = 1;
  return { carpets: n, extrasHair: h, extrasOdor: o, extrasSum: 10 * h + 10 * o };
}

// Asiakkaalle luvattu palautus: nouto+1 … nouto+6, oletus nouto+4.
function returnWindow(pickup) {
  const iso = ymd(pickup);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const days = [];
  for (let i = 1; i <= 6; i++) days.push(addDaysYmd(iso, i));
  return { min: days[0], max: days[5], defaultDate: addDaysYmd(iso, 4), days };
}
function resolveAgreedReturn(pickup, raw) {
  const w = returnWindow(pickup);
  if (!w) return { ok: false, error: 'Noutopäivä ei kelpaa.' };
  const chosen = raw == null ? '' : String(raw).trim().slice(0, 10);
  if (!chosen) return { ok: true, date: w.defaultDate };
  if (!w.days.includes(chosen)) return { ok: false, error: 'Palautuspäivä voi olla 1–6 päivää noudon jälkeen.' };
  return { ok: true, date: chosen };
}

function customerOrder(o) {
  const priceMedium = o.priceMedium != null ? +o.priceMedium : 44;
  const priceLarge = o.priceLarge != null ? +o.priceLarge : 54;
  const medium = +o.medium || 0;
  const large = +o.large || 0;
  const extras = clampExtras(medium, large, o.extrasHair, o.extrasOdor);
  const extrasHair = extras.extrasHair;
  const extrasOdor = extras.extrasOdor;
  const lines = [];
  if (medium) lines.push({ name: 'Keskikokoinen matto (1–2,4 m²)', qty: medium, unitPrice: priceMedium, sum: +(medium * priceMedium).toFixed(2) });
  if (large) lines.push({ name: 'Iso matto (2,5–3,5 m²)', qty: large, unitPrice: priceLarge, sum: +(large * priceLarge).toFixed(2) });
  if (extrasHair) lines.push({ name: 'Karvanpoisto (per matto)', qty: extrasHair, unitPrice: 10, sum: 10 * extrasHair });
  if (extrasOdor) lines.push({ name: 'Hajunpoisto (kaikki matot)', qty: 1, unitPrice: 10, sum: 10 });
  const contractDate = ymd(o.createdAt);
  const returnDate = o.agreedReturnDate || o.returnDate || o.estReturnAtBooking || '';
  return {
    number: o.number || '',
    createdAt: o.createdAt || '',
    contractDate,
    cancelBy: contractDate ? addDaysYmd(contractDate, 14) : '',
    name: o.name || '',
    phone: o.phone || '',
    email: o.email || '',
    address: o.address || '',
    postal: o.postal || '',
    city: o.city || '',
    pickupDate: o.pickupDate || '',
    pickupTime: o.pickupTime || '',
    returnDate,
    medium, large, priceMedium, priceLarge, extrasHair, extrasOdor, lines,
    total: +o.total || 0,
    vat: o.vat != null ? +o.vat : 0,
    vatPct: o.vatPct != null ? +o.vatPct : 25.5,
    payment: o.payment || '',
    notes: o.notes || '',
    channel: o.channel === 'kotimyynti' ? 'kotimyynti' : 'verkko',
    sellerName: o.channel === 'kotimyynti' ? (o.sellerName || '') : '',
    startEarly: !!o.startEarly,
    signed: !!o.signature,
    termsVersion: o.termsVersion || ''
  };
}

function channelLabel(order) {
  if (order.channel === 'kotimyynti') return order.sellerName ? 'Kotimyynti, myyjä ' + order.sellerName : 'Kotimyynti';
  return 'Verkkovaraus';
}

function mailFacts(order) {
  const time = oneLine(order.pickupTime);
  const vatPct = order.vatPct != null && order.vatPct !== '' ? fiPct(order.vatPct) : fiPct(25.5);
  const when = fiDateTime(order.createdAt);
  return {
    name: oneLine(order.name),
    number: order.number || '',
    when: when || 'ajankohta vahvistetaan erikseen',
    pickup: fiDate(order.pickupDate) + (time ? ' ' + time : ''),
    back: fiDate(order.returnDate),
    sum: eur(order.total) + ' (sis. ALV ' + vatPct + ' %)',
    phone: COMPANY.phone,
    email: COMPANY.email
  };
}
function buildBody(order) {
  const f = mailFacts(order);
  return [
    'Hei ' + f.name + ',',
    '',
    'kiitos, että valitsit Mattorundin!',
    '',
    'Olet tehnyt tämän tilauksen ' + f.when + '.',
    '',
    'Tilausvahvistus ja ehdot ovat tämän viestin PDF-liitteessä.',
    '',
    'Sopimus: ' + f.when + '.',
    'Nouto: ' + f.pickup + '.',
    'Arvioitu palautus: ' + f.back + '.',
    'Summa: ' + f.sum + '.',
    '',
    'Jos sinulla on kysyttävää ennen noutoa, vastaa tähän viestiin tai soita ' + f.phone + '.',
    '',
    'Ystävällisin terveisin,',
    'Mattorundi / Valaja Team Osk',
    f.email + ' · ' + f.phone
  ].join('\n');
}
function buildHtmlBody(order) {
  const f = mailFacts(order);
  const row = (label, value) => '<tr><td style="padding:7px 0;color:#3d5248;font-size:13px;width:42%">' + label + '</td><td style="padding:7px 0;font-weight:700;color:#0F3B2C;font-size:16px">' + esc(value) + '</td></tr>';
  return '<!doctype html><html lang="fi"><body style="margin:0;padding:0;background:#f4f1ea">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-top:4px solid #B5CD34;border-radius:12px">' +
    '<tr><td style="background:#0F3B2C;padding:16px 22px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;letter-spacing:-.03em;color:#ffffff">Mattorundi</td></tr>' +
    '<tr><td style="padding:22px;font-family:Arial,Helvetica,sans-serif;color:#1d2a24;font-size:16px;line-height:1.5">' +
    '<p style="margin:0 0 12px">Hei ' + esc(f.name) + ',</p>' +
    '<p style="margin:0 0 12px">kiitos, että valitsit Mattorundin!</p>' +
    '<p style="margin:0 0 12px">Olet tehnyt tämän tilauksen ' + esc(f.when) + '.</p>' +
    '<p style="margin:0 0 16px">Tilausvahvistus ja ehdot ovat tämän viestin PDF-liitteessä.</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F1;border-left:4px solid #0F3B2C;margin:0 0 16px"><tr><td style="padding:4px 16px 8px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif">' +
    row('Sopimus', f.when) + row('Nouto', f.pickup) + row('Arvioitu palautus', f.back) + row('Summa', f.sum) +
    '</table></td></tr></table>' +
    '<p style="margin:0 0 16px">Jos sinulla on kysyttävää ennen noutoa, vastaa tähän viestiin tai soita ' + esc(f.phone) + '.</p>' +
    '<p style="margin:0;color:#3d5248">Ystävällisin terveisin,<br><strong style="color:#0F3B2C">Mattorundi / Valaja Team Osk</strong><br>' + esc(f.email) + ' · ' + esc(f.phone) + '</p>' +
    '</td></tr></table></td></tr></table></body></html>';
}

// Pelkkä teksti on se, minkä Gmail näyttää jos htmlBody ei renderöidy. Tyhjää viestiä ei lähetetä.
function assertOutgoingEmail(body, htmlBody) {
  const text = typeof body === 'string' ? body : '';
  const html = typeof htmlBody === 'string' ? htmlBody : '';
  const plainOk = text.trim().length >= 80 && /kiitos/i.test(text) && /PDF/.test(text) && /Sopimus:/.test(text) && /Nouto:/.test(text) && /palautus/i.test(text) && /Summa:/.test(text) && /ehdot/i.test(text);
  if (!plainOk) throw new Error('Sähköpostin teksti puuttuu tai on tyhjä.');
  const htmlOk = html.trim().length >= 80 && /kiitos/i.test(html) && /PDF/.test(html) && /Sopimus/.test(html) && /ehdot/i.test(html);
  if (!htmlOk) throw new Error('Sähköpostin HTML-teksti puuttuu tai on tyhjä.');
  return { body: text, htmlBody: html };
}

function buildPdfHtml(order) {
  const rows = order.lines.map(l =>
    `<tr><td>${esc(l.name)}</td><td class="num">${esc(l.qty)}</td><td class="num">${esc(eur(l.unitPrice))}</td><td class="num">${esc(eur(l.sum))}</td></tr>`
  ).join('');
  const safeForm = {
    number: esc(order.number),
    createdAt: order.createdAt,
    name: esc(order.name),
    address: esc(order.address),
    postal: esc(order.postal),
    city: esc(order.city)
  };
  const notes = order.notes ? `<p>Lisätiedot: ${escBr(order.notes)}</p>` : '';
  const early = order.startEarly ? '<p>Asiakas on pyytänyt palvelun aloittamista peruuttamisaikana (ks. ehtojen kohta 7).</p>' : '';
  const signed = order.signed ? '<p>Sopimus on allekirjoitettu tilaushetkellä.</p>' : '';
  return `<!doctype html><html lang="fi"><head><meta charset="utf-8"><title>Tilausvahvistus ${esc(order.number)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#1d2a24;font-size:12px;line-height:1.4;margin:24px}
  h1{font-size:20px;color:#0F3B2C;margin:0 0 4px}
  h2{font-size:15px;color:#0F3B2C;margin:18px 0 6px;border-bottom:1px solid #0F3B2C;padding-bottom:2px}
  h3{font-size:13px;color:#0F3B2C;margin:12px 0 4px}
  table{width:100%;border-collapse:collapse}
  td,th{padding:4px 6px;vertical-align:top;text-align:left}
  .brand{font-size:22px;font-weight:800;color:#0F3B2C;letter-spacing:-.03em}
  .muted{color:#5d6b64;font-size:11px}
  .lines th{background:#0F3B2C;color:#fff}
  .lines td{border-bottom:1px solid #dfe3dc}
  .num{text-align:right;white-space:nowrap}
  .box{background:#FBF8F1;border-left:4px solid #B5CD34;padding:8px 10px;margin:10px 0}
  .terms{page-break-before:always}
  .right{text-align:right}
</style></head><body>
<table><tr>
<td><div class="brand">MATTORUNDI</div><h1>Tilausvahvistus ${esc(order.number)}</h1><div class="muted">Mattojen nouto, pesu ja palautus</div></td>
<td class="right"><b>${esc(COMPANY.name)}</b><br>Perustajat: ${esc(COMPANY.founders)}<br>Y-tunnus: ${esc(COMPANY.ytunnus)}<br>${esc(COMPANY.address)}<br>${esc(COMPANY.email)} · ${esc(COMPANY.phone)}</td>
</tr></table>
<h2>Asiakas ja nouto</h2>
<table><tr>
<td style="width:50%"><b>Asiakas</b><br>${esc(order.name)}<br>${esc(order.address)}<br>${esc(order.postal)} ${esc(order.city)}<br>${esc(order.phone)}<br>${esc(order.email)}</td>
<td><b>Tilaus</b><br>Sopimuspäivä: ${esc(fiDateTime(order.createdAt))}<br>Myyntitapa: ${esc(channelLabel(order))}<br><b>Nouto: ${esc(fiDate(order.pickupDate))} ${esc(order.pickupTime)}</b><br><b>Arvioitu palautus: ${esc(order.returnDate ? fiDate(order.returnDate) : '–')}</b><br>Maksu: ${esc(order.payment)}</td>
</tr></table>
<h2>Palvelut ja hinta</h2>
<table class="lines"><tr><th>Palvelu</th><th class="num">Kpl</th><th class="num">á</th><th class="num">Yhteensä</th></tr>
${rows}
<tr><td colspan="3"><b>Yhteensä (sis. ALV ${esc(fiPct(order.vatPct))} %)</b></td><td class="num"><b>${esc(eur(order.total))}</b></td></tr>
<tr><td colspan="3">josta ALV</td><td class="num">${esc(eur(order.vat))}</td></tr>
</table>
<p>Hinta sisältää noudon, pesun, kuivauksen ja palautuksen. Keskikokoinen matto (1–2,4 m²) ${esc(eur(order.priceMedium))}, iso matto (2,5–3,5 m²) ${esc(eur(order.priceLarge))}. Karvanpoisto 10 € / matto. Hajunpoisto 10 € (koskee kaikkia mattoja). Arvioitu palautus on oletuksena 4 päivää noudosta ja viimeistään 6 päivää noudosta.</p>
${notes}
<div class="box"><b>Peruuttamisoikeus.</b> Voit peruuttaa sopimuksen ilmoittamatta syytä 14 päivän kuluessa sopimuspäivästä eli viimeistään ${esc(fiDate(order.cancelBy))}. Ilmoita sähköpostilla ${esc(COMPANY.email)} tai puhelimella ${esc(COMPANY.phone)}, tai käytä tämän vahvistuksen lopussa olevaa peruutuslomaketta.</div>
${early}${signed}
<div class="terms"><h2>Tilausehdot</h2>${TERMS_HTML}${CANCEL_FORM_HTML(safeForm)}</div>
</body></html>`;
}

function pdfFilename(number) {
  const safe = String(number || 'tilaus').replace(/[^A-Za-z0-9._-]/g, '') || 'tilaus';
  return 'Mattorundi-tilausvahvistus-' + safe + '.pdf';
}

function buildCustomerEmail(o) {
  const order = customerOrder(o);
  const message = assertOutgoingEmail(buildBody(order), buildHtmlBody(order));
  return {
    subject: 'Mattorundi tilausvahvistus ' + order.number,
    body: message.body,
    htmlBody: message.htmlBody,
    pdfHtml: buildPdfHtml(order),
    pdfFilename: pdfFilename(order.number),
    order
  };
}

module.exports = { buildCustomerEmail, customerOrder, fiDate, eur, clampExtras, resolveAgreedReturn, returnWindow, assertOutgoingEmail };
