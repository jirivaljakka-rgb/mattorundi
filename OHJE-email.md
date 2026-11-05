# Mattorundi – asiakassähköposti ja PDF-liite

Palvelin (`POST /api/orders/:id/email`) kutsuu samaa Sheets-webhookia kuin tilauskirjaus. Viestissä ei ole linkkiä `/vahvistus`-sivulle. Asiakas saa lyhyen tekstin ja PDF-tilausvahvistuksen.

Sheets-kirjaus (payload ilman `action`) ei muutu: tilaus upsertataan kuten ennen.

## Sähköpostin payload

```json
{
  "secret": "<SHEETS_SECRET>",
  "action": "email",
  "to": "asiakas@example.com",
  "subject": "Mattorundi tilausvahvistus MR-2026-0001",
  "body": "Hei … kiitos, että valitsit Mattorundin! … PDF-tiedostona … Nouto, arvioitu palautus, summa. Ei URL-osoitetta.",
  "htmlBody": "<!doctype html>… sama teksti HTML-muodossa, ilman kuvia ja ilman /vahvistus-linkkiä …",
  "pdfFilename": "Mattorundi-tilausvahvistus-MR-2026-0001.pdf",
  "pdfHtml": "<!doctype html>… asiakkaan vahvistus, ehdot ja peruutuslomake …",
  "order": {
    "number": "MR-2026-0001",
    "createdAt": "2026-11-05T10:00:00.000Z",
    "contractDate": "2026-11-05",
    "cancelBy": "2026-11-19",
    "name": "",
    "phone": "",
    "email": "",
    "address": "",
    "postal": "",
    "city": "",
    "pickupDate": "2026-11-11",
    "pickupTime": "",
    "returnDate": "2026-11-16",
    "medium": 1,
    "large": 0,
    "priceMedium": 44,
    "priceLarge": 54,
    "extrasHair": 0,
    "extrasOdor": 0,
    "lines": [{ "name": "Keskikokoinen matto (1–2,4 m²)", "qty": 1, "unitPrice": 44, "sum": 44 }],
    "total": 44,
    "vat": 8.94,
    "vatPct": 25.5,
    "payment": "palautuksen yhteydessä",
    "notes": "",
    "channel": "verkko",
    "sellerName": "",
    "startEarly": false,
    "signed": false,
    "termsVersion": "2026-11"
  }
}
```

`order` on asiakasnäkymä (ei provisiota). Älä syötä sitä `upsert_`-funktioon. Sähköpostihaaran pitää päättyä ennen tilauskirjausta, kuten ennenkin.

## Apps Script – sähköpostihaara

Korvaa `doPost`:in `if (b.action === 'email')` -haara tällä. `body` on pelkkä teksti. `htmlBody` on asiakkaan näkemä HTML-viesti (`MailApp` htmlBody). `pdfHtml` liitetään PDF:nä, ei sähköpostin HTML-runkona.

```javascript
if (b.action === 'email') {
  var to = String(b.to || '').trim();
  if (!to || to.indexOf('@') < 0) return json_({ ok: false, error: 'to' });
  var pdfName = String(b.pdfFilename || 'Mattorundi-tilausvahvistus.pdf').slice(0, 120);
  var opts = {
    to: to,
    subject: String(b.subject || 'Mattorundi').slice(0, 200),
    body: String(b.body || ''),
    name: 'Mattorundi',
    replyTo: 'mattorundi@gmail.com'
  };
  if (b.htmlBody) opts.htmlBody = String(b.htmlBody);
  if (b.pdfHtml) {
    var pdf = Utilities.newBlob(String(b.pdfHtml), 'text/html', 'vahvistus.html').getAs('application/pdf');
    pdf.setName(pdfName);
    opts.attachments = [pdf];
  }
  MailApp.sendEmail(opts);
  return json_({ ok: true });
}
```

## Uudelleenjulkaisu (pakollinen Code.gs-muutoksen jälkeen)

Ilman uutta versiota vanha skripti lähettää yhä tekstin (ei enää myyjälinkkiä), mutta PDF-liite jää pois.

1. Avaa Mattorundi-Sheets → **Extensions → Apps Script**.
2. Päivitä sähköpostihaara yllä olevaksi. Secret ja tilauskirjaus ennallaan.
3. Tallenna (Ctrl/Cmd+S).
4. **Deploy → Manage deployments** → muokkaa (kynä) → **Version: New version** → **Deploy**.
5. URL (`…/exec`) pysyy samana. Renderissä `SHEETS_WEBHOOK_URL` ja `SHEETS_SECRET` ennallaan.
6. Deployment: **Execute as: Me**, **Who has access: Anyone**. Omistaja = mattorundi@gmail.com.

## Testi

- Luo koevaraus sähköpostilla → vahvistussivu → **Lähetä sähköpostilla**.
- Asiakkaan viestissä ei ole `/vahvistus`-linkkiä. Liite: `Mattorundi-tilausvahvistus-MR-….pdf`.
- Vahvistussivu on myyjälle: tulostus ja sähköposti. Sivua ei ohjeisteta kopioitavaksi asiakkaalle.
- Jos 502 / "Sähköpostipalvelu ei ole käytössä": webhook-URL tai secret puuttuu Renderistä, tai Apps Scriptiä ei ole julkaistu uutena versiona.
