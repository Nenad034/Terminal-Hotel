# Terminal Hotel — Arhitektura sistema za hotelsko poslovanje

> Vizuelna, interaktivna verzija ovog dokumenta (sa dijagramima): https://claude.ai/code/artifact/9ca8774d-1352-4b44-ab71-5fabee0922b8
>
> Ovaj fajl je radna/tekstualna referenca za dalji razvoj koda. Istraživanje sprovedeno avgusta 2026 — vendori i API-ji se menjaju, proveriti trenutni status pre implementacije.

## 0. Cilj

Ne kopira se jedan konkretan proizvod (Mews/Cloudbeds/OPERA), već se izvlači zajednički imenitelj iz njih svih: koji domeni moraju postojati, kako komuniciraju, koji podaci su zajednički, gde su realne granice integracije prema trećim sistemima (POS, brave, minibar, spa).

**Ključni nalaz:** ne postoji jedan univerzalni "hotel API" standard. HTNG i OpenTravel Alliance su aktivni ali su danas referentni okvir, ne obavezan protokol. Svaki ozbiljan vendor (Mews, apaleo, Cloudbeds, Toast, Fourth/Adaco, Zenoti, Salto) ima sopstveni REST/JSON API sa OAuth2 + webhookovima. Zaključak: graditi sopstveni integracioni/adapter sloj, ne oslanjati se na spoljni standard.

## 1. Tipovi hotela → obim sistema

| Tip | Obim | Aktivni moduli | Arhitektura |
|---|---|---|---|
| Budget/hostel | 10–40 soba | Rezervacije, front desk, osnovni folio, prost magacin | Sve-u-jednom, minimalna integraciona površina |
| Boutique | 30–150 soba | + POS, housekeeping app, 1 lock vendor | API-first sastavljanje (marketplace model) |
| Poslovni/city | 100–300 soba | + konferencije, valet, više POS izlaza | Više revenue centara, RMS, GDS |
| Resort/all-inclusive | 200–600+ soba | + spa, bazen/cabana, više restorana, centralna kuhinja | Duboka lokacijska hijerarhija, interni transferi |
| Lanac | multi-property | Svi moduli + biometrija, enterprise RMS/CRM | Multi-tenant, enterprise integracije (EDI, GDS) |

Puna matrica modula po tipu: videti artifact, poglavlje 18.

## 2. Referentna arhitektura — slojevi

```
Kanali (booking widget, gost app, staff web, kiosk, OTA/GDS)
        ↕
API Gateway (OAuth2/OIDC, tenant resolution, rate limiting, webhooks)
        ↕
Domenski servisi jezgra — modularni monolit:
  Rezervacije | Folio & naplata | Inventar & cenovnici | Gost profil/CRM | Housekeeping & zadaci
        ↕
Event magistrala (Kafka) — tanak event + fetch-full-state
        ↕
Integracioni/adapter sloj:
  POS/F&B | brave & IoT | spa | plaćanja (tokenizacija)
  fiskalizacija (L/V-PFR) | SEF e-Faktura | eTurista | kanal menadžer/GDS
        ↕
Platforma podataka — event-sourced data lake, BI, ML/pricing
```

**Zašto modularni monolit, ne odmah mikroservisi:** preporuka je krenuti od modularnog monolita sa jasnim granicama domena (Reservations, Folio, Inventory, Guest Profile, Housekeeping, Integration Hub), pa izdvajati servise selektivno kad opterećenje zahteva — prvi kandidati su obično Reservations (OTA sync špicevi) i Integration Hub (nezavisan deploy ciklus adaptera). Oracle OHIP je dokaz da puna mikroservisna arhitektura radi na enterprise nivou (stateless, na OCI), ali za novu platformu je to cilj kasnije faze, ne starta.

## 3. PMS jezgro

