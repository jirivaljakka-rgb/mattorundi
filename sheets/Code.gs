/**
 * Mattorundi-webhook. Kirjoittaa vain Tilaukset-välilehteä.
 * Ei koske muihin välilehtiin (provisiot, reitit, rebuild).
 * Uudet sarakkeet lisätään otsikkorivin loppuun. Vanhoja ei siirretä eikä poisteta.
 * Julkaisu: sheets/OHJE.md
 *
 * Salaisuus: Script properties -avain SHEETS_SECRET (sama arvo kuin Renderissä).
 * SECRET-vakioon voi jättää arvon vain jos propertyä ei käytetä. Älä commitoi salasanaa.
 */
var SECRET = '';

var FIELDS = [
  { field: 'id', header: 'Id', aliases: ['Id', 'UUID', 'id', 'uuid'] },
  { field: 'number', header: 'Tilausnumero', aliases: ['Tilausnumero', 'Tilausnro', 'Numero', 'Nro', 'number'] },
  { field: 'createdAt', header: 'Luotu', aliases: ['Luotu', 'createdAt'] },
  { field: 'channel', header: 'Kanava', aliases: ['Kanava', 'channel'] },
  { field: 'sellerCode', header: 'Myyjäkoodi', aliases: ['Myyjäkoodi', 'sellerCode'] },
  { field: 'sellerName', header: 'Myyjä', aliases: ['Myyjä', 'Myyjän nimi', 'sellerName'] },
  { field: 'name', header: 'Asiakas', aliases: ['Asiakas', 'Nimi', 'name'] },
  { field: 'phone', header: 'Puhelin', aliases: ['Puhelin', 'phone'] },
  { field: 'email', header: 'Sähköposti', aliases: ['Sähköposti', 'Sahkoposti', 'email'] },
  { field: 'address', header: 'Osoite', aliases: ['Osoite', 'address'] },
  { field: 'postal', header: 'Postinumero', aliases: ['Postinumero', 'postal'] },
  { field: 'city', header: 'Kaupunki', aliases: ['Kaupunki', 'city'] },
  { field: 'pickupDate', header: 'Nouto', aliases: ['Nouto', 'Noutopäivä', 'pickupDate'], day: true },
  { field: 'pickupTime', header: 'Noutoaika', aliases: ['Noutoaika', 'pickupTime'] },
  { field: 'large', header: 'Isoja', aliases: ['Isoja', 'Iso', 'large'] },
  { field: 'medium', header: 'Keskikokoisia', aliases: ['Keskikokoisia', 'Keski', 'medium'] },
  { field: 'total', header: 'Summa', aliases: ['Summa', 'Yhteensä', 'total'] },
  { field: 'commission', header: 'Provisio', aliases: ['Provisio', 'commission'] },
  { field: 'returnDate', header: 'Palautus', aliases: ['Palautus', 'returnDate'], day: true },
  { field: 'notes', header: 'Huomiot', aliases: ['Huomiot', 'Lisätiedot', 'notes'] },
  { field: 'status', header: 'Tila', aliases: ['Tila', 'status'] },
  { field: 'payment', header: 'Maksu', aliases: ['Maksu', 'payment'] },
  { field: 'extrasHair', header: 'Karvanpoisto', aliases: ['Karvanpoisto', 'extrasHair'] },
  { field: 'extrasOdor', header: 'Hajunpoisto', aliases: ['Hajunpoisto', 'extrasOdor'] },
  { field: 'priceMedium', header: 'Hinta keski', aliases: ['Hinta keski', 'priceMedium'] },
  { field: 'priceLarge', header: 'Hinta iso', aliases: ['Hinta iso', 'priceLarge'] },
  { field: 'vat', header: 'ALV', aliases: ['ALV', 'Alv', 'vat'] },
  { field: 'vatPct', header: 'ALV %', aliases: ['ALV %', 'ALV%', 'vatPct'] },
  { field: 'carpetsTotal', header: 'Mattoja', aliases: ['Mattoja', 'carpetsTotal'] },
  { field: 'agreedReturnDate', header: 'Sovittu palautus', aliases: ['Sovittu palautus', 'agreedReturnDate'], day: true },
  { field: 'estReturnAtBooking', header: 'Arvio palautuksesta', aliases: ['Arvio palautuksesta', 'estReturnAtBooking'], day: true },
  { field: 'termsVersion', header: 'Ehdot', aliases: ['Ehdot', 'termsVersion'] },
  { field: 'startEarly', header: 'Aloitus peruutusajalla', aliases: ['Aloitus peruutusajalla', 'startEarly'] },
  { field: 'customerNotes', header: 'Asiakkaan huomiot', aliases: ['Asiakkaan huomiot', 'customerNotes'] },
  { field: 'snapshot', header: 'Tilaustiedot', aliases: ['Tilaustiedot', 'snapshot', 'OrderJson', 'JSON'] }
];

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function expectedSecret_() {
  var fromProp = '';
  try { fromProp = PropertiesService.getScriptProperties().getProperty('SHEETS_SECRET') || ''; } catch (e) {}
  return String(SECRET || fromProp).trim();
}
function secretOk_(b) {
  var expected = expectedSecret_();
  if (!expected) return false;
  return String((b && b.secret) || '').trim() === expected;
}
function tilaukset_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Tilaukset');
  if (!sh) sh = ss.insertSheet('Tilaukset');
  return sh;
}
function headerMap_(sh) {
  var col = {};
  var i, c, f, a, name;
  for (i = 0; i < FIELDS.length; i++) col[FIELDS[i].field] = 0;
  var width = sh.getLastColumn();
  if (width < 1) return { col: col };
  var headers = sh.getRange(1, 1, 1, width).getValues()[0];
  for (c = 0; c < headers.length; c++) {
    name = String(headers[c] || '').trim().toLowerCase();
    if (!name) continue;
    for (f = 0; f < FIELDS.length; f++) {
      if (col[FIELDS[f].field]) continue;
      for (a = 0; a < FIELDS[f].aliases.length; a++) {
        if (FIELDS[f].aliases[a].toLowerCase() === name) { col[FIELDS[f].field] = c + 1; break; }
      }
    }
  }
  return { col: col };
}
function ensureColumns_(sh) {
  var map = headerMap_(sh);
  var missing = [];
  var i;
  for (i = 0; i < FIELDS.length; i++) if (!map.col[FIELDS[i].field]) missing.push(FIELDS[i].header);
  if (!missing.length) return;
  if (sh.getLastColumn() === 0) {
    sh.getRange(1, 1, 1, missing.length).setValues([missing]);
    return;
  }
  sh.getRange(1, sh.getLastColumn() + 1, 1, missing.length).setValues([missing]);
}
function findRow_(sh, id, number) {
  var map = headerMap_(sh);
  var last = sh.getLastRow();
  var width = sh.getLastColumn();
  if (last < 2 || width < 1) return null;
  var values = sh.getRange(2, 1, last - 1, width).getValues();
  var i;
  if (id && map.col.id) {
    for (i = values.length - 1; i >= 0; i--) {
      if (String(values[i][map.col.id - 1] || '') === id) return { row: i + 2, values: values[i] };
    }
  }
  if (number && map.col.number) {
    for (i = values.length - 1; i >= 0; i--) {
      if (String(values[i][map.col.number - 1] || '') === number) return { row: i + 2, values: values[i] };
    }
  }
  return null;
}
function snapshotText_(order) {
  var snap = order.snapshot;
  if (snap && typeof snap === 'object') return JSON.stringify(snap);
  if (typeof snap === 'string' && snap) return snap;
  var copy = {};
  var k;
  for (k in order) {
    if (!Object.prototype.hasOwnProperty.call(order, k) || k === 'snapshot') continue;
    if (order[k] && typeof order[k] === 'object') continue;
    copy[k] = order[k];
  }
  return JSON.stringify(copy);
}
function cellOut_(field, cell) {
  if (cell instanceof Date) {
    var fmt = field.day ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm:ss'Z'";
    return Utilities.formatDate(cell, field.day ? 'Europe/Helsinki' : 'UTC', fmt);
  }
  return cell;
}
function rowToOrder_(sh, values) {
  var map = headerMap_(sh);
  var snapCol = map.col.snapshot;
  if (snapCol) {
    var raw = values[snapCol - 1];
    if (raw) {
      try {
        var parsed = JSON.parse(String(raw));
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (err) {}
    }
  }
  var order = {};
  var i, c, field;
  for (i = 0; i < FIELDS.length; i++) {
    field = FIELDS[i];
    c = map.col[field.field];
    if (!c || field.field === 'snapshot') continue;
    order[field.field] = cellOut_(field, values[c - 1]);
  }
  return order;
}
function upsert_(order) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = tilaukset_();
    ensureColumns_(sh);
    var map = headerMap_(sh);
    var found = null;
    if (order.id) found = findRow_(sh, String(order.id), '');
    if (!found && order.number) {
      var byNum = findRow_(sh, '', String(order.number));
      if (byNum) {
        var existingId = map.col.id ? String(byNum.values[map.col.id - 1] || '') : '';
        if (!existingId || !order.id || existingId === String(order.id)) found = byNum;
      }
    }
    var width = Math.max(sh.getLastColumn(), 1);
    var row = [];
    var c, i, field, col, value;
    if (found) row = sh.getRange(found.row, 1, 1, width).getValues()[0];
    else for (c = 0; c < width; c++) row.push('');
    for (i = 0; i < FIELDS.length; i++) {
      field = FIELDS[i].field;
      col = map.col[field];
      if (!col) continue;
      if (field !== 'snapshot' && order[field] === undefined) continue;
      value = field === 'snapshot' ? snapshotText_(order) : order[field];
      if (value === undefined || value === null) value = '';
      else if (typeof value === 'object') value = JSON.stringify(value);
      row[col - 1] = value;
    }
    if (found) sh.getRange(found.row, 1, 1, width).setValues([row]);
    else sh.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}
