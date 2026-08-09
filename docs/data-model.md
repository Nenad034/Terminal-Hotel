# Data model — PMS jezgro

> Prati arhitekturu iz [`architecture.md`](./architecture.md), poglavlje 3 (PMS jezgro) i 13 (Model podataka). Izvršna šema: [`db/migrations/0001_init_pms_core.sql`](../db/migrations/0001_init_pms_core.sql) (PostgreSQL).
>
> Stek: PostgreSQL + Prisma/NestJS (videti razgovor od 2026-08-09). Multi-tenancy: pool model sa `property_id`/`organization_id` + Row-Level Security (RLS) — obrazac primenjen na `reservation` i `folio` tabele u DDL-u, isti pattern se ponavlja na sve tabele koje nose `property_id`.

## 1. Entiteti i veze — pregled

```
Organization (lanac / vlasnik)
  └─< Property (hotel)
        ├─< RoomType
        │     └─< Room
        ├─< RateGroup
        │     └─< RatePlan
        │           └─< Rate (kalendar cena po datumu/tipu sobe)
        ├─< Employee (uloga preko Role)
        ├─< GroupBlock
        │     └─< GroupBlockAllotment (po tipu sobe/danu)
        ├─< Reservation ──> GuestProfile (organization-scoped, deli se kroz lanac)
        │     ├─< ReservationStatusEvent (audit trag prelaza stanja)
        │     ├─< Folio
        │     │     └─< FolioLineItem
        │     │           └─< Payment (preko Folio, ne direktno na line item)
        │     ├─< ActivityBooking
        │     └── (Room dodeljena na check-in)
        └─< Task (housekeeping/maintenance/guest request), vezan za Room i/ili Reservation
```

Ključna odluka: **GuestProfile je organization-scoped, ne property-scoped** — gost koji boravi u dva hotela istog lanca ostaje isti zapis (dedup na nivou lanca), dok su `Reservation`, `Room`, `Folio` strogo `property`-scoped jer ne mogu postojati van jednog objekta.

## 2. Entiteti — polje po polje

### Organization / Property

| Polje | Tip | Napomena |
|---|---|---|
| `organization.id` | UUID | Koren tenant granice (lanac ili nezavisan vlasnik) |
| `organization.name` | text | |
| `property.id` | UUID | |
| `property.organization_id` | UUID FK | |
| `property.name`, `timezone`, `currency` | text/text/char(3) | `currency` je ISO 4217 podrazumevana valuta objekta |
| `property.address` | jsonb | Slobodna struktura (ulica, grad, država...) |

### RoomType / Room

| Polje | Tip | Napomena |
|---|---|---|
| `room_type.code` | text | Kratka šifra (npr. `DBL-DLX`) |
| `room_type.base_occupancy`, `max_occupancy` | int | |
| `room_type.accessible` | boolean | Prvorazredno polje, ne slobodan tekst (WCAG zahtev iz arhitekture, pogl. 16) |
| `room_type.amenities` | jsonb | |
| `room.room_number` | text | Jedinstven u okviru `property_id` |
| `room.room_type_id` | UUID FK | |
| `room.occupancy_status` | text CHECK | `vacant` \| `occupied` — nezavisno polje |
| `room.cleanliness_status` | text CHECK | `dirty` \| `clean` \| `inspected` \| `pickup` — nezavisno polje |
| `room.out_of_order`, `room.out_of_service` | boolean | Odvojeno od gornja dva polja (tačno prema OHIP obrascu iz arhitekture, pogl. 7) |

Svaka promena `occupancy_status`/`cleanliness_status` upisuje red u `room_status_event` (audit trag + izvor eventa za event magistralu kasnije).

### RatePlan / Rate

