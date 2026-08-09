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

## 15. Paketiranje putovanja — integracija sa aplikacijom za letove i transfere

Cilj: gost kupuje hotel + let + transfer kao jedan paket, ali to su dve nezavisne aplikacije (Terminal Hotel i aplikacija za letove/transfere) sa sopstvenim bazama. Industrijski termin: **dynamic packaging** — real-time sastavljanje leta+smeštaja+prevoza u jednu kupovinu.

**Ključna odluka: treći, nezavisan orkestracioni servis.** Paketizacija se ne ugrađuje ni u hotel PMS ni u flights/transfers aplikaciju — dobija sopstveni Package/Trip orkestracioni servis sa sopstvenom bazom. Isti obrazac koriste svi realni dynamic-packaging sistemi (Traveltek, Juniper Booking Engine, Expedia paket sloj). Razlozi: (1) Saga orkestracija je poseban concern koji ne pripada ni jednom od dva domenska modela; (2) otvara vrata trećem/četvrtom proizvodu kasnije (npr. aktivnosti preko OCTO-a) bez diranja postojećih aplikacija; (3) izoluje failure modove orkestratora od produkciono-kritičnih gostinskih sistema; (4) obe aplikacije ostaju prodajive samostalno.

**Saga tok (orkestracioni stil, ne choreography):**
```
1. HOLD (paralelno):
   Orkestrator → Hotel PMS:     hold (TTL)           → held + hold_expires_at
   Orkestrator → Flights app:   hold order (NDC)      → order_id + payment_required_by
   Orkestrator → Transfer app:  book (obično instant)  → booking_id

2. Kombinovana cena → jedna naplata gosta

3. CONFIRM (paralelno):
   Orkestrator → Hotel PMS:     confirm(hold_id)  → confirmed
   Orkestrator → Flights app:   pay(order_id)      → confirmed

4. AKO BILO KOJA NOGA NE USPE → kompenzacija obrnutim redosledom:
   cancel order (refund) → cancel/release hold
```
Let ima najkraći i najskuplji hold pa se po pravilu drži prvi. Orkestrator drži trajno stanje sage: `pending_holds → holds_confirmed → payment_captured → legs_confirmed → complete`, ili `→ compensating → compensated`. Ako TTL istekne pre potvrde, hotel/let automatski oslobađaju drženu jedinicu bez čekanja na orkestrator.

**Bitna asimetrija:** hotel i let podržavaju eksplicitan hold-pa-confirm; mnogi dobavljači transfera ne — transfer je često dovoljno jeftin/fleksibilan da dobavljači odmah potvrđuju sa besplatnim otkazivanjem. Kompenzacija za transfer nogu je zato obično "cancel", ne "release hold".

**API ugovor koji Hotel PMS mora izložiti** (isti oblik kao Duffel offer/hold/order i Mews state model):

| Endpoint | Svrha | Efekat na Reservation |
|---|---|---|
| `POST /package-quotes` | Cena/raspoloživost bez efekta na inventar (kao Duffel `offers.get` / NDC OfferPrice) | — |
| `POST /reservations/hold` | Kreira rezervaciju sa TTL-om, **stvarno umanjuje** raspoloživ inventar | status → `held`, postavlja `hold_expires_at` |
| `POST /reservations/{id}/confirm` | Poziva orkestrator tek posle uspešne naplate i potvrde svih nogu | status → `confirmed` |
| `POST /reservations/{id}/cancel` | Kompenzaciona akcija — mora biti idempotentna | status → `cancelled` |
| Pozadinski TTL sweep | Auto-oslobađa `held` rezervacije posle `hold_expires_at`, bez čekanja na orkestrator | status → `expired` |

**Promene u Reservation state machine:**
```
held (TTL) ──confirm──> confirmed ──check-in──> checked_in ──check-out──> checked_out
   ├──TTL istekao (auto)──> expired
   └──cancel (kompenzacija)──> cancelled
```
Novo polje `external_package_id` nosi referencu ka Package zapisu u orkestratoru — ne normalizovati tuđi model (isti princip kao `external_booking_reference` kod Activity Booking-a). `source` enum proširen vrednošću `package`.

**Naplata:** `folio.owner_type` proširen vrednošću `package_operator` — kad paket naplaćuje orkestrator odjednom, folio i dalje prati potrošnju u hotelu (F&B, minibar) ali se ne očekuje direktna naplata na recepciji za deo pokriven paketom.