Moduli: rezervacioni engine, front desk (check-in/out, enkodiranje kartice), folio & naplata (split/share, routing, boravišna taksa, fiskalizacija), housekeeping tabla (status sobe real-time), upravljanje cenama (rate plan, LOS restrikcije), gost profil/CRM (dedup, GDPR pristanak, loyalty), grupne rezervacije (block, rooming lista, master račun), noćni audit, i aktivnosti/itinerar gosta (izleti, ture, eksterni eventi — treći tip rezervacije pored sobe, detaljno u poglavlju 11).

Referentni sistemi (segment / API dostupnost):
- **Oracle OPERA Cloud** — enterprise/lanci, OHIP javno (3000+ endpoint-a, docs.oracle.com/en/industries/hospitality/integration-platform)
- **Mews** — boutique–mid-scale, javno (docs.mews.com/connector-api), Marketplace 500+ app-ova
- **apaleo** — tech-forward independent, najotvoreniji (apaleo.dev), odvojeni API-ji: Booking/Finance/Payment/Distribution/Profile
- **Cloudbeds** — independent 20–80 soba, javno (developers.cloudbeds.com), 35+ webhook tipova
- **Clock PMS+** — independent/aparthotel, javno (api-docs.clock-software.com)
- **Agilysys** — resort/casino, partner-gated, najširi operativni obim (PMS+POS+spa+golf)
- **Infor HMS** — mid-large lanci, partner-gated, 700+ pre-built integracija
- **protel/Planet** — mid-market EU, partner-gated, Open API Framework sa sandbox-om

Model: javnu API površinu graditi po ugledu na apaleo/Cloudbeds; operativnu dubinu (multi-outlet, multi-property) po ugledu na Oracle/Agilysys.

## 4. Distribucija i kanali

| Kategorija | Sistem | Uloga |
|---|---|---|
| OTA direktno | Booking.com Connectivity API | Content/Contracting/Connections API (trenutno pauzira nove provajdere) |
| OTA direktno | Expedia Rapid API | Shopping/booking/payment + Product + Messaging API |
| GDS | Amadeus for Developers | Hotel Search/List/Booking, 150k+ objekata |
| GDS | Sabre Dev Studio | SynXis, REST + legacy SOAP |
| GDS | Travelport Stays API v11 | OpenAPI/Swagger, zahteva ugovor |
| Kanal menadžer | SiteMinder Channels Plus | Jedna REST integracija za sve povezane objekte |
| Kanal menadžer | RateGain | DirectConnect – Demand (Push) |
| RMS | IDeaS / Duetto | Bolt-on: čita PMS podatke, vraća cenu/restrikcije |

Mali hoteli: ugrađen kanal menadžer dovoljan. Resort/lanac: zasebna GDS konekcija + enterprise RMS opravdani volumenom.

## 5. F&B: restorani i barovi

**"Post to room" obrazac** (Toast Tender API, najbolje javno dokumentovan primer):
1. `TENDER_SEARCH_CONFIG` — PMS vraća polja za pretragu gosta
2. `TENDER_SEARCH` — POS šalje kriterijum, PMS vraća `tenderIdentifier`
3. `TENDER_RETRIEVE_DISCOUNTS/PAYMENTS` — PMS vraća popuste i metode plaćanja
4. `TENDER_REDEEM` — finalizacija, knjiženje na folio
5. `TENDER_GRATUITY` / `TENDER_REVERSE` — napojnica / storno

Svaki artikal menija mapira se na "revenue category" hotela radi usaglašavanja sa kontnim planom.

POS sistemi: Oracle MICROS Simphony (enterprise, uz OPERA), Toast POS (javno dokumentovan Tender API), Lightspeed Restaurant ("Charge to Room", prvi sertifikovan za OPERA Cloud), Agilysys InfoGenesis (resort/casino), Squirrel POS (25+ PMS integracija preko middleware-a).

HTNG POS interface spec: pretraga/verifikacija gosta, knjiženje i preuzimanje detalja, offline-capable posting sa naknadnim usaglašavanjem, sinhronizovan date-roll.

## 6. Nabavka, magacin, inventar