| Polje | Tip | Napomena |
|---|---|---|
| `rate_plan.code`, `name` | text | |
| `rate_plan.rate_group_id` | UUID FK nullable | |
| `rate_plan.cancellation_policy` | jsonb | npr. `{"free_until_hours": 48, "penalty_percent": 100}` |
| `rate_plan.min_los`, `max_los` | int nullable | Length-of-stay restrikcije |
| `rate_plan.closed_to_arrival`, `closed_to_departure` | boolean | Po rate plan-u; po datumu se override-uje u `rate` |
| `rate.rate_plan_id`, `room_type_id` | UUID FK | |
| `rate.stay_date` | date | Jedan red po danu — "rate calendar" obrazac |
| `rate.price` | numeric(12,2) | |
| `rate.min_los_override`, `closed_to_arrival_override` | nullable | Override na nivou datuma |

### GuestProfile

| Polje | Tip | Napomena |
|---|---|---|
| `guest_profile.organization_id` | UUID FK | Deljen kroz lanac |
| `first_name`, `last_name`, `email`, `phone` | text | |
| `id_document_type`, `id_document_number`, `nationality` | text | Bitno za eTuristu (arhitektura pogl. 16) |
| `preferences` | jsonb | |
| `marketing_consent`, `consent_recorded_at` | boolean/timestamptz | GDPR prvorazredno polje |
| `gdpr_deleted_at` | timestamptz nullable | Soft-delete marker za "pravo na brisanje" — kaskadno anonimizuje povezane zapise, ne briše fizički istoriju folija |
| `loyalty_tier`, `loyalty_number` | text nullable | |

### Reservation

| Polje | Tip | Napomena |
|---|---|---|
| `property_id` | UUID FK | |
| `confirmation_number` | text unique | Čitljiv broj za gosta |
| `primary_guest_id` | UUID FK → guest_profile | |
| `status` | text CHECK | `held \| booked \| confirmed \| checked_in \| checked_out \| cancelled \| no_show \| expired` |
| `source` | text CHECK | `direct \| ota \| gds \| phone \| walk_in \| group \| package` |
| `channel_reference` | text nullable | ID rezervacije u OTA/GDS sistemu |
| `hold_expires_at` | timestamptz nullable | Postavljeno samo kad je `status = held`; TTL sweep posle ovog trenutka prebacuje u `expired` |
| `external_package_id` | text nullable | Referenca ka Package zapisu u eksternom orkestracionom servisu (pogl. 15) — ne normalizovati tuđi model |
| `room_type_id` | UUID FK | Traženi tip (u trenutku rezervacije) |
| `room_id` | UUID FK nullable | Dodeljena fizička soba (tek na/pre check-in) |
| `rate_plan_id` | UUID FK | |
| `arrival_date`, `departure_date` | date | |
| `adults`, `children` | int | |
| `guarantee_type` | text CHECK | `credit_card \| deposit \| company \| none` |
| `group_block_id` | UUID FK nullable | |

**State machine (`reservation.status`):**

```
held (TTL, hold_expires_at) ──confirm──> confirmed ──check-in──> checked_in ──check-out──> checked_out
   │                                          │
   ├──TTL istekao (auto sweep)──> expired     └──(datum dolaska prošao, nije se pojavio)──> no_show
   └──cancel (kompenzacija)──> cancelled

booked ──confirm──> confirmed   (direktan/OTA tok bez hold faze)
   └──cancel──> cancelled
```

Svaki prelaz upisuje red u `reservation_status_event` (`from_status`, `to_status`, `occurred_at`, `actor_employee_id` nullable za sistemske prelaze poput no-show-a iz noćnog audita ili auto-expire iz TTL sweep-a).

`held` je poseban ulazni put korišćen isključivo za **paketizaciju putovanja** (poglavlje 15 arhitekture) — kad eksterni Package orkestrator (odvojen servis koji vezuje ovaj hotel sa aplikacijom za letove/transfere) privremeno drži sobu dok sastavlja i naplaćuje ceo paket. Direktne/OTA rezervacije i dalje ulaze kroz `booked`, bez hold faze.