**Standardi na strani leta i transfera** (za dogovor sa timom druge aplikacije):
- **Letovi:** IATA NDC (Offer/Order model) — direktna veza na svaku avio-kompaniju nije opravdana; realan put je preko agregatora. **Duffel** (duffel.com/docs) — 300+ prevoznika, čist REST, ugrađen hold/pay-later (`expires_at`, `payment_required_by`) — najbolji referentni model za MVP. Alternativa pri većem volumenu: Amadeus Flight Create Orders, Sabre NDC OrderCreate.
- **Transfer:** **OCTO** standard (isti kao za izlete/aktivnosti, proširen i na transfer/multi-stop). Agregator: **Mozio** (mozio.com/business-partners, 100+ dobavljača, 3500+ aerodroma) ili CarTrawler (docs.cartrawler.com).

## 16. Multi-tenant strategija

| Strategija | Izolacija | Trošak | Kad |
|---|---|---|---|
| Silo (baza po tenantu) | najviša | visok | Enterprise, strogi zahtevi |
| Pool (tenant_id + RLS) | srednja | nizak | Mali/srednji — podrazumevano |
| Schema-per-tenant | srednja-viša | srednji | Prelazni nivo za rastuće lance |

Preporuka: hibrid — pool+RLS podrazumevano, dedicated schema/baza za enterprise tier. Tenant resolution na API gateway sloju, ne razbacano po servisima.

## 17. Bezbednost i usklađenost

**PCI-DSS 4.0.1:** segmentacija mreže (plaćanja izolovana od PMS/WiFi/IoT), tokenizacija (folio čuva samo token), jedinstven ID po zaposlenom. Tok: kartica → gateway (Adyen/Stripe) → token → folio.

**GDPR:** primenjuje se na svakog EU gosta. Guest Profile treba prvorazredna polja za pristanak/retenciju/brisanje. Brisanje mora kaskadno propagirati kroz sve integrisane sisteme.

**Srpsko tržište — tri nezavisna sistema:**
- **Fiskalizacija** — real-time preko PFR-a (L-PFR lokalno / V-PFR virtuelno). Folio modul treba pluggable fiskalni adapter, sinhron poziv pri svakoj naplati.
- **SEF/e-Faktura** (efaktura.gov.rs) — B2B/B2G, obavezno od 1.4.2026 za firme iznad praga; uskoro e-otpremnice. Zaseban adapter od fiskalizacije, za korporativno/agencijsko fakturisanje.
- **eTurista** (eturista.gov.rs) — obavezna prijava gostiju + boravišna taksa. Batch integracija dovoljna (do 26h za integrisane sisteme naspram 2h ručno).

**Pristupačnost:** WCAG 2.1 AA za booking flow; podaci o pristupačnim sobama kao strukturirana polja, ne slobodan tekst.

## 18. Preporuke za tehnološki stek

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

## 19. Ljudski resursi i radna snaga

Imamo `Employee`/`Role`, ali nedostaje raspored smena, evidencija radnog vremena, i veza sertifikacija-zaposlenog sa dodelom zadataka. Potvrđen obrazac kod realnih WFM vendora (Hotel Effectiveness/Actabl PerfectLabor™, Legion, Deputy, When I Work): **occupancy podaci iz PMS-a → forecasting engine → radni standard po ulozi/odeljenju → auto-generisan raspored → mobilna aplikacija → timesheet → payroll export.**

- **Raspoređivanje:** Hotel Effectiveness/Actabl povezuje forecasting i produktivne standarde direktno sa occupancy podacima; 2026 integracija sa ProfitSword pokazuje da status sobe (housekeeping tabla) direktno menja potrebu za osobljem u realnom vremenu.
- **Evidencija rada:** nije pronađen hotelski lock vendor koji nativno radi time&attendance, ali UKG-ovi terminali imaju potvrđen "door relay" — hardverski dokazana izvodljivost istog kredencijala za vrata i evidenciju. Tretirati kao **sopstvenu arhitektonsku odluku**: Time Clock Event servis se pretplaćuje na access-control evente (pogl. 8) umesto paralelnog hardvera.
- **Payroll:** realan obrazac je izvoz odobrenih sati po ciklusu (ADP, UKG, Paychex), ne live API — isti adapter princip kao GL export i fiskalizacija.
- **Sertifikacije:** Quore University i Mapal OS pokrivaju compliance treninge, ali nijedan vendor javno ne dokumentuje "istekla sertifikacija blokira dodelu smene" — realna prilika za diferencijaciju, modelovati kao flag koji Task/Shift servis proverava pri dodeli.

