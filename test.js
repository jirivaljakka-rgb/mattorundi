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
console.log('Kaikki testit OK');

// Lisäpalvelut: karvanpoisto / hajunpoisto 2 € / matto
function orderTotal(med, lg, hair, odor, pm, pl) {
  const n = med + lg;
  hair = Math.max(0, Math.min(n, hair|0));
  odor = Math.max(0, Math.min(n, odor|0));
  return med * pm + lg * pl + 2 * (hair + odor);
}
const tot1 = orderTotal(1, 1, 1, 1, 44, 54); // 44+54+2+2 = 102
console.log('Hinta 1 keski + 1 iso + karva + haju:', tot1);
if (tot1 !== 102) { console.error('VIRHE: extras-hinnoittelu'); process.exit(1); }
const tot2 = orderTotal(2, 0, 5, 0, 44, 54); // hair clamped to 2 → 88+4=92
console.log('Hinta 2 keski + karva clamp 5→2:', tot2);
if (tot2 !== 92) { console.error('VIRHE: extras clamp'); process.exit(1); }
console.log('Extras-testit OK');