### GroupBlock / GroupBlockAllotment

| Polje | Tip | Napomena |
|---|---|---|
| `group_block.status` | text CHECK | `tentative \| definite \| cancelled` |
| `group_block.master_account` | boolean | Da li se sve naplaćuje na jedan folio organizatora |
| `group_block.attrition_percentage` | numeric nullable | |
| `group_block_allotment.room_type_id`, `date` | FK/date | |
| `group_block_allotment.blocked_rooms`, `picked_up_rooms` | int | Prati pickup naspram ugovorenog bloka |

### Folio / FolioLineItem / Payment

| Polje | Tip | Napomena |
|---|---|---|
| `folio.reservation_id` | UUID FK | |
| `folio.folio_number` | int | Redni broj folija unutar rezervacije (1, 2, 3...) — omogućava split/route |
| `folio.owner_type` | text CHECK | `guest \| company \| group_master \| package_operator` — poslednje kad je paket već naplaćen spolja (pogl. 15), folio i dalje prati potrošnju ali se ne očekuje naplata na recepciji |
| `folio.status` | text CHECK | `open \| closed \| voided` |
| `folio_line_item.department` | text CHECK | `room \| fnb \| spa \| minibar \| activity \| tax \| other` |
| `folio_line_item.source_system` | text | `pos \| pms \| spa \| minibar \| manual` — odakle je stavka stigla |
| `folio_line_item.source_reference` | text nullable | ID transakcije u spoljnom sistemu (npr. Toast `tenderIdentifier`) |
| `folio_line_item.voided`, `voided_reason` | boolean/text | Storno ostaje u istoriji, ne briše se red |
| `payment.method` | text CHECK | `card_token \| cash \| bank_transfer \| voucher` |
| `payment.token_reference` | text nullable | **Nikad sirov broj kartice** — samo token sa gateway-a (PCI-DSS, arhitektura pogl. 16) |
| `payment.status` | text CHECK | `authorized \| captured \| refunded \| failed` |

**State machine (`folio.status`):** `open → closed` (na check-out/poravnanje) sa mogućim `→ voided` u izuzetnim slučajevima. Zatvoren folio je immutable — ispravke idu kroz nove storno/kredit stavke, ne kroz izmenu postojećih.

### Employee / Role

| Polje | Tip | Napomena |
|---|---|---|
| `employee.property_id` | UUID FK | |
| `employee.role_id` | UUID FK | |
| `role.permissions` | jsonb | RBAC lista dozvola |
| `employee.active` | boolean | |

Svaki zaposleni ima **jedinstven nalog** (PCI-DSS zahtev 7/8, arhitektura pogl. 16) — nema deljenih login-a.

### Task (housekeeping / održavanje / gost zahtev)

| Polje | Tip | Napomena |
|---|---|---|
| `task.type` | text CHECK | `housekeeping_clean \| maintenance \| guest_request \| inspection` |
| `task.status` | text CHECK | `open \| in_progress \| completed \| cancelled` |
| `task.room_id` | UUID FK nullable | |
| `task.related_reservation_id` | UUID FK nullable | |
| `task.assigned_to` | UUID FK → employee, nullable | |
| `task.source` | text CHECK | `auto \| manual` — `auto` kad ga sistem kreira (npr. check-out → čišćenje) |

**State machine:** `open → in_progress → completed`, sa `→ cancelled` iz bilo kog stanja pre `completed`.

### Paketizacija putovanja (hold/confirm/cancel ugovor)

Detaljno u `architecture.md`, poglavlje 15. Sažetak polja/mehanike koja je već ugrađena u šemu iznad (`reservation.status = held`, `hold_expires_at`, `external_package_id`, `source = package`, `folio.owner_type = package_operator`):