**Novi entiteti:** `Shift` (property_id, employee_id nullable, role_id, start_at, end_at, status: open|assigned|confirmed|completed|no_show|cancelled, forecast_source), `TimeClockEvent` (employee_id, property_id, event_type: clock_in|clock_out|break_start|break_end, occurred_at, source: badge|biometric|manual|mobile, device_reference), `StaffCertification` (employee_id, certification_type, issued_at, expires_at, verified_by_employee_id, document_reference).

## 20. Offline rad front deska

**Nalaz istraživanja:** ni Oracle OPERA Cloud, ni Mews, ni (najverovatnije) Cloudbeds nemaju verifikovan pravi offline režim. Mews eksplicitno preporučuje zakazane "emergency reports" (satni izvoz) kao papirnu rezervu; Cloudbeds preporučuje "grab-and-go" štampane pakete; Oracle-ova dokumentacija ne pominje offline režim uopšte. Otpornost kod sve tri je **operativna, ne arhitektonska**.

Jedan verifikovan arhitektonski presedan: **BookingCenter Hybrid PMS** — lokalni Desktop PMS na objektu obrađuje check-in/out/naplatu offline, sa auto-sinhronizacijom po povratku veze.

| Pristup | Šta znači | Kada ima smisla |
|---|---|---|
| Cloud-only + operativna ublažavanja | Zakazan izvoz kritičnog stanja (dolasci, otvoreni folio) u lokalni snapshot; ručna procedura za period nedostupnosti | **v1/MVP** — isti rizik koji Oracle/Mews/Cloudbeds prihvataju danas |
| Lokalni cache-node + eventual sync | Embedded DB na objektu za offline check-in/out/folio, sync + konflikt rezolucija po povratku | Kasnija faza, diferencijator — opravdan trošak samo za lokacije sa nepouzdanim internetom |

**Preporuka za v1:** prva opcija. Druga se dokumentuje kao namerna buduća mogućnost, ne gradi se preventivno.

## 21. Finansije i KPI izveštavanje

**Standardne formule (USALI/HFTP):** Occupancy% = Prodate sobe ÷ Raspoložive; ADR = Prihod od soba ÷ Prodate sobe; RevPAR = ADR × Occupancy% = Prihod od soba ÷ Raspoložive sobe; TRevPAR = Ukupan prihod objekta ÷ Raspoložive sobe; GOPPAR = Bruto operativni profit ÷ Raspoložive sobe (tačna GOP definicija kroz USALI standard — proveriti priručnik za implementaciju).

**STR Global (CoStar):** de facto benchmark naspram konkurentskog seta (STAR Report, 100=paritet). Potvrđen hibridni prijem podataka (API/SFTP/email/ručno) — API specifikacija nije javno verifikovana, modelovati kao pluggable export adapter (dnevni batch), ne pretpostaviti REST poziv.

**GL export:** nema jedinstvenog formata kroz industriju. PMS emituje kanoničan "journal entry" event pri noćnom auditu → adapter po knjigovodstvenom sistemu (QuickBooks/Xero, Sage Intacct, **M3 Accounting Core** — 70+ potvrđenih integracija, Aptech PVNG). Isti princip kao fiskalizacija/SEF adapteri (pogl. 17).

**Vlasnički izveštaji/budžetiranje:** M3 je najbogatiji referentni sistem (multi-property GL, budget/forecast, portfolio vidljivost); Actabl Transcendent za asset-management. Razlikovati revenue/rate forecasting (IDeaS/Duetto, pogl. 4) od P&L budžetiranja (M3).

**Novi entitet:** `JournalEntry` (property_id, business_date, gl_account_code, debit_amount, credit_amount, department, description, source_reference nullable → folio_line_item), generisan pri noćnom auditu.

## 22. Opšti audit log platforme

Ko je šta menjao kad, kroz ceo sistem — bitno za SOC 2 spremnost s obzirom da platforma već nosi PCI-DSS/GDPR/fiskalizaciju.

**Ne pun event sourcing** — event magistrala (pogl. 14) postoji radi integracije, ne audita. Realan, lakši obrazac (potvrđen u Microsoft/AWS arhitektonskim smernicama): normalne CRUD tabele ostaju sistem zapisa, svaka mutacija upisuje red u odvojenu, append-only `audit_event` tabelu, u istoj transakciji.