Najbolji javni referentni model: **Fourth/Adaco** (developer.fourth.com) — odvojeni resursi Inventory, Requisitions, Vendor, Sales-Item, Events, Product Catalog.

**Hijerarhija lokacija (rekurzivna, ne fiksan enum):**
```
Centralni magacin
  → Komisarijat/proizvodnja
    → Objekat (property)
      → Restoran/bar | Housekeeping magacin | Spa/retail
        → Soba — minibar (mikro-lokacija)
```
Mali hotel instancira 2 nivoa, resort/lanac ceo tree.

**Univerzalni transakcioni primitivi:** Item, Location (rekurzivno), Vendor, Purchase Order, Receipt (3-way match), Transfer/Requisition (GL cross-charge), Recipe/BOM, Production Batch (sirovina→gotov proizvod), Depletion/Waste Adjustment (odvojen tip transakcije — ključno za ideal-vs-actual food cost), Invoice/3-way match.

Food cost formula (izvedeno polje, ne ručni unos):
```
Food Cost % = (COGS / Prihod od hrane) × 100
Cena porcije = Σ(cena sastojka × količina) / broj porcija
Cena jela = Cena porcije ÷ ciljani Food Cost %
```
Cena recepture mora se automatski preračunati pri novoj fakturi → Inventory servis emituje event pri promeni cene artikla, Recipe servis se pretplaćuje.

**Housekeeping/higijenske potrepštine:** ne graditi zaseban sistem zaliha — Flexkeeping/Optii su orkestracija zadataka, ne knjiga stanja; čitaju/pišu preko API-ja ka istom Inventory servisu, drugi cost-center i grana lokacijskog stabla.

**Centralna kuhinja (lanci):** centralna nabavka (EDI/cXML) → standardizovana receptura sa skaliranjem → Production Batch (prinos/otpad) → Transfer/Requisition ka objektima.

EDI standardi: EDI (batch, veliki distributeri), cXML (pun ciklus punchout→korpa→PO→faktura, preferiran), OCI (samo katalog/korpa, SAP okruženje).

## 7. Housekeeping i održavanje (CMMS)

Kanonski model statusa sobe (Oracle OHIP):
```
PUT /hsk/v1/hotels/{HotelId}/rooms/status
{
  "roomList": [{ "roomId": "112" }],
  "housekeepingStatus": "Occupied",        // Occupied | Vacant
  "housekeepingRoomStatus": "Clean"        // Clean | Dirty | Inspected | Pickup
}
```
Out-of-Order/Out-of-Service su odvojene operacije. Svi housekeeping alati (Optii, Flexkeeping, Quore, HotSOS) mapiraju na ovaj obrazac.

Podela: Housekeeping tabla (deo PMS jezgra, real-time izvor istine) / Task orkestracija (zaseban servis, ML procena vremena) / CMMS (kod malih ugrađeno, kod velikih standalone: Limble, MPulse) / Lost & Found (modul kod malih, Chargerback kod lanaca).

Radni nalog održavanja često se automatski kreira iz housekeeping toka (sobarica označi kvar → status Maintenance Hold → CMMS event kreira work order).

## 8. Kontrola pristupa i IoT

**Nema univerzalnog protokola** — svaki proizvođač ima zatvoren protokol.

| Proizvođač | Proizvod | Integracija | Javni API |
|---|---|---|---|
| ASSA ABLOY | VingCard Vostio/Visionline | Vostio: 200+ REST + Kinesis; VConnect novi standard | delimično javno |
| dormakaba | Saflok/Ambiance | SOAP; mobilni ključ preko MAIP (BLE SDK, LEGIC Connect) | partner-gated |
| Salto | Space(SVN)/KS(cloud)/SVN-Flex | KS Core API — Locks, Accessors, AccessGroups, remote unlock | **javno, OpenAPI** |
| Onity | HT/Advance + OnPortal + DirectKey | Proprietary PMS Protocol V9; IoT Gateway | zatvoreno |

