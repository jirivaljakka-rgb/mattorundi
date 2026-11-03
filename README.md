# Mattorundi pilotti
Käynnistys: `node server.js` (Node 18+, ei riippuvuuksia) → http://localhost:8080
- / etusivu + verkkovaraus · /sopimus myyjän tilaussopimus · /admin ylläpito (PIN env ADMIN_PIN, oletus matto2026) · /vahvistus?id=… vahvistus (tulosta/PDF) · /peruutuslomake
- Data: data/db.json (DATA_FILE env). Testi: `node test.js` (ma 4×6, ti 3×8 -skenaario).
- Hostaus: mikä tahansa Node-palvelu, jossa pysyvä levy (esim. Render/Fly.io/Railway tai oma VPS). Google Calendar -synkka: lisää hook POST /api/orders -kohtaan.
