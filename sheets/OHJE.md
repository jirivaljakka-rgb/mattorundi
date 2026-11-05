# Mattorundi – Sheets-webhook (kestävä tilaus)

Renderin ilmainen palvelu pyyhkii `data/db.json`-tiedoston jokaisessa käynnistyksessä. Vahvistussivu ja **Lähetä sähköpostilla** hakevat tilauksen silloin tästä webhookista (`action: 'getOrder'`). Sähköposti lähtee edelleen `action: 'email'` -haaran kautta osoitteesta mattorundi@gmail.com.

`sheets/Code.gs` on koko webhook. Se kirjoittaa vain **Tilaukset**-välilehteä. Provisiot, reitit ja rebuild jätetään rauhaan: uudet sarakkeet (mm. `Id` ja `Tilaustiedot`) lisätään otsikkorivin **loppuun**. Vanhoja sarakkeita ei siirretä eikä poisteta. Rivi päivitetään `Id`:n perusteella. Jos Id puuttuu, päivitetään sama `Tilausnumero` / `number` kuten ennen. Eri Id:tä ei ylikirjoiteta, vaikka numero sattuu samaan.

## Julkaisu

1. Avaa Mattorundi-Sheets → **Extensions → Apps Script**.
2. Jos projektissa on omia valikkofunktioita (rebuild, provisiot, reitit), kopioi ne talteen. Liitä ne `Code.gs`:n loppuun tämän tiedoston jälkeen. Älä poista niitä.
3. Korvaa webhookin koodi tiedostolla `sheets/Code.gs`.
4. **Project Settings → Script properties**: lisää `SHEETS_SECRET`. Arvo on sama kuin Renderin `SHEETS_SECRET`. Älä kirjoita salasanaa tiedostoon äläkä commitoi sitä. `SECRET`-vakio jää tyhjäksi.
5. Tallenna (Ctrl/Cmd+S).
6. **Deploy → Manage deployments** → kynä → **Version: New version** → **Deploy**.
7. URL (`…/exec`) pysyy samana. Renderissä `SHEETS_WEBHOOK_URL` ja `SHEETS_SECRET` ennallaan.
8. Deployment: **Execute as: Me**, **Who has access: Anyone**. Omistaja = mattorundi@gmail.com.

Selainavaus exec-osoitteeseen vastaa `{"ok":true,"service":"mattorundi"}`. Se ei paljasta salasanaa.

## Tarkistus

- Uusi sopimus → vahvistussivu → **Lähetä sähköpostilla**. Viesti ja PDF kuten ennen (`OHJE-email.md`).
- Tilaukset-rivillä on `Id` (UUID) ja `Tilaustiedot` (JSON). Vanhat sarakkeet ja vanhat rivit ovat paikallaan.
- Käynnistä Render uudelleen (tai odota free-tason nukahtaminen) ja avaa sama `/vahvistus?id=…`. Sivu aukeaa ja sähköposti lähtee.
- Ennen tätä julkaisua syntyneessä rivissä ei ole Id:tä, joten vanhaa vahvistuslinkkiä ei saa takaisin. Tee silloin uusi sopimus.
- Kun webhook vastaa `maxNumber`, seuraava tilausnumero jatkaa suurimmasta `MR-YYYY-NNNN`-numerosta. Jos vastausta ei tule, numero on yksilöllinen (`MR-YYYY-` + aikaleima), jotta vanhaa riviä ei ylikirjoiteta.