**Middleware obavezan:** PMS/gost app → adapter sloj (sopstveni ili Seam-stil agregator) → vendor cloud (Vostio/Salto KS/dormakaba/Onity) → fizička brava/telefon (BLE/NFC).

Online vs offline vs hibridno: offline (data-on-card, jeftino, opoziv zahteva fizički obilazak) / online (ožičeno/BLE mesh, trenutni opoziv, skuplje) / hibridno (Salto SVN-Flex, čest kompromis).

**Minibar:** Bartech (IR/magnetni/mikroprekidač, BarTouch Cloud za ručne), Minibar Systems SmartCube (IR bez pokretnih delova). Nema javnog REST API-ja kod bilo kog — zatvorena, PMS-vendor-pregovarana integracija. Mehanizam: senzor detektuje uklanjanje → prozor potvrde → knjiženje na folio → flag za dopunu samo aktivnih soba.

**Energetski menadžment:** Telkonet EcoSmart (20–40% ušteda), INNCOM/Honeywell (25–40%, poboljšano signalom sa brave), Verdant VX (~40%, pokret+telesna toplota). Brava i EMS ne moraju komunicirati direktno — oba objavljuju evente na zajedničku magistralu.

**Biometrija:** i dalje pilot/manjinski slučaj — check-in kiosci (prepoznavanje lica), amenity pristup (spa/gym), staff/back-of-house (najzrelija primena, otisak prsta).

**Back-of-house pristup:** odvojen sloj, ista platforma proširena na kuhinju/magacin/kasu ili elektronski key cabinet (Morse Watchmans). Hijerarhija: grand master → floor master → sub-master → individualni ključ, pun audit trag.

**Obavezna veza sa protivpožarnim sistemom** (NFPA 72/101 ili lokalni ekvivalent): brave moraju imati definisan relej interfejs koji ih prisilno otključava pri alarmu — zakonski zahtev, ne opcija.

## 9. Spa, wellness, gym, bazen

Relevantno pretežno resort/luksuzni segment.

| Sistem | Fokus | API |
|---|---|---|
| Book4Time (Agilysys) | Enterprise/multi-property, 80+ integracija | otvoren, partner-gated |
| Zenoti | All-in-one SaaS | **javno** (docs.zenoti.com) |
| SpaSoft (Agilysys) | Destinacijski resort | partner-gated |
| Mindbody | Fitnes studio, ne-PMS-nativan | partner approval |

Zajednički presek: rezervacija termina (multi-resurs), osoblje, retail POS, članstva, naplata na folio + deljen gost profil.

Bazen/cabana (RealTime Reservation, Beachy, STAY) — zaseban proizvod za plažne resorte. Gym pristup ide kroz isti RFID/BLE sistem kao soba; časovi kroz "Classes" modul spa platforme.

## 10. Gostinski servisi

Messaging: Akia, Whistle (Cloudbeds), ALICE. In-room tablet: SuitePad, Intelity. Request management i Lost & Found konvergiraju sa istim tiket/task backbone-om kao housekeeping — ne treba zaseban data model, samo zajednički Task/Request servis sa poljem "poreklo" (guest-initiated vs staff-initiated).

## 11. Aktivnosti, izleti i eksterno prisustvo eventima

Pored sobe, gost često rezerviše nešto van hotela — izlet, turu, radionicu — ili samo prisustvuje konferenciji koja se ne dešava u samom hotelu. Ovo je treći tip "rezervacije" pored sobe i spa/F&B termina, sa ključnom razlikom: fulfillment najčešće radi **eksterni** partner.

**Novi entitet — Activity Booking** (sestrinski Room Reservation-u, vezan na `reservation_id` radi konteksta/naplate):
```
activity_type:  excursion | tour | class | conference_session | external_event
source:         internal | external_operator | external_marketplace | external_reference_only
provider_ref:   Vendor ID (isti entitet kao u nabavci, uloga "activity_provider") ili tekst
schedule, capacity, price, payment_mode: folio_charge | external_payment | referral_commission
external_booking_reference: broj potvrde u sistemu partnera — ne normalizovati tuđi model u sopstveni
status:         requested | confirmed | waitlisted | cancelled | completed | no_show
meeting_point
```

