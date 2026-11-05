// Jaettu tilauslomakelogiikka (verkkovaraus ja myyjän sopimus)
let PICK = null, RET = null, S = { priceMedium: 44, priceLarge: 54, vatPct: 25.5 }, sigPad = null;
function counts() { return { medium: Math.max(0, +$('#medium').value || 0), large: Math.max(0, +$('#large').value || 0) }; }
function extras() {
  const max = counts().medium + counts().large;
  const hairEl = $('#extrasHair'), odorEl = $('#extrasOdor');
  let hair = hairEl ? Math.max(0, +hairEl.value || 0) : 0;
  let odor = odorEl ? Math.max(0, +odorEl.value || 0) : 0;
  if (hair > max) { hair = max; if (hairEl) hairEl.value = hair; }
  if (odor > max) { odor = max; if (odorEl) odorEl.value = odor; }
  return { extrasHair: hair, extrasOdor: odor };
}
function updateSum() {
  const c = counts(), x = extras(), n = c.medium + c.large;
  const extrasSum = 2 * (x.extrasHair + x.extrasOdor);
  const t = c.medium * S.priceMedium + c.large * S.priceLarge + extrasSum;
  const vat = t - t / (1 + S.vatPct / 100);
  let extraLine = '';
  if (x.extrasHair || x.extrasOdor) {
    const parts = [];
    if (x.extrasHair) parts.push(`karvanpoisto ${x.extrasHair} × 2 €`);
    if (x.extrasOdor) parts.push(`hajunpoisto ${x.extrasOdor} × 2 €`);
    extraLine = `<br>Lisäpalvelut: ${parts.join(' + ')} = ${eur(extrasSum)}`;
  }
  $('#sum').innerHTML = `${c.medium} × ${S.priceMedium} € + ${c.large} × ${S.priceLarge} € = <b>${eur(t - extrasSum)}</b>${extraLine}<br><b>Yhteensä ${eur(t)}</b> <small>(sis. ALV ${String(S.vatPct).replace('.', ',')} %: ${eur(vat)})</small><br>` +
   (PICK ? `Nouto: <b style="font-size:16px">${fmtD(PICK)}</b> · arvioitu palautus: <b style="font-size:16px">${fmtD(RET)}</b>` : `<span class="err">Valitse noutopäivä kalenterista.</span>`);
}
let calTimer;
function refreshCal() { clearTimeout(calTimer); calTimer = setTimeout(async () => { const c = counts(), n = Math.max(1, c.medium + c.large);
  await renderCalendar($('#cal'), n, (d, r) => { PICK = d; RET = r; updateSum(); }, PICK); updateSum(); }, 200); }
async function initBooking(initChannel) {
  S = await api('/api/public-settings'); $('#terms').innerHTML = TERMS_HTML;
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
    const i = $('#' + b.dataset.q); if (!i) return;
    i.value = Math.max(0, (+i.value || 0) + (+b.dataset.s));
    if (b.dataset.q === 'medium' || b.dataset.q === 'large') { PICK = null; refreshCal(); }
    else updateSum();
  });
  ['medium', 'large'].forEach(id => { const el = $('#' + id); if (el) el.oninput = () => { PICK = null; refreshCal(); }; });
  ['extrasHair', 'extrasOdor'].forEach(id => { const el = $('#' + id); if (el) el.oninput = () => updateSum(); });
  refreshCal();
  $('#f').onsubmit = async e => { e.preventDefault(); const c = counts(), x = extras(); const msg = $('#msg');
    const sellerEl = $('#sellerCode');
    const sellerVal = sellerEl ? sellerEl.value.trim() : '';
    const channel = sellerVal ? 'kotimyynti' : (initChannel || 'verkko');
    const b = { channel, ...c, ...x, pickupDate: PICK };
    for (const k of ['name','phone','email','address','postal','city','notes','pickupTime','sellerCode']) { const el = $('#' + k); if (el) b[k] = el.value.trim(); }
    for (const k of ['acceptTerms','startEarly','marketingConsent']) { const el = $('#' + k); b[k] = el ? !!el.checked : (k === 'acceptTerms'); }
    if (!b.acceptTerms && channel === 'verkko') b.acceptTerms = true; // piilotettu hyväksyntä verkkovarauksessa
    const pay = document.querySelector('input[name=payment]:checked'); b.payment = pay ? pay.value : 'palautus';
    if (channel === 'kotimyynti' && window.PHOTO) b.photo = window.PHOTO;
    if (!PICK) { msg.innerHTML = '<span class="err">Valitse noutopäivä.</span>'; return; }
    if (!b.acceptTerms) { msg.innerHTML = '<span class="err">Hyväksy tilausehdot / vahvista paperisopimus.</span>'; return; }
    $('#go').disabled = true; msg.textContent = 'Tallennetaan…';
    try { const r = await api('/api/orders', { method: 'POST', body: JSON.stringify(b) }); location.href = '/vahvistus?id=' + r.id; }
    catch (err) { msg.innerHTML = '<span class="err">' + err.message + '</span>'; $('#go').disabled = false; PICK = null; refreshCal(); } };
}
function initSignature(canvas) { const ctx = canvas.getContext('2d'); const pad = { canvas, empty: true };
  const fit = () => { const r = canvas.getBoundingClientRect(); canvas.width = r.width * 2; canvas.height = r.height * 2; ctx.scale(2, 2); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = '#0D1B2A'; pad.empty = true; };
  fit(); let draw = false;
  const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', e => { draw = true; canvas.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); });
  canvas.addEventListener('pointermove', e => { if (!draw) return; ctx.lineTo(...pos(e)); ctx.stroke(); pad.empty = false; });
  canvas.addEventListener('pointerup', () => draw = false);
  pad.clear = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); pad.empty = true; };
  return pad; }

// Pienentää valokuvan (max 1800 px, JPEG) ennen lähetystä
function readPhoto(file) { return new Promise((ok, no) => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1800 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.82)); }; img.onerror = no; img.src = URL.createObjectURL(file); }); }