**Preporučena šema:** `organization_id` (tenant izolacija, ista RLS politika), `actor_employee_id`/`actor_type` (employee|system|api_key), `action`/`resource_type`/`resource_id`, `before`/`after` (JSONB — **bez PII direktno**, samo `guest_profile.id` referenca), `prev_event_hash`/`event_hash` (hash-lanac za tamper-evidence).

**GDPR sukob:** append-only log je u sukobu sa pravom na brisanje. Rešenje (Microsoft/AWS smernice za Event Sourcing): čuvati PII van audit loga, samo referencu po ID-u — isti princip kao `gdpr_deleted_at` na `guest_profile`.

**SOC 2 minimum:** logovati autentikaciju, dodelu privilegija, promene konfiguracije, izvoz podataka; retencija min. 12 meseci hot + hladno skladište dalje; tamper-evidence obavezan (hash-lanac dovoljan).

## 23. HACCP i bezbednost hrane

Odvojeno od food-cost praćenja (pogl. 6) — bezbednost, ne troškovi. HACCP = sedam principa po EU Regulativi 852/2004 čl. 5(2): identifikacija opasnosti, CCP identifikacija, kritični limiti (frižider ≤5°C, zamrzivač ≤-18°C, kuvanje ≥75°C), monitoring procedure, korektivne akcije, verifikacija, dokumentacija.

**Pravni osnov:** obavezno u EU (852/2004 čl. 5); u Srbiji Zakon o bezbednosti hrane čl. 47 (obaveza po objektu), čl. 48 (kvalifikovano lice), čl. 73 (inspekcija), čl. 79 (kazne 300.000–3.000.000 RSD).

**Vendori:** FoodDocs (auto HACCP plan, otvoren API za senzore), Jolt (temperaturni senzori/alarmi), Trail (food safety + fire safety + incident u istoj platformi), SafetyCulture/iAuditor (javan developer API).

**Novi entiteti:** `HaccpCcpLog` (property_id, ccp_type, location_reference, reading_value, unit, threshold_min/max, occurred_at, staff_employee_id, pass_fail), `CorrectiveAction` (linked_log_id ili linked_incident_id — deljen sa pogl. 24, action_taken, resolved_by_employee_id, resolved_at), `SupplierCertificate` (vendor_id → nabavka pogl. 6, cert_type, issuing_body, expiry_date, document_reference). Deli IoT senzor infrastrukturu sa energetskim menadžmentom (pogl. 8).

## 24. Nezgode i bezbednosni incidenti

Nema formalnog modula za povredu gosta/radnu nezgodu — samo generički `Task`. Nije duboko ugrađeno u glavne ops platforme (Quore, HotSOS, ALICE) — pravi risk-management alati su horizontalni: **SafetyCulture**, **Origami Risk** (RMIS/EHS/GRC), **Intelex** (EHS), ili hospitality checklist app (**Trail**). Ovo je stvaran, potvrđen tržišni gap — vredi sopstvenog modula sa čistom integracionom tačkom ka RMIS sistemu grupe (podaci moraju ići i ka osiguranju/pravnoj službi).

**Novi entitet:** `IncidentReport` (property_id, incident_type: guest_injury|workplace_accident|security|property_damage|other, occurred_at, location, involved_guest_id/involved_employee_id nullable, description, severity, evidence_refs jsonb, root_cause, status, reported_by_employee_id, insurance_claim_reference nullable). Koristi isti `CorrectiveAction` entitet kao HACCP.

## 25. Korporativni ugovori i RFP

Pregovarane korporativne cene su drugačije od dinamičkih OTA kanala (pogl. 4) — kompanija dobija fiksnu popust cenu na osnovu godišnjeg ugovora.

**Tehnički obrazac:** korporativna cena je RatePlan sa ograničenom vidljivošću vezan za `CorporateAccount`, gost unosi korporativni kod pri rezervaciji. **Last Room Availability (LRA)** je ključna razlika — ugovorna garancija da cena ostaje dostupna čak i kad je hotel popunjen; zahteva override flag koji zaobilazi stop-sell/min-LOS/closed-to-arrival logiku specifično za LRA-označene planove — stvarna integraciona tačka sa RMS-om, ne samo popust polje.

**RFP softver:** **Cvent** ima zaseban proizvod "Win Corporate Travel" (odvojeno od MICE Cvent proizvoda iz pogl. 12) — upravljanje RFP-ovima, distribucija cena, praćenje performansi, 155.000+ travel menadžera u mreži. HotelPlanner pokriva samo grupne/event upite, ne korporativni RFP ciklus.