**Tri sloja integracije** (analogno kanal menadžeru za sobe, pogl. 4):
- **Sloj A — standardizacija ponude:** OCTO standard (Open Connectivity for Tours, Activities & Attractions, octo.travel) — usvojen kod Ventrata, Bókun, Zaui. Jedan protokol umesto N custom integracija po operateru.
- **Sloj B — marketplace/tražnja:** Viator Partner API (affiliate vs. merchant tier), GetYourGuide Partner API, Klook Open API — kad hotel nema direktnu vezu sa lokalnim operaterom.
- **Sloj C — agregacija za osoblje:** ALICE (kurirani linkovi/itinerar, bez live inventara) ili Rezgo (pravi multi-supplier reseller sa cenovnicima/proviziom) — interfejs koji concierge stvarno koristi.

Direktna integracija na pojedinačnog operatera (Bókun/FareHarbor/Rezdy Supplier API) opravdana je samo kad hotel ima sopstvenog/ekskluzivnog partnera visokog volumena. Realan podrazumevani obrazac danas je lakši od idealnog — kurirani affiliate linkovi koje concierge ručno održava, ne prava real-time API agregacija.

**Tri režima naplate:**
| Režim | Tok | Folio |
|---|---|---|
| Referral/affiliate | Gost plaća OTA direktno, hotel prima proviziju | nema interakcije |
| Concierge resale | Concierge rezerviše preko reseller portala (Rezgo) | ručno knjiženje kao razna stavka |
| In-stay marketplace sa postback | Duve↔SPATYNGO, Nonius↔Book4Time | automatski, ista PMS charge-posting mehanika kao F&B/spa |

Treći režim je danas dokazan uglavnom za spa (single-property dobavljači); ture uključuju eksterne merchant-of-record subjekte pa je direktan folio postback redak u praksi.

**Eksterna konferencija (gost je učesnik, ne hotel domaćin):** obrnut slučaj od MICE modula. Platforme za registraciju učesnika (Eventbrite API, Cvent Registration API/Attendee Hub, Bizzabo, RegFox) nemaju smislen integracioni obrazac sa hotelskim sistemima — učesnik je kupac organizatora eventa. **Preporuka: ne graditi API integraciju** — tretirati kao metapodatak na Guest Profile/Reservation (naziv eventa, datumi, broj bedža) + opcioni concierge/transport zadatak.

**Gost itinerar — agregacija, ne novi izvor istine:** "Itinerar gosta" (obrazac ALICE/Duve/Nonius) nije nova baza koja poseduje sve podatke — agregovani je prikaz koji sastavlja Room Reservation + Spa Booking + F&B rezervacija + Activity Booking + eksterne event beleške u jedan timeline. Svaki podsistem ostaje vlasnik svojih podataka; poseban Itinerary read-servis samo čita i sastavlja preko event magistrale (isti "thin event + fetch full state" obrazac).

Referentni vendori: Bókun (bokun.dev, javno), FareHarbor (developer.fareharbor.com, javno), Rezdy (developers.rezdy.com, javno), Ventrata/OCTO (docs.ventrata.com, javno), Viator Partner API (docs.viator.com/partner-api, javno), GetYourGuide Partner API (code.getyourguide.com, javno), Klook Open API (klook.gitbook.io/openapi, javno), ALICE i Rezgo (partner-gated), Duve/Nonius (partner-gated integracije za spa folio postback).

## 12. MICE (konferencije/eventi)

Relevantno samo za poslovni/resort/luksuzni segment. **Cvent** (Event Cloud + Hospitality Cloud/Passkey, javan REST na api-platform.cvent.com, OAuth2, SDK-ovi za TS/.NET/Java). **Amadeus Delphi** (sales & catering na Salesforce-u, deo Amadeus Hospitality Developer Portala).

