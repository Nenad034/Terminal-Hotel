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
| `status` | text CHECK | `booked \| confirmed \| checked_in \| checked_out \| cancelled \| no_show` |
| `source` | text CHECK | `direct \| ota \| gds \| phone \| walk_in \| group` |
| `channel_reference` | text nullable | ID rezervacije u OTA/GDS sistemu |
| `room_type_id` | UUID FK | Traženi tip (u trenutku rezervacije) |
| `room_id` | UUID FK nullable | Dodeljena fizička soba (tek na/pre check-in) |
| `rate_plan_id` | UUID FK | |
| `arrival_date`, `departure_date` | date | |
| `adults`, `children` | int | |
| `guarantee_type` | text CHECK | `credit_card \| deposit \| company \| none` |
| `group_block_id` | UUID FK nullable | |

**State machine (`reservation.status`):**

```
booked ──confirm──> confirmed ──check-in──> checked_in ──check-out──> checked_out
   │                    │
   └──cancel──> cancelled          └──(datum dolaska prošao, nije se pojavio)──> no_show
```

Svaki prelaz upisuje red u `reservation_status_event` (`from_status`, `to_status`, `occurred_at`, `actor_employee_id` nullable za sistemske prelaze poput no-show-a iz noćnog audita).

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
| `folio.owner_type` | text CHECK | `guest \| company \| group_master` |
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

### ActivityBooking

Polja tačno prema arhitekturi (pogl. 11) — `reservation_id`, `activity_type`, `source`, `provider_ref`, `scheduled_at`, `participants`, `price`, `payment_mode`, `external_booking_reference`, `status`, `meeting_point`. Detalji u `architecture.md`.

## 3. Multi-tenant izolacija (RLS)

Primenjen obrazac: svaka tabela sa `property_id` ima RLS politiku koja poredi `property_id` sa vrednošću iz sesijske promenljive `app.current_property_id` (postavlja je aplikacija posle autentikacije). `guest_profile` koristi `organization_id` po istom principu jer je deljen kroz lanac. Konkretan primer za `reservation` i `folio` dat je u DDL-u — isti pattern (`CREATE POLICY ... USING (property_id = current_setting('app.current_property_id')::uuid)`) treba primeniti na sve preostale tabele sa `property_id` pre produkcije.

## 4. Šta namerno NIJE u ovoj šemi (v1)

- Nabavka/magacin (Item, Vendor, PurchaseOrder...) — poglavlje 6 arhitekture, zasebna migracija kad krene Faza 2.
- Kanal menadžer/OTA sinhronizacija — `reservation.channel_reference` je zadržan kao kuka za to, ali sama sinhronizaciona logika je van PMS jezgra.
- Fiskalizacija/SEF/eTurista adapteri — `folio` i `reservation` imaju dovoljno polja (guest ID dokument, iznosi) da se adapter doda bez menjanja šeme, ali sam adapter nije deo ove migracije.
