# Mattorundi pilotti
Käynnistys: `node server.js` (Node 18+, ei riippuvuuksia) → http://localhost:8080
- / etusivu + verkkovaraus · /sopimus myyjän tilaussopimus · /admin ylläpito (PIN env ADMIN_PIN, oletus matto2026) · /vahvistus?id=… vahvistus (tulosta/PDF) · /peruutuslomake
- Data: data/db.json (DATA_FILE env) on välimuisti. Uudelleenkäynnistyksen jälkeen vahvistus ja asiakasposti haetaan Google Sheetsistä (`sheets/OHJE.md`). Testi: `node test.js`.
- Hostaus: Node-palvelu, myös Renderin ilmainen taso ilman levyä. Kalenteri ja kapasiteetti käyttävät käynnissä olevan instanssin välimuistia. Google Calendar -synkka: lisää hook POST /api/orders -kohtaan.

## Päivitys 2026-11: myyjät, provisiot, noutopäivät, uusi ilme
- **Myyjät ja provisiot:** /admin → "Myyjät ja provisiot". Jokaisella myyjällä oma koodi, nimi ja provisio (% kokonaishinnasta ja/tai € per matto). Provisio tallentuu tilaukseen kaupan hetkellä. Raportti aikaväliltä + CSV-lataus. Perutut tilaukset eivät kerrytä provisiota.
- **Myyjäsivu piilossa asiakkailta:** etusivulla ei ole linkkejä /sopimus- tai /admin-sivuille; ne ovat noindex-tilassa ja robots.txt estää hakukoneet. Myyjille annetaan suora osoite …/sopimus.
- **Kiinteät noutopäivät:** /admin → "Noutopäivät". Kun lista ei ole tyhjä, vain listatut päivät ovat varattavissa (myös la/su). Oletuksena 11.–14.11.2026 (ke–la). Tyhjä lista = normaalit työpäivät.
- **Ilme:** värit tokeneina (styles.css: primitiivit → semanttiset → komponentit). Teemat metsa (oletus), petrooli, savi. Vertailu: etusivu osoitteella `/?teemat`.