Ključni entitet: Banquet Event Order (BEO) — vezuje sale + catering + naplatu; guestroom block/pattern za grupne rezervacije.

## 13. Model podataka — zajednički entiteti

| Entitet | Sadrži | Napomena |
|---|---|---|
| Property | Hotel/objekat | Koren tenant granice |
| Room/Room Type | Fizička soba + kategorija | Room Type = jedinica cene/raspoloživosti |
| Rate Plan | Pravila cene, restrikcije | Ugnježden pod Rate Group |
| Reservation | Gost+soba+datumi+status | booked→checked-in→checked-out→cancelled/no-show |
| Guest Profile | PII, ID, preferencije | Dedup + GDPR pristanak kao prvorazredna polja |
| Folio/Invoice | Finansijska knjiga po boravku | Akumulira naplate iz POS/spa/minibar |
| Inventory Item | Prodajni/potrošni artikal | Deljen sa nabavka/magacin domenom |
| Employee/Staff | Nalozi, uloge | Jedinstven ID po zaposlenom (PCI-DSS 7/8) |
| Task/Work Order | Housekeeping/održavanje | Često okinut promenom statusa sobe |
| Activity Booking | Izlet/tura/eksterni event vezan za boravak | Sestrinski entitet Reservation-u, vidi pogl. 11 |

Minimalna v1 sinhronizaciona površina: rezervacije, cene, raspoloživost, folio, gost profil.

## 14. Integracioni obrazac — event-driven arhitektura

Webhook standard (Cloudbeds: 35+ tipova, apaleo: Webhooks API). Isporuka: 2xx u ~2s, retry 1min do 5 pokušaja, tanak payload (tip, ID, timestamp) + fetch-full-state.

**Primer lanca — minibar → folio → housekeeping:**
```
Minibar senzor --item_removed--> Integracioni adapter
Adapter --minibar.item_consumed--> Event magistrala
Magistrala --deliver--> Folio servis (knjiži naplatu)
Folio servis --folio.charge_added--> Magistrala
Magistrala --deliver--> Housekeeping servis (kreira task)
Housekeeping --task.created--> Mobilna app sobarice
```
Bez ijedne direktne (tesno spregnute) veze između minibar adaptera i housekeeping servisa.

Kafka (trajna magistrala, replay, napaja real-time servise + data lake) vs RabbitMQ (interna dispečerizacija zadataka point-to-point).

## 15. Multi-tenant strategija

| Strategija | Izolacija | Trošak | Kad |
|---|---|---|---|
| Silo (baza po tenantu) | najviša | visok | Enterprise, strogi zahtevi |
| Pool (tenant_id + RLS) | srednja | nizak | Mali/srednji — podrazumevano |
| Schema-per-tenant | srednja-viša | srednji | Prelazni nivo za rastuće lance |

Preporuka: hibrid — pool+RLS podrazumevano, dedicated schema/baza za enterprise tier. Tenant resolution na API gateway sloju, ne razbacano po servisima.

## 16. Bezbednost i usklađenost

**PCI-DSS 4.0.1:** segmentacija mreže (plaćanja izolovana od PMS/WiFi/IoT), tokenizacija (folio čuva samo token), jedinstven ID po zaposlenom. Tok: kartica → gateway (Adyen/Stripe) → token → folio.

**GDPR:** primenjuje se na svakog EU gosta. Guest Profile treba prvorazredna polja za pristanak/retenciju/brisanje. Brisanje mora kaskadno propagirati kroz sve integrisane sisteme.

