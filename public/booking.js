// Jaettu tilauslomakelogiikka (verkkovaraus ja myyjän sopimus)
let PICK = null, RET = null, S = { priceMedium: 44, priceLarge: 54, vatPct: 25.5 }, sigPad = null;
function counts() { return { medium: Math.max(0, +$('#medium').value || 0), large: Math.max(0, +$('#large').value || 0) }; }
function carpetCount() { const c = counts(); return c.medium + c.large; }
function clampHairInput() {
  const hairEl = $('#extrasHair');
  if (!hairEl || hairEl.type === 'checkbox') return;
  const n = carpetCount();
  let v = Math.floor(Number(hairEl.value));
  if (!Number.isFinite(v) || v < 0) v = 0;
  if (v > n) v = n;
  hairEl.max = String(n);
  if (Number(hairEl.value) !== v) hairEl.value = String(v);
}
function extras() {
  const hairEl = $('#extrasHair'), odorEl = $('#extrasOdor');
  clampHairInput();
  const n = carpetCount();
  let hair = 0;
  if (hairEl) {
    if (hairEl.type === 'checkbox') hair = hairEl.checked ? Math.min(1, n) : 0;
    else {
      let v = Math.floor(Number(hairEl.value));
      if (!Number.isFinite(v) || v < 0) v = 0;
      hair = Math.min(n, v);
    }
  }
  const odor = odorEl ? (odorEl.type === 'checkbox' ? (odorEl.checked ? 1 : 0) : Math.max(0, Math.min(1, Math.floor(Number(odorEl.value)) || 0))) : 0;
  return { extrasHair: hair, extrasOdor: odor };
}
const FALLBACK_RETURN_DAYS = ['2026-11-17', '2026-11-18'];
const FALLBACK_RETURN_TIMES = ['9-11', '11-13', '13-15', '15-17'];
function returnDays() { return (Array.isArray(S.returnDays) && S.returnDays.length) ? S.returnDays : FALLBACK_RETURN_DAYS; }
function returnTimes() { return (Array.isArray(S.returnTimes) && S.returnTimes.length) ? S.returnTimes : FALLBACK_RETURN_TIMES; }
let returnFilled = false;
function syncReturnChoices() {
  const el = $('#returnDate');
  if (!el || returnFilled) return;
  returnFilled = true;
  const days = returnDays();
  el.innerHTML = days.map(d => '<option value="' + d + '">' + fmtD(d) + '</option>').join('');
  el.value = days[0];
  const time = $('#returnTime');
  if (!time) return;
  const slots = returnTimes();
  time.innerHTML = slots.map(t => '<option value="' + t + '">klo ' + t + '</option>').join('');
  time.value = slots[0];
}
function promisedReturn() {
  const el = $('#returnDate');
  if (el && /^\d{4}-\d{2}-\d{2}$/.test(el.value || '')) return el.value;
  return returnDays()[0] || '';
}
function promisedReturnTime() {
  const el = $('#returnTime');
  return el && el.value ? el.value : '';
}
function updateSum() {
  const c = counts(), x = extras();
  syncReturnChoices();
  const extrasSum = 10 * (x.extrasHair + x.extrasOdor);
  const t = c.medium * S.priceMedium + c.large * S.priceLarge + extrasSum;
  const vat = t - t / (1 + S.vatPct / 100);
  let extraLine = '';
  if (x.extrasHair || x.extrasOdor) {
    const parts = [];
    if (x.extrasHair) parts.push('karvanpoisto ' + x.extrasHair + ' × 10 € / matto');
    if (x.extrasOdor) parts.push('hajunpoisto 10 € (kaikki matot)');
    extraLine = `<br>Lisäpalvelut: ${parts.join(' + ')} = ${eur(extrasSum)}`;
  }
  const back = promisedReturn();
  const backTime = promisedReturnTime();
  const backLabel = back ? fmtD(back) + (backTime ? ' klo ' + backTime : '') : '';
  $('#sum').innerHTML = `${c.medium} × ${S.priceMedium} € + ${c.large} × ${S.priceLarge} € = <b>${eur(t - extrasSum)}</b>${extraLine}<br><b>Yhteensä ${eur(t)}</b> <small>(sis. ALV ${String(S.vatPct).replace('.', ',')} %: ${eur(vat)})</small><br>` +
   (PICK ? `Nouto: <b style="font-size:16px">${fmtD(PICK)}</b> · palautus: <b style="font-size:16px">${backLabel}</b>` : `<span class="err">Valitse noutopäivä kalenterista.</span>`);
  const sel = document.querySelector('#cal button.sel');
  if (sel && backLabel) sel.title = 'Palautus ' + backLabel;
}
let calTimer;
function refreshCal() { clearTimeout(calTimer); calTimer = setTimeout(async () => { const c = counts(), n = Math.max(1, c.medium + c.large);
  await renderCalendar($('#cal'), n, (d) => { PICK = d; updateSum(); }, PICK); updateSum(); }, 200); }
async function initBooking(initChannel) {
  S = await api('/api/public-settings'); $('#terms').innerHTML = TERMS_HTML;
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
    const i = $('#' + b.dataset.q); if (!i) return;
    let next = Math.max(0, (+i.value || 0) + (+b.dataset.s));
    if (b.dataset.q === 'extrasHair') next = Math.min(next, carpetCount());
    i.value = next;
    if (b.dataset.q === 'medium' || b.dataset.q === 'large') { clampHairInput(); PICK = null; refreshCal(); }
    else updateSum();
  });
  ['medium', 'large'].forEach(id => { const el = $('#' + id); if (el) el.oninput = () => { clampHairInput(); PICK = null; refreshCal(); }; });
  ['extrasHair', 'extrasOdor'].forEach(id => { const el = $('#' + id); if (el) el.onchange = el.oninput = () => updateSum(); });
  const retEl = $('#returnDate'); if (retEl) retEl.onchange = () => updateSum();
  const retTimeEl = $('#returnTime'); if (retTimeEl) retTimeEl.onchange = () => updateSum();
  syncReturnChoices();
  refreshCal();
  $('#f').onsubmit = async e => { e.preventDefault(); const c = counts(), x = extras(); const msg = $('#msg');
    const sellerEl = $('#sellerCode');
    const sellerVal = sellerEl ? sellerEl.value.trim() : '';
    const channel = sellerVal ? 'kotimyynti' : (initChannel || 'verkko');
    const b = { channel, ...c, ...x, pickupDate: PICK };
    for (const k of ['name','phone','email','address','postal','city','notes','pickupTime','sellerCode','returnDate','returnTime']) { const el = $('#' + k); if (el) b[k] = el.value.trim(); }
    for (const k of ['acceptTerms','startEarly','marketingConsent']) { const el = $('#' + k); b[k] = el ? !!el.checked : (k === 'acceptTerms'); }
    if (!b.acceptTerms && channel === 'verkko') b.acceptTerms = true; // piilotettu hyväksyntä verkkovarauksessa
    const pay = document.querySelector('input[name=payment]:checked'); b.payment = pay ? pay.value : 'palautus';
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
