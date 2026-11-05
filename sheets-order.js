// Sheets-getOrder → palvelimen tilaus. Snapshot (uudet rivit) voittaa sarakkeet.
// Vanha rivi kelpaa ilman snapshotia, jos siinä on tilauksen UUID.

function num(value, fallback) {
  if (value === '' || value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function truthy(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'TRUE' || value === 'kyllä';
}
function sheetTime(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}
function sheetDay(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Helsinki' });
}

function orderFromSheet(raw) {
  if (!raw || typeof raw !== 'object') return null;
  let src = raw;
  let snap = null;
  if (raw.snapshot && typeof raw.snapshot === 'object') snap = raw.snapshot;
  else if (typeof raw.snapshot === 'string' && raw.snapshot.trim()) {
    try {
      const parsed = JSON.parse(raw.snapshot);
      if (parsed && typeof parsed === 'object') snap = parsed;
    } catch { /* sarakkeet riittävät, jos Id on mukana */ }
  }
  if (snap) src = { ...raw, ...snap };
  const id = String(src.id || '').trim();
  if (!/^[\w-]{36}$/.test(id)) return null;
  const medium = Math.max(0, num(src.medium, 0));
  const large = Math.max(0, num(src.large, 0));
  const extrasHair = Math.max(0, num(src.extrasHair, 0));
  const extrasOdor = Math.max(0, num(src.extrasOdor, 0)) > 0 ? 1 : 0;
  const priceMedium = num(src.priceMedium, 44);
  const priceLarge = num(src.priceLarge, 54);
  const vatPct = num(src.vatPct, 25.5);
  const computed = medium * priceMedium + large * priceLarge + 10 * extrasHair + 10 * extrasOdor;
  const total = num(src.total, computed);
  const vat = num(src.vat, +(total - total / (1 + vatPct / 100)).toFixed(2));
  const agreed = sheetDay(src.agreedReturnDate || src.returnDate || src.estReturnAtBooking);
  const notes = src.customerNotes != null && String(src.customerNotes) !== '' ? String(src.customerNotes) : String(src.notes || '');
  const status = ['vahvistettu', 'noudettu', 'pesussa', 'palautettu', 'peruttu'].includes(src.status) ? src.status : 'vahvistettu';
  return {
    id,
    number: String(src.number || ''),
    createdAt: sheetTime(src.createdAt) || '',
    channel: src.channel === 'kotimyynti' ? 'kotimyynti' : 'verkko',
    status,
    name: String(src.name || ''),
    phone: String(src.phone || ''),
    email: String(src.email || ''),
    address: String(src.address || ''),
    postal: String(src.postal || ''),
    city: String(src.city || ''),
    notes,
    medium, large,
    carpetsTotal: Math.max(0, num(src.carpetsTotal, medium + large)),
    extrasHair, extrasOdor,
    priceMedium, priceLarge, vatPct, total, vat,
    payment: String(src.payment || ''),
    pickupDate: sheetDay(src.pickupDate),
    pickupTime: String(src.pickupTime || ''),
    returnTime: String(src.returnTime || '').slice(0, 20),
    sellerCode: src.sellerCode ? String(src.sellerCode) : null,
    sellerName: src.sellerName ? String(src.sellerName) : null,
    commission: num(src.commission, 0),
    signature: null,
    hasPhoto: false,
    termsVersion: src.termsVersion ? String(src.termsVersion) : '2026-11',
    agreedReturnDate: agreed,
    estReturnAtBooking: sheetDay(src.estReturnAtBooking) || agreed,
    startEarly: truthy(src.startEarly),
    marketingConsent: truthy(src.marketingConsent)
  };
}

const ORDER_GONE = 'Tilaus katosi palvelinpäivityksessä, eikä sitä löydy enää. Tee sopimus uudelleen.';
const ORDER_UNAVAILABLE = 'Tilausta ei saatu haettua juuri nyt. Yritä hetken päästä uudelleen.';

module.exports = { orderFromSheet, ORDER_GONE, ORDER_UNAVAILABLE };