**Proširenje šeme:** nov entitet `CorporateAccount` (company_name, contract_start, contract_end, access_code); nova polja na postojećem `rate_plan` (pogl. 13): `corporate_account_id` (nullable FK) i `last_room_availability` (boolean).

## 26. Održivost / ESG izveštavanje

Nadovezuje se na energetski menadžment (pogl. 8), ali fali izveštajni sloj. Sertifikacije: **Green Key** (FEE, 9.000+ objekata/90+ zemalja), **EarthCheck**, **Green Globe** (kriterijumi po ISO 21401), **LEED** (opšti građevinski standard).

**Softver/standardi:** **Greenview Portal** — realan ESG softver za hotelijerstvo, prati Scope 1/2/3 karbon (Hotel Footprinting Tool), benčmarkuje preko Cornell CHSB Index-a. **HCMI** (Hotel Carbon Measurement Initiative) — potvrđen standard (Sustainable Hospitality Alliance + WTTC, na GHG Protocol osnovi), karbon po zauzetoj sobi po danu.

**Zaključak:** izveštajni sloj iznad postojećih energy-IoT podataka, ne nov operativni podsistem — gap je standardizovana export šema (HCMI, HWMI) plus feed za vodu/otpad. EU CSRD direktiva je realna i aktivna, ali direktan zahtev prema hotelima kao dobavljačima nije potvrđen istraživanjem — tretirati kao verovatan trend, ne potvrđen mandat.

**Novi entiteti:** `EsgMetric` (property_id, metric_type: energy|water|waste|carbon, period_start/end, value, unit, source: iot_sensor|manual), `Certification` (property_id, program: green_key|earthcheck|green_globe|leed, status, audit_date, expiry_date).

## 27. Online reputacija i recenzije

Kompletno nepokrivena kategorija do sada. **ReviewPro** (Shiji — 140+ izvora, Global Review Index™, potvrđen okidač sa Daylight PMS), **TrustYou** (CXP/CDP/Agents — **jedini sa javnim pull API-jem**, Meta-Review API, 80+ izvora), **Revinate Feedback** (već poznat CRM vendor — potvrđeno dvostruke namene, deli isti Rich Guest Profile sa CRM-om), **GuestRevu** (10.000+ objekata, ankete sa granajućom logikom), Medallia (generička enterprise CX, tanja hotel dokumentacija).

**Okidač i dubina integracije:** PMS/CRS je izvor okidača — checkout/zatvaranje folija → stay-completion event → vendor šalje automatsku anketu/zahtev za recenziju 1-3 dana kasnije. Ovo je **plitka integracija** (webhook napolje, osoblje koristi vendorov dashboard) — izuzev TrustYou-ovog pull API-ja ako se želi prikaz u sopstvenom dashboard-u. Rezultati pišu nazad u isti guest profile ID (Revinate obrazac).

**GDPR napomena:** nije definitivno rešeno da li zahtev za recenziju zahteva isti marketing opt-in kao promo email. Preporuka: koristiti postojeći `marketing_consent` flag na `guest_profile` (pogl. 13), bez novog consent podsistema.

**OTA rangiranje:** potvrđeno recenziranom studijom (2023, *IJHM*, 429.000+ recenzija) da review skor stvarno utiče na Booking.com prikaz — tačna formula je vlasnička/nedokumentovana, ali revenue posledica je realna, ne samo estetska.

## 28. Booking engine i loyalty mehanika

Pomenuli smo "booking widget" (pogl. 4) i `loyalty_tier` polje (pogl. 13), bez stvarne mehanike.

**Booking engine:** SynXis (Sabre/Aven Hospitality), **Cloudbeds Booking Engine** (javan API), **Mews Booking Engine** (javan API, potvrđeno 20% rezervacija uključuje upsell), **Triptease** (rate-intelligence sloj iznad 120+ booking engine-a, "Price Match"), **Net Affinity** (Property Cross Sell, Member Rates). Upsell pri rezervaciji je danas standard, ne diferencijator. Abandoned-cart recovery i best-rate-guarantee tipično žive u bolt-on sloju, ne u samom booking engine-u.

**Rate-parity enforcement:** RateGain, Triptease, Lighthouse (bivši OTA Insight) — svi implementiraju rate-shopping bot + rules engine + rate-push API. Nema otvorenog standarda, licencirani feed-ovi (ne sirov scraping).

