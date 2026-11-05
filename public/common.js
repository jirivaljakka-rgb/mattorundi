const $ = s => document.querySelector(s);
const fmtD = s => { if (!s) return '–'; const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }); };
function addDaysISO(iso, n) { const [y, m, d] = String(iso).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
const eur = n => n.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
async function api(url, opt = {}) { const r = await fetch(url, { ...opt, headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) } }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Virhe ' + r.status); return j; }
// Kalenteri: näyttää 6 viikkoa, sulkee täydet päivät, ehdottaa seuraavaa vapaata
async function renderCalendar(el, n, onPick, selected) {
  el.innerHTML = '<p>Ladataan kalenteria…</p>';
  const now = new Date(); const dow = (now.getDay() + 6) % 7; const mon = new Date(now); mon.setDate(now.getDate() - dow);
  const from = mon.toLocaleDateString('sv-SE');
  const { days, nextFree } = await api(`/api/calendar?n=${n}&from=${from}&days=42`);
  // Näytetään vain viikot, joilla on noutopäiviä (esim. kun ylläpito on rajannut noutopäivät hallin vuokrakauteen)
  const NON_DAY = ['ei työpäivä', 'ei noutopäivä', 'menneisyys'];
  const weeks = []; for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const useful = weeks.filter(w => w.some(d => d.ok || !NON_DAY.includes(d.reason)));
  const shown = (useful.length ? useful : weeks).flat();
  let h = '<div class="cal">' + ['ma','ti','ke','to','pe','la','su'].map(x => `<div class="h">${x}</div>`).join('');
  for (const d of shown) { const dd = new Date(d.date + 'T00:00:00');
    const lbl = `${dd.getDate()}.${dd.getMonth() + 1}.`;
    h += d.ok ? `<button type="button" class="free ${selected === d.date ? 'sel' : ''}" data-d="${d.date}" title="Vapaa noutopäivä">${lbl}<small>vapaa</small></button>`
      : `<button type="button" class="closed" disabled title="${d.reason}">${lbl}<small>${NON_DAY.includes(d.reason) ? '' : 'täynnä'}</small></button>`; }
  el.innerHTML = h + '</div><div class="legend">Vihreä = vapaa noutopäivä · palautus 17. tai 18.11.2026 klo 9–17 · harmaa = suljettu / täynnä. ' + (nextFree ? `<b>Seuraava vapaa päivä ${n} matolle: ${fmtD(nextFree)}</b>` : 'Ei vapaita noutopäiviä juuri nyt – soita 040 41 08581, niin sovitaan.') + '</div>';
  el.querySelectorAll('button.free').forEach(b => b.onclick = () => { el.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); onPick(b.dataset.d, b.dataset.r); });
  if (selected && !days.find(d => d.date === selected && d.ok)) onPick(null, null);
  return nextFree;
}
