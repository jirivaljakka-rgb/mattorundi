const $ = s => document.querySelector(s);
const fmtD = s => { if (!s) return '–'; const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }); };
const eur = n => n.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
async function api(url, opt = {}) { const r = await fetch(url, { ...opt, headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) } }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Virhe ' + r.status); return j; }
// Kalenteri: näyttää 6 viikkoa, sulkee täydet päivät, ehdottaa seuraavaa vapaata
async function renderCalendar(el, n, onPick, selected) {
  el.innerHTML = '<p>Ladataan kalenteria…</p>';
  const now = new Date(); const dow = (now.getDay() + 6) % 7; const mon = new Date(now); mon.setDate(now.getDate() - dow);
  const from = mon.toLocaleDateString('sv-SE');
  const { days, nextFree } = await api(`/api/calendar?n=${n}&from=${from}&days=42`);
  let h = '<div class="cal">' + ['ma','ti','ke','to','pe','la','su'].map(x => `<div class="h">${x}</div>`).join('');
  for (const d of days) { const dd = new Date(d.date + 'T00:00:00');
    const lbl = `${dd.getDate()}.${dd.getMonth() + 1}.`;
    h += d.ok ? `<button type="button" class="free ${selected === d.date ? 'sel' : ''}" data-d="${d.date}" data-r="${d.returnDate}" title="Arvioitu palautus ${fmtD(d.returnDate)}">${lbl}<small>vapaa</small></button>`
      : `<button type="button" class="closed" disabled title="${d.reason}">${lbl}<small>${d.reason === 'ei työpäivä' ? '' : d.reason === 'menneisyys' ? '' : 'täynnä'}</small></button>`; }
  el.innerHTML = h + '</div><div class="legend">Vihreä = vapaa noutopäivä · harmaa = suljettu / täynnä. ' + (nextFree ? `<b>Seuraava vapaa päivä ${n} matolle: ${fmtD(nextFree)}</b>` : 'Ei vapaita päiviä 6 viikon sisällä – soita 040 41 08581.') + '</div>';
  el.querySelectorAll('button.free').forEach(b => b.onclick = () => { el.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); onPick(b.dataset.d, b.dataset.r); });
  if (selected && !days.find(d => d.date === selected && d.ok)) onPick(null, null);
  return nextFree;
}