- Nezavisan **Package orkestracioni servis** (van ovog repoa) drži `held` sobu, let (preko NDC agregatora poput Duffel-a) i transfer (preko OCTO/Mozio) paralelno, sa TTL-om.
- Hotel PMS izlaže `POST /package-quotes` (bez efekta), `POST /reservations/hold`, `POST /reservations/{id}/confirm`, `POST /reservations/{id}/cancel` (idempotentno) — Saga orkestracioni obrazac, kompenzacija u obrnutom redosledu ako bilo koja noga ne uspe.
- Pozadinski TTL sweep automatski prebacuje `held → expired` i oslobađa inventar, bez čekanja na orkestrator.

### ActivityBooking

Polja tačno prema arhitekturi (pogl. 11) — `reservation_id`, `activity_type`, `source`, `provider_ref`, `scheduled_at`, `participants`, `price`, `payment_mode`, `external_booking_reference`, `status`, `meeting_point`. Detalji u `architecture.md`.

## 3. Multi-tenant izolacija (RLS)

Primenjen obrazac: svaka tabela sa `property_id` ima RLS politiku koja poredi `property_id` sa vrednošću iz sesijske promenljive `app.current_property_id` (postavlja je aplikacija posle autentikacije). `guest_profile` koristi `organization_id` po istom principu jer je deljen kroz lanac. Konkretan primer za `reservation` i `folio` dat je u DDL-u — isti pattern (`CREATE POLICY ... USING (property_id = current_setting('app.current_property_id')::uuid)`) treba primeniti na sve preostale tabele sa `property_id` pre produkcije.

## 3a. Ljudski resursi, finansije, audit (poglavlja 19–22 arhitekture)

### Shift / TimeClockEvent / StaffCertification

| Polje | Tip | Napomena |
|---|---|---|
| `shift.employee_id` | UUID FK nullable | Nullable = otvorena smena, čeka preuzimanje |
| `shift.status` | text CHECK | `open \| assigned \| confirmed \| completed \| no_show \| cancelled` |
| `shift.forecast_source` | text CHECK | `auto \| manual` — da li je generisano iz occupancy forecast-a |
| `time_clock_event.event_type` | text CHECK | `clock_in \| clock_out \| break_start \| break_end` |
| `time_clock_event.source` | text CHECK | `badge \| biometric \| manual \| mobile` — badge/biometric dele kredencijal sa access-control adapterom (pogl. 8), ne grade paralelan hardver |
| `staff_certification.expires_at` | timestamptz nullable | Task/Shift servis proverava ovo pri dodeli — istekla sertifikacija blokira dodelu (arhitektonska odluka, ne poznat gotov proizvod) |

### JournalEntry

| Polje | Tip | Napomena |
|---|---|---|
| `journal_entry.business_date` | date | Generiše se pri noćnom auditu |
| `journal_entry.gl_account_code` | text | |
| `journal_entry.debit_amount`, `credit_amount` | numeric(12,2) | |
| `journal_entry.source_reference` | UUID FK nullable → `folio_line_item.id` | Veza ka izvornoj transakciji |

Ovo je interni kanoničan format — svaki knjigovodstveni sistem (QuickBooks, Sage Intacct, M3, Aptech PVNG) je zaseban adapter koji čita ovu tabelu, isti princip kao fiskalizacija/SEF adapteri.

### AuditEvent

| Polje | Tip | Napomena |
|---|---|---|
| `audit_event.organization_id` | UUID FK | Tenant izolacija, ista RLS politika kao ostatak šeme |
| `audit_event.actor_employee_id`, `actor_type` | UUID FK nullable / text | `employee \| system \| api_key` |
| `audit_event.action`, `resource_type`, `resource_id` | text/text/UUID | npr. `reservation.rate_changed` |
| `audit_event.before`, `after` | jsonb | **Bez PII direktno** — samo `guest_profile.id` referenca, nikad puno ime/email u snimku (GDPR: brisanje gosta ne sme pokidati audit istoriju) |
| `audit_event.prev_event_hash`, `event_hash` | text | Hash-lanac — čini izmenu/brisanje reda otkrivom bez posebnog WORM skladišta |

