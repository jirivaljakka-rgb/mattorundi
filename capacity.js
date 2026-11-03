// Mattorundi – kapasiteettilogiikka (jaettu palvelin + testit)
const DAY = 86400000;
const iso = d => d.toISOString().slice(0, 10);
const parse = s => new Date(s + 'T00:00:00Z');
const addDays = (s, n) => iso(new Date(parse(s).getTime() + n * DAY));
const weekday = s => { const w = parse(s).getUTCDay(); return w === 0 ? 7 : w; }; // 1=ma..7=su
const isWork = (s, st) => st.workDays.includes(weekday(s));
const nextWork = (s, st) => { let d = s; for (let i = 0; i < 30 && !isWork(d, st); i++) d = addDays(d, 1); return d; };

/**
 * Simuloi koko jonon: matot pestään saapumisjärjestyksessä (FIFO),
 * washPerDay mattoa per työpäivä, pesu alkaa noutoa seuraavana työpäivänä.
 * Pesty matto on valmis (turnaroundDays-1) päivän kuivauksen jälkeen.
 * Palautus = ensimmäinen työpäivä, kun kaikki tilauksen matot ovat valmiita
 * ja vähintään turnaroundDays päivää noudosta.
 */
function simulate(orders, st) {
  const act = orders.filter(o => o.status !== 'peruttu')
    .slice().sort((a, b) => a.pickupDate.localeCompare(b.pickupDate) || (a.createdAt || '').localeCompare(b.createdAt || ''));
  const res = {};
  if (!act.length) return { returns: res, days: {} };
  const queue = []; // {id, left}
  const lastWash = {};
  let idx = 0, d = act[0].pickupDate;
  const dryDays = Math.max(0, st.turnaroundDays - 1);
  for (let guard = 0; guard < 800 && (idx < act.length || queue.length); guard++) {
    if (isWork(d, st)) {
      let cap = st.washPerDay;
      while (cap > 0 && queue.length) {
        const q = queue[0]; const take = Math.min(cap, q.left);
        q.left -= take; cap -= take; lastWash[q.id] = d;
        if (q.left === 0) queue.shift();
      }
    }
    while (idx < act.length && act[idx].pickupDate === d) { const o = act[idx++]; queue.push({ id: o.id, left: o.carpetsTotal }); }
    d = addDays(d, 1);
  }
  const days = {};
  for (const o of act) {
    const ready = addDays(lastWash[o.id] || o.pickupDate, dryDays);
    const min = addDays(o.pickupDate, st.turnaroundDays);
    const ret = nextWork(ready > min ? ready : min, st);
    res[o.id] = ret;
    days[o.pickupDate] = days[o.pickupDate] || { pickups: 0, storage: 0 };
    days[o.pickupDate].pickups += o.carpetsTotal;
  }
  // varastossa päivänä x = noudettu <= x ja palautus > x
  const all = Object.keys(days).concat(Object.values(res)).sort();
  const end = all[all.length - 1];
  for (let x = act[0].pickupDate; x <= end; x = addDays(x, 1)) {
    let s = 0; for (const o of act) if (o.pickupDate <= x && res[o.id] > x) s += o.carpetsTotal;
    days[x] = days[x] || { pickups: 0, storage: 0 }; days[x].storage = s;
  }
  return { returns: res, days };
}

// Voiko n mattoa noutaa päivänä date? Palauttaa {ok, reason, returnDate}
function check(orders, st, date, n, today) {
  if (today && date <= today) return { ok: false, reason: 'menneisyys' };
  if (!isWork(date, st)) return { ok: false, reason: 'ei työpäivä' };
  const picked = orders.filter(o => o.status !== 'peruttu' && o.pickupDate === date).reduce((a, o) => a + o.carpetsTotal, 0);
  if (picked + n > st.maxPickupPerDay) return { ok: false, reason: 'noutokiintiö täynnä', picked };
  const test = { id: '__new', pickupDate: date, carpetsTotal: n, createdAt: '9999' };
  const sim = simulate(orders.concat([test]), st);
  for (const [x, v] of Object.entries(sim.days)) if (v.storage > st.storageCapacity) return { ok: false, reason: 'varasto täynnä (' + x + ')', picked };
  return { ok: true, returnDate: sim.returns.__new, picked };
}

function calendar(orders, st, from, count, n, today) {
  const out = []; for (let i = 0; i < count; i++) { const d = addDays(from, i); out.push({ date: d, ...check(orders, st, d, n, today) }); }
  return out;
}
module.exports = { simulate, check, calendar, addDays, iso, isWork };
