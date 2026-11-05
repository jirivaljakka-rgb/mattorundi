const COMPANY = {
  name: 'Valaja Team Osk (Mattorundi)',
  founders: 'Roope Liimatainen & Ahmed Alguvercin',
  ytunnus: '3529504-8',
  address: 'Kuntokatu 3 C, 33520 Tampere',
  email: 'mattorundi@gmail.com',
  phone: '040 41 08581'
};
const TERMS_HTML = `
<h3>1. Palveluntarjoaja</h3>
<p>${COMPANY.name}<br>Perustajat: ${COMPANY.founders}<br>Y-tunnus: ${COMPANY.ytunnus}<br>${COMPANY.address}<br>${COMPANY.email} · ${COMPANY.phone}</p>
<h3>2. Palvelun sisältö</h3>
<p>Mattorundi noutaa asiakkaan matot sovittuna noutopäivänä asiakkaan osoitteesta Tampereella, pesee ja kuivaa ne sekä palauttaa ne asiakkaalle. Hinta sisältää noudon, pesun, kuivauksen ja palautuksen. Pesu tehdään käsinpesuna. Yli 3,5 m² mattoja ei oteta vastaan. Ennen pesua tehdään tarvittaessa värinpitävyystesti. Jos matto ei sovellu pestäväksi turvallisesti, siitä ilmoitetaan asiakkaalle ennen pesua eikä siitä veloiteta. Lisäpalvelut (esim. karvanpoisto, hajunpoisto) veloitetaan erikseen sovitun hinnaston mukaan.</p>
<h3>3. Hinnat</h3>
<p>Keskikokoinen matto (1–2,4 m²) 44 €, iso matto (2,5–3,5 m²) 54 €. Karvanpoisto 10 € / matto (valitulle mattojen määrälle). Hajunpoisto 10 € (koskee kaikkia mattoja). Hinnat sisältävät arvonlisäveron 25,5 %. Yli 3,5 m² mattoja ei oteta vastaan.</p>
<h3>4. Aikataulu</h3>
<p>Nouto tapahtuu sopimuksessa merkittynä päivänä. Tällä jaksolla palautus on vain 17.11.2026 tai 18.11.2026 klo 9–17. Asiakas valitsee palautuspäivän ja kellonajan tältä väliltä. Palautuspäivä ja -aika näkyvät tilausvahvistuksessa. Alle 48 tuntia ennen sovittua noutoa tehdyistä ajanmuutoksista voidaan periä 10 € käsittelymaksu.</p>
<h3>5. Maksaminen</h3>
<p>Hyväksytyt maksutavat: korttimaksu heti (Zettle), korttimaksu mattojen palautuksen yhteydessä ja lasku. Laskun maksuehto on 14 päivää netto. Viivästyskorko korkolain mukaan. Huomautuskulu 5 € / huomautus. Jos asiakas peruu sopimuksen peruuttamisaikana, jo maksettu summa palautetaan viimeistään 14 päivän kuluessa peruutusilmoituksesta, vähennettynä kohdan 7 mukaisella korvauksella jo suoritetusta palvelusta.</p>
<h3>6. Peruuttamisoikeus (kotimyynti ja etämyynti)</h3>
<p>Kuluttajalla on oikeus peruuttaa sopimus ilmoittamatta syytä <b>14 päivän kuluessa sopimuksen tekopäivästä</b>. Peruuttamisoikeuden käyttämiseksi asiakkaan on ilmoitettava Mattorundille yksiselitteisesti (esim. sähköpostilla ${COMPANY.email}, puhelimella ${COMPANY.phone} tai kirjeellä) päätöksestään peruuttaa sopimus. Asiakas voi käyttää oheista peruutuslomaketta, mutta se ei ole pakollista. Peruuttamisaika on noudatettu, kun ilmoitus lähetetään ennen määräajan päättymistä. Jos sopimus perutaan ennen noutoa, siitä ei aiheudu kuluja.</p>
<h3>7. Palvelun aloittaminen peruuttamisaikana ja peruutus työn alettua</h3>
<p>Jos asiakas on nimenomaisesti pyytänyt, että nouto ja pesu aloitetaan peruuttamisaikana, ja peruu sopimuksen palvelun jo alettua, asiakas maksaa kohtuullisen korvauksen siihen asti suoritetusta palvelusta suhteessa kokonaishintaan. Kun palvelu on suoritettu kokonaan (matot pesty ja palautettu) asiakkaan nimenomaisesta pyynnöstä ja asiakas on hyväksynyt menettävänsä peruuttamisoikeuden palvelun tultua suoritetuksi, peruuttamisoikeutta ei enää ole. 14 päivän peruuttamisajan jälkeen tilaus on sitova. Jos asiakas peruu tilauksen sen jälkeen, kun työ on hänen pyynnöstään jo aloitettu (esim. matot noudettu), yrityksellä on oikeus periä 25 € peruutusmaksu.</p>
<h3>8. Vastuu matoista ja virheet</h3>
<p>Mattorundi vastaa matoista huolellisesti niiden ollessa hallussaan. Palvelu suoritetaan ammattitaitoisesti ja huolellisesti. Toiminnan vastuuvakuutus on voimassa. Jos pesun tulos on virheellinen tai matto vahingoittuu Mattorundin hallussa ollessaan, asiakkaalla on kuluttajansuojalain mukaiset oikeudet (virheen korjaus, uusintapesu, hinnanalennus tai vahingonkorvaus). Virheestä tulee ilmoittaa kohtuullisessa ajassa, mieluiten 14 päivän kuluessa palautuksesta. Normaali kuluminen, maton valmistusvirheet, ennestään heikentyneet värit tai pohjat sekä pesussa irtoamattomat pysyvät tahrat eivät ole palvelun virheitä.</p>
<h3>9. Henkilötiedot</h3>
<p>Asiakkaan tietoja käytetään vain tilauksen hoitamiseen, laskutukseen, asiakaspalveluun ja lakisääteisiin velvoitteisiin. Markkinointiviestejä sähköpostilla tai tekstiviestillä lähetetään vain asiakkaan erillisellä suostumuksella. Tietoja säilytetään niin kauan kuin tilauksen käsittely ja kirjanpito edellyttävät.</p>
<h3>10. Erimielisyydet</h3>
<p>Erimielisyydet pyritään ratkaisemaan ensisijaisesti neuvottelemalla. Kuluttaja voi saattaa asian kuluttajariitalautakunnan (www.kuluttajariita.fi) käsiteltäväksi; ennen sitä kannattaa olla yhteydessä kuluttajaneuvontaan (www.kkv.fi/kuluttajaneuvonta). Erimielisyydet käsitellään Pirkanmaan käräjäoikeudessa.</p>`;
const CANCEL_FORM_HTML = o => `
<h2>Peruutuslomake</h2>
<p><i>(Täytä ja palauta tämä lomake vain, jos haluat peruuttaa sopimuksen.)</i></p>
<p><b>Vastaanottaja:</b> ${COMPANY.name}, Y-tunnus ${COMPANY.ytunnus}, ${COMPANY.address}, ${COMPANY.email}, ${COMPANY.phone}</p>
<p>Ilmoitan, että peruutan tekemääni sopimukseen perustuvan seuraavan palvelun suorittamisen:<br>
<b>Mattojen nouto, pesu, kuivaus ja palautus${o ? ', tilaus ' + o.number : ''}</b></p>
<p>Tilauspäivä: ${o ? new Date(o.createdAt).toLocaleDateString('fi-FI') : '____________'}</p>
<p>Kuluttajan nimi: ${o ? o.name : '_______________________________'}</p>
<p>Kuluttajan osoite: ${o ? o.address + ', ' + (o.postal || '') + ' ' + (o.city || '') : '_______________________________'}</p>
<p>Kuluttajan allekirjoitus (vain jos lomake tehdään paperilla): _______________________________</p>
<p>Päiväys: ____________</p>`;
if (typeof module !== 'undefined' && module.exports) module.exports = { COMPANY, TERMS_HTML, CANCEL_FORM_HTML };