Upisuje se u istoj transakciji kao mutacija koju prati (aplikacioni hook), odvojeno od event magistrale (pogl. 14) koja služi integraciji, ne auditu.

## 3b. HACCP, incidenti, korporativni ugovori, ESG, loyalty (poglavlja 23–28 arhitekture)

### HaccpCcpLog / CorrectiveAction / SupplierCertificate

| Polje | Tip | Napomena |
|---|---|---|
| `haccp_ccp_log.ccp_type` | text | npr. `fridge_temp`, `cooking_temp`, `delivery_check` |
| `haccp_ccp_log.pass_fail` | boolean | Izvedeno iz `reading_value` naspram `threshold_min/max` |
| `corrective_action.linked_log_id` / `linked_incident_id` | UUID FK nullable (tačno jedno) | **Deljen entitet** između HACCP-a i incidenata (pogl. 24) — jedan sub-model za "šta je urađeno povodom problema" |
| `supplier_certificate.vendor_id` | UUID FK → `vendor` (nabavka, pogl. 6) | |

### IncidentReport

| Polje | Tip | Napomena |
|---|---|---|
| `incident_type` | text CHECK | `guest_injury \| workplace_accident \| security \| property_damage \| other` |
| `involved_guest_id`, `involved_employee_id` | UUID FK nullable | Najviše jedno popunjeno po incidentu (poslovno pravilo, ne DB constraint) |
| `evidence_refs` | jsonb | Foto/video reference (spoljno skladište) |
| `insurance_claim_reference` | text nullable | Veza ka eksternom RMIS/osiguranju — van šeme |

### CorporateAccount + proširenje RatePlan-a

| Polje | Tip | Napomena |
|---|---|---|
| `corporate_account.access_code` | text unique | Gost unosi pri rezervaciji da vidi cenu |
| `rate_plan.corporate_account_id` | UUID FK nullable | Novo polje na postojećoj tabeli (pogl. 3) |
| `rate_plan.last_room_availability` | boolean | Override flag — rate/availability engine mora ga poštovati i zaobići stop-sell/min-LOS/closed-to-arrival kad je `true` |

### EsgMetric / Certification

| Polje | Tip | Napomena |
|---|---|---|
| `esg_metric.metric_type` | text CHECK | `energy \| water \| waste \| carbon` |
| `esg_metric.source` | text CHECK | `iot_sensor \| manual` — deli infrastrukturu sa energetskim menadžmentom (pogl. 8) |
| `certification.program` | text CHECK | `green_key \| earthcheck \| green_globe \| leed` |

### Loyalty (LoyaltyPointTransaction / LoyaltyTier / LoyaltyTierAssignment / RedemptionCatalogItem)

| Polje | Tip | Napomena |
|---|---|---|
| `loyalty_point_transaction.guest_profile_id` | UUID FK | Ponovna upotreba postojećeg identiteta, ne novi "member" entitet |
| `loyalty_point_transaction.type` | text CHECK | `earn \| redeem \| expire \| adjust` — **append-only, redovi se nikad ne menjaju** |
| `loyalty_point_transaction.hold_until` | timestamptz nullable | Bodovi nisu trošivi dok boravak ne postane nepovratan |
| `loyalty_tier.qualifying_nights_threshold`, `qualifying_stays_threshold`, `qualifying_spend_threshold` | int/int/numeric, sve nullable | **OR logika** — ispunjen bilo koji prag dodeljuje nivo (Hilton Honors obrazac), ne AND |
| `loyalty_tier_assignment` | — | Istorija dodela nivoa, ne samo trenutni nivo — omogućava "koji je nivo gost imao u trenutku boravka X" |

Saldo bodova po gostu se **ne** čuva kao mutabilno polje — izvodi se (i keširano osvežava) iz `loyalty_point_transaction` ledger-a, isti princip kao Folio koji se izvodi iz `folio_line_item`.