**Loyalty — build vs. buy:** **Loyalty Juggernaut/GRAVTY®** — cross-vertikalni loyalty-as-a-service, Cendyn partnerstvo (nov. 2025), javna dokumentacija (`docs.gravty.io`), 400M+ članova u produkciji. Cendyn paralelno drži sopstveni lakši modul — signal da loyalty nije rešen problem čak ni za vodeći CRM vendor. Generički retail loyalty (Como, Annex Cloud) nije potvrđen u stvarnoj hotelskoj upotrebi.

**Nivoi:** realan obrazac (Hilton Honors) zahteva **OR logiku kroz više dimenzija** (noćenja ILI boravci ILI potrošnja), ne jedan prag.

**Points ledger:** append-only nepromenljiv ledger (earn/redeem/expire/adjust), atomska naplata uz row-level lock, FIFO isticanje, hold period dok boravak ne postane nepovratan, keširan saldo (denormalizovan, osvežen iz ledger-a).

**Novi entiteti:** `LoyaltyPointTransaction` (guest_profile_id, type: earn|redeem|expire|adjust, amount, source_reservation_id nullable, earned_at, expires_at, hold_until, status: pending|posted|expired), `LoyaltyTier` (tier_name, qualifying_nights/stays/spend_threshold — OR logika, benefits jsonb), `LoyaltyTierAssignment` (guest_profile_id, tier_id, effective_from/to, qualifying_period), `RedemptionCatalogItem` (name, point_cost, type: voucher|upgrade|free_night|partner_reward).

## 29. API reference (konsolidovano)

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
- `iata.org/en/programs/airline-distribution/retailing/ndc`, `duffel.com/docs`, `developers.amadeus.com/self-service/category/flights`, `developer.sabre.com`, `mozio.com/business-partners`, `docs.cartrawler.com`
- `actabl.com/labor-management-software/perfectlabor`, `ukg.com/products/features/time-and-attendance`, `str.com`, `m3as.com/accounting-core`, `bookingcenter.com/products/hybrid-pms`
- `fooddocs.com`, `developer.safetyculture.com`, `trailapp.com`, `cvent.com/en/hospitality-cloud`, `greenview.sg`, `greenkey.global`, `earthcheck.org`, `greenglobe.com`
- `resources.trustyou.com/media/trustyou-meta-review-api`, `shijigroup.com/reviewpro-reputation`, `developers.cloudbeds.com`, `docs.mews.com`, `docs.gravty.io`

## 30. Matrica modula po tipu hotela

Pun prikaz (27 modula × 5 tipova hotela): videti artifact, poglavlje 30.

## 31. Predloženi fazni plan

1. **Faza 1 — jezgro:** Rezervacije, front desk, folio, housekeeping tabla, gost profil, prost magacin. Pokriva budget/boutique. Šema od starta uključuje `held` status i `external_package_id` — paketizacija (pogl. 15) ne zahteva kasniju migraciju sheme.
   - **Paralelan track, nezavisan od faza 2–5:** implementirati `/package-quotes`, `/reservations/hold`, `/confirm`, `/cancel` i TTL sweep čim postoji realan sagovornik na strani flights/transfers aplikacije.
2. **Faza 2 — F&B i nabavka:** POS integracija (Toast Tender obrazac), pun nabavka/magacin domen, event magistrala.
3. **Faza 3 — pristup i IoT:** Middleware za brave (start sa Salto zbog javnog API-ja), minibar i energetski adapteri.
4. **Faza 4 — usklađenost (RS):** Fiskalizacija, SEF e-Faktura, eTurista, PCI-DSS tokenizacija, GDPR cascade-delete.
5. **Faza 5 — resort moduli:** Spa/wellness, MICE, agregacija aktivnosti/izleta (concierge sloj), centralna kuhinja, multi-tenant za lance.
6. **Faza 6 — poslovni sloj:** Ljudski resursi (raspored/evidencija), finansije/KPI (GL export, STR), audit log, HACCP, incidenti, korporativni ugovori/RFP, ESG, reputacija/recenzije, booking engine/loyalty. Većina ovih je nezavisna od faza 2–5 (isti "paralelan track" princip kao paketizacija) i može se raditi čim postoji poslovna potreba, ne mora čekati redosled.
7. **Trajno, van redosleda:** offline režim front deska (pogl. 20) — v1 rešenje (zakazan izvoz) ide odmah uz Fazu 1; arhitektonski lokalni cache-node gradi se tek kad konkretna lokacija to zahteva.

Svaka faza nezavisno isporučiva zahvaljujući modularnom monolitu — granice domena moraju biti jasne od početka, ne moraju svi moduli postojati odjednom.