**Srpsko tržište — tri nezavisna sistema:**
- **Fiskalizacija** — real-time preko PFR-a (L-PFR lokalno / V-PFR virtuelno). Folio modul treba pluggable fiskalni adapter, sinhron poziv pri svakoj naplati.
- **SEF/e-Faktura** (efaktura.gov.rs) — B2B/B2G, obavezno od 1.4.2026 za firme iznad praga; uskoro e-otpremnice. Zaseban adapter od fiskalizacije, za korporativno/agencijsko fakturisanje.
- **eTurista** (eturista.gov.rs) — obavezna prijava gostiju + boravišna taksa. Batch integracija dovoljna (do 26h za integrisane sisteme naspram 2h ručno).

**Pristupačnost:** WCAG 2.1 AA za booking flow; podaci o pristupačnim sobama kao strukturirana polja, ne slobodan tekst.

## 17. Preporuke za tehnološki stek

| Sloj | Preporuka | Obrazloženje |
|---|---|---|
| API površina | REST/JSON + OpenAPI 3.0, OAuth2 | De facto standard (Mews, apaleo, Cloudbeds, Zenoti, Cvent) |
| Event magistrala | Kafka / managed ekvivalent | Replay, event sourcing, real-time + data lake |
| Interni task queue | RabbitMQ / Kafka consumer groups | Point-to-point dispečerizacija |
| Arhitektura servisa | Modularni monolit → selektivna ekstrakcija | Niža operativna složenost na startu |
| Multi-tenancy | Pool+RLS podrazumevano, silo enterprise | Balans troška i izolacije |
| Plaćanja | Tokenizacija preko PCI-DSS gateway-a | Smanjuje sopstveni compliance obim |
| Kontrola pristupa | Sopstveni adapter po vendoru + opciono agregator | Nema univerzalnog protokola |
| Fiskalizacija/SEF/eTurista | Pluggable compliance adapter po zemlji | Različit ritam i pravni zahtevi |

## 18. API reference (konsolidovano)

Pun spisak sa statusom dostupnosti: videti artifact, poglavlje 17. Ključni javno dokumentovani API-ji za direktno modelovanje:
- `docs.oracle.com/en/industries/hospitality/integration-platform` (OHIP)
- `github.com/oracle/hospitality-api-docs`
- `docs.mews.com/connector-api`
- `apaleo.dev`
- `developers.cloudbeds.com`
- `api-docs.clock-software.com`
- `doc.toasttab.com/doc/devguide/apiTenderPmsIntegration.html`
- `developer.fourth.com` (Adaco Inventory/Requisitions/Vendor/Sales-Item/Events)
- `developer.saltosystems.com/ks/core-api`
- `docs.seam.co`
- `docs.zenoti.com`
- `developers.cvent.com`
- `docs.adyen.com`, `docs.stripe.com/terminal`
- `efaktura.gov.rs`, `eturista.gov.rs`
- `octo.travel`, `bokun.dev`, `developer.fareharbor.com`, `developers.rezdy.com`, `docs.ventrata.com`, `docs.viator.com/partner-api`, `code.getyourguide.com`, `klook.gitbook.io/openapi`

## 19. Matrica modula po tipu hotela

Pun prikaz (20 modula × 5 tipova hotela): videti artifact, poglavlje 19.

## 20. Predloženi fazni plan

1. **Faza 1 — jezgro:** Rezervacije, front desk, folio, housekeeping tabla, gost profil, prost magacin. Pokriva budget/boutique.
2. **Faza 2 — F&B i nabavka:** POS integracija (Toast Tender obrazac), pun nabavka/magacin domen, event magistrala.
3. **Faza 3 — pristup i IoT:** Middleware za brave (start sa Salto zbog javnog API-ja), minibar i energetski adapteri.
4. **Faza 4 — usklađenost (RS):** Fiskalizacija, SEF e-Faktura, eTurista, PCI-DSS tokenizacija, GDPR cascade-delete.
5. **Faza 5 — resort moduli:** Spa/wellness, MICE, agregacija aktivnosti/izleta (concierge sloj), centralna kuhinja, multi-tenant za lance.

Svaka faza nezavisno isporučiva zahvaljujući modularnom monolitu — granice domena moraju biti jasne od početka, ne moraju svi moduli postojati odjednom.