## 3c. Kapacitet i zauzetost (poglavlje 29 arhitekture)

### Sobe — bez nove tabele

Raspoloživost soba se izvodi upitom (`room` minus OOO/OOS, minus aktivne `reservation`, minus `group_block_allotment` koji nije picked_up) — nema nove fizičke tabele u v1. `group_block` dobija dva nova polja:

| Polje | Tip | Napomena |
|---|---|---|
| `group_block.release_strategy` | text CHECK | `fixed \| rolling \| none` — Mews `AvailabilityBlock` obrazac |
| `group_block.release_date` | date nullable | Kad se nepodignuti alotman vraća u javnu raspoloživost |

### DiningOutlet / DiningTable / DiningReservation

| Polje | Tip | Napomena |
|---|---|---|
| `dining_table.status` | text CHECK | `available \| occupied \| reserved \| blocked` |
| `dining_reservation.table_id` | UUID FK nullable | Nullable dok se sto ne dodeli |
| `dining_reservation.guest_profile_id` | UUID FK nullable | Nullable za walk-in bez profila |

### SpaResource / SpaResourceStatus

| Polje | Tip | Napomena |
|---|---|---|
| `spa_resource.*` | — | **Lokalni read-only mirror** Zenoti/Book4Time registra — ne sistem zapisa transakcije |
| `spa_resource_status.current_appointment_reference` | text nullable | Eksterna referenca (Zenoti ID), ne FK — isti princip kao `external_booking_reference` kod Activity Booking-a |

### FunctionSpace / FunctionSpaceBooking

| Polje | Tip | Napomena |
|---|---|---|
| `function_space.capacity_by_setup` | jsonb | npr. `{"theater": 200, "banquet": 120, "classroom": 80}` |
| `function_space_booking.event_reference` | text nullable | Veza ka BEO/Cvent/Delphi (pogl. 12) — eksterna referenca, ne FK |

### OccupancySnapshotDaily — istorijski rollup

| Polje | Tip | Napomena |
|---|---|---|
| `resource_type` | text CHECK | `room \| dining_table \| spa_resource \| function_space` |
| `resource_category` | text | Generička kategorija (room_type_id ili outlet_id ili... — tekst radi jednostavnosti kroz tipove) |
| `source` | text CHECK | `night_audit \| manual` — generiše se pri istom okidaču kao `JournalEntry` (pogl. 21) |

Ovaj rollup je jedini fizički persistiran deo dashboard sloja — sve "sada/unapred" ostaje izvedeno upitom (`CapacityCount` obrazac), izbegavajući sinhronizacione probleme.

## 4. Šta namerno NIJE u ovoj šemi (v1)

- Nabavka/magacin (Item, Vendor, PurchaseOrder...) — poglavlje 6 arhitekture, zasebna migracija kad krene Faza 2.
- Kanal menadžer/OTA sinhronizacija — `reservation.channel_reference` je zadržan kao kuka za to, ali sama sinhronizaciona logika je van PMS jezgra.
- Fiskalizacija/SEF/eTurista adapteri — `folio` i `reservation` imaju dovoljno polja (guest ID dokument, iznosi) da se adapter doda bez menjanja šeme, ali sam adapter nije deo ove migracije.
- **Sam Package orkestracioni servis** (saga state, veza ka flights/transfers aplikaciji) — namerno živi u zasebnom repou/servisu, ne u ovoj bazi. Ovde je samo ugovor (hold/confirm/cancel) i referentno polje `external_package_id`.
- **Online reputacija/recenzije** (pogl. 27) — namerno bez nove tabele. Integracija je plitka (webhook-out ka vendoru pri checkout-u, konzument koristi vendorov dashboard) — jedina dodirna tačka je postojeći `guest_profile.marketing_consent` flag koji gejtuje da li se zahtev šalje.
