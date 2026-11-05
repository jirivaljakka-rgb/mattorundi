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
let returnFor = null;
function syncReturnChoices() {
  const el = $('#returnDate');
  if (!el) return;
  if (!PICK) { el.innerHTML = '<option value="">Valitse ensin noutopäivä</option>'; returnFor = null; return; }
  if (returnFor === PICK && el.value) return;
  returnFor = PICK;
  const opts = [];
  for (let i = 1; i <= 6; i++) { const d = addDaysISO(PICK, i); opts.push('<option value="' + d + '">' + fmtD(d) + (i === 4 ? ' (oletus, 4 pv)' : '') + '</option>'); }
  el.innerHTML = opts.join('');
  el.value = addDaysISO(PICK, 4);
}
function promisedReturn() {
  const el = $('#returnDate');
  if (el && /^\d{4}-\d{2}-\d{2}$/.test(el.value || '')) return el.value;
  return PICK ? addDaysISO(PICK, 4) : (RET || '');
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
  $('#sum').innerHTML = `${c.medium} × ${S.priceMedium} € + ${c.large} × ${S.priceLarge} € = <b>${eur(t - extrasSum)}</b>${extraLine}<br><b>Yhteensä ${eur(t)}</b> <small>(sis. ALV ${String(S.vatPct).replace('.', ',')} %: ${eur(vat)})</small><br>` +
   (PICK ? `Nouto: <b style="font-size:16px">${fmtD(PICK)}</b> · arvioitu palautus: <b style="font-size:16px">${fmtD(back)}</b>` : `<span class="err">Valitse noutopäivä kalenterista.</span>`);
  const sel = document.querySelector('#cal button.sel');
  if (sel && back) sel.title = 'Arvioitu palautus ' + fmtD(back);
}
let calTimer;
function refreshCal() { clearTimeout(calTimer); calTimer = setTimeout(async () => { const c = counts(), n = Math.max(1, c.medium + c.large);
  await renderCalendar($('#cal'), n, (d, r) => { PICK = d; RET = r; updateSum(); }, PICK); updateSum(); }, 200); }
async function initBooking(initChannel) {
  S = await api('/api/public-settings'); $('#terms').innerHTML = TERMS_HTML;
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
    const i = $('#' + b.dataset.q); if (!i) return;
    let next = Math.max(0, (+i.value || 0) + (+b.dataset.s));
    if (b.dataset.q === 'extrasHair') next = Math.min(next, carpetCount());
    i.value = next;
    if (b.dataset.q === 'medium' || b.dataset.q === 'large') { clampHairInput(); PICK = null; returnFor = null; refreshCal(); }
    else updateSum();
  });
  ['medium', 'large'].forEach(id => { const el = $('#' + id); if (el) el.oninput = () => { clampHairInput(); PICK = null; returnFor = null; refreshCal(); }; });
  ['extrasHair', 'extrasOdor'].forEach(id => { const el = $('#' + id); if (el) el.onchange = el.oninput = () => updateSum(); });
  const retEl = $('#returnDate'); if (retEl) retEl.onchange = () => updateSum();
  refreshCal();
  $('#f').onsubmit = async e => { e.preventDefault(); const c = counts(), x = extras(); const msg = $('#msg');
    const sellerEl = $('#sellerCode');
    const sellerVal = sellerEl ? sellerEl.value.trim() : '';
    const channel = sellerVal ? 'kotimyynti' : (initChannel || 'verkko');
    const b = { channel, ...c, ...x, pickupDate: PICK };
    for (const k of ['name','phone','email','address','postal','city','notes','pickupTime','sellerCode','returnDate']) { const el = $('#' + k); if (el) b[k] = el.value.trim(); }
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