function withSheet_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(tilaukset_()); }
  finally { lock.releaseLock(); }
}
function maxOrderNumber_(sh, year) {
  var map = headerMap_(sh);
  var col = map.col.number;
  var last = sh.getLastRow();
  if (!col || last < 2) return 0;
  var vals = sh.getRange(2, col, last - 1, 1).getValues();
  var re = new RegExp('^MR-' + year + '-(\\d+)$');
  var max = 0;
  var i, m;
  for (i = 0; i < vals.length; i++) {
    m = String(vals[i][0] || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

function doGet() {
  return json_({ ok: true, service: 'mattorundi' });
}

function doPost(e) {
  var b = {};
  try { b = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'json' }); }
  if (!secretOk_(b)) return json_({ ok: false, error: 'secret' });

  // Sähköposti päättyy ennen tilauskirjausta. order-kenttää ei upsertata.
  if (b.action === 'email') {
    var to = String(b.to || '').trim();
    if (!to || to.indexOf('@') < 0) return json_({ ok: false, error: 'to' });
    var plain = String(b.body || '').trim();
    if (!plain || plain.toLowerCase().indexOf('kiitos') < 0 || plain.indexOf('PDF') < 0) {
      return json_({ ok: false, error: 'body' });
    }
    var pdfName = String(b.pdfFilename || 'Mattorundi-tilausvahvistus.pdf').slice(0, 120);
    var msg = {
      to: to,
      subject: String(b.subject || 'Mattorundi').slice(0, 200),
      body: plain,
      name: 'Mattorundi',
      replyTo: 'mattorundi@gmail.com'
    };
    // HTML on lisä. Älä kirjoita bodyä uusiksi tai tyhjäksi: jos HTML ei näy, Gmail näyttää plain-tekstin.
    if (b.htmlBody && String(b.htmlBody).trim()) msg.htmlBody = String(b.htmlBody);
    if (b.pdfHtml) {
      var pdf = Utilities.newBlob(String(b.pdfHtml), 'text/html', 'vahvistus.html').getAs('application/pdf');
      pdf.setName(pdfName);
      msg.attachments = [pdf];
    }
    MailApp.sendEmail(msg);
    return json_({ ok: true });
  }

  if (b.action === 'getOrder') {
    var order = withSheet_(function (sh) {
      var found = findRow_(sh, b.id ? String(b.id) : '', b.number ? String(b.number) : '');
      return found ? rowToOrder_(sh, found.values) : null;
    });
    if (!order) return json_({ ok: false, error: 'Ei löydy' });
    return json_({ ok: true, order: order });
  }

  if (b.action === 'maxNumber') {
    var year = String(b.year || Utilities.formatDate(new Date(), 'Europe/Helsinki', 'yyyy'));
    var max = withSheet_(function (sh) { return maxOrderNumber_(sh, year); });
    return json_({ ok: true, year: year, max: max });
  }

  if (b.action) return json_({ ok: false, error: 'action' });
  if (!b.order || typeof b.order !== 'object') return json_({ ok: false, error: 'order' });
  upsert_(b.order);
  return json_({ ok: true });
}
