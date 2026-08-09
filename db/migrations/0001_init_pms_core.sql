-- Terminal Hotel — PMS jezgro, inicijalna šema
-- Prati docs/data-model.md i docs/architecture.md (poglavlja 3, 7, 13, 15, 16)
-- PostgreSQL 14+

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ============================================================
-- ORGANIZATION / PROPERTY
-- ============================================================

CREATE TABLE organization (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE property (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  timezone        TEXT NOT NULL DEFAULT 'Europe/Belgrade',
  currency        CHAR(3) NOT NULL DEFAULT 'RSD',
  address         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_property_org ON property(organization_id);

-- ============================================================
-- ROOM TYPE / ROOM
-- ============================================================

CREATE TABLE room_type (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  base_occupancy  INT NOT NULL DEFAULT 2,
  max_occupancy   INT NOT NULL DEFAULT 2,
  accessible      BOOLEAN NOT NULL DEFAULT false,
  amenities       JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, code)
);

CREATE TABLE room (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  room_type_id        UUID NOT NULL REFERENCES room_type(id),
  room_number         TEXT NOT NULL,
  floor               TEXT,
  occupancy_status    TEXT NOT NULL DEFAULT 'vacant'
                        CHECK (occupancy_status IN ('vacant','occupied')),
  cleanliness_status  TEXT NOT NULL DEFAULT 'clean'
                        CHECK (cleanliness_status IN ('dirty','clean','inspected','pickup')),
  out_of_order        BOOLEAN NOT NULL DEFAULT false,
  out_of_service      BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, room_number)
);
CREATE INDEX idx_room_property ON room(property_id);
CREATE INDEX idx_room_type ON room(room_type_id);

-- Audit trag svake promene statusa sobe — izvor za event magistralu (arhitektura pogl. 14)
CREATE TABLE room_status_event (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  occupancy_status    TEXT NOT NULL CHECK (occupancy_status IN ('vacant','occupied')),
  cleanliness_status  TEXT NOT NULL CHECK (cleanliness_status IN ('dirty','clean','inspected','pickup')),
  changed_by          UUID, -- employee.id, nullable za sistemske promene
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_room_status_event_room ON room_status_event(room_id, occurred_at);

-- ============================================================
-- RATE GROUP / RATE PLAN / RATE (kalendar cena)
-- ============================================================

CREATE TABLE rate_group (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  name         TEXT NOT NULL
);

CREATE TABLE rate_plan (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  rate_group_id         UUID REFERENCES rate_group(id),
  code                  TEXT NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT,
  is_public             BOOLEAN NOT NULL DEFAULT true,
  cancellation_policy   JSONB NOT NULL DEFAULT '{}',
  min_los               INT,
  max_los               INT,
  closed_to_arrival     BOOLEAN NOT NULL DEFAULT false,
  closed_to_departure   BOOLEAN NOT NULL DEFAULT false,
  currency              CHAR(3) NOT NULL DEFAULT 'RSD',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, code)
);

-- Jedan red po (rate_plan, room_type, datum) — standardni "rate calendar" obrazac
CREATE TABLE rate (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_plan_id                UUID NOT NULL REFERENCES rate_plan(id) ON DELETE CASCADE,
  room_type_id                UUID NOT NULL REFERENCES room_type(id) ON DELETE CASCADE,
  stay_date                   DATE NOT NULL,
  price                       NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  min_los_override            INT,
  closed_to_arrival_override  BOOLEAN,
  UNIQUE (rate_plan_id, room_type_id, stay_date)
);
CREATE INDEX idx_rate_lookup ON rate(room_type_id, stay_date);

-- ============================================================
-- GUEST PROFILE (organization-scoped — deljen kroz lanac)
-- ============================================================

CREATE TABLE guest_profile (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  id_document_type      TEXT,
  id_document_number    TEXT,
  nationality            TEXT,
  date_of_birth         DATE,
  address               JSONB NOT NULL DEFAULT '{}',
  preferences           JSONB NOT NULL DEFAULT '{}',
  marketing_consent     BOOLEAN NOT NULL DEFAULT false,
  consent_recorded_at   TIMESTAMPTZ,
  gdpr_deleted_at       TIMESTAMPTZ, -- soft-delete marker (pravo na brisanje)
  loyalty_tier          TEXT,
  loyalty_number        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_guest_org ON guest_profile(organization_id);
CREATE INDEX idx_guest_email ON guest_profile(email);

-- ============================================================
-- EMPLOYEE / ROLE
-- ============================================================

CREATE TABLE role (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  permissions  JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE employee (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  role_id      UUID NOT NULL REFERENCES role(id),
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE, -- jedinstven nalog po zaposlenom (PCI-DSS 7/8)
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_employee_property ON employee(property_id);

-- ============================================================
-- GROUP BLOCK
-- ============================================================

CREATE TABLE group_block (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  organizer_guest_id    UUID REFERENCES guest_profile(id),
  block_start_date      DATE NOT NULL,
  block_end_date        DATE NOT NULL,
  master_account        BOOLEAN NOT NULL DEFAULT false,
  attrition_percentage  NUMERIC(5,2),
  status                TEXT NOT NULL DEFAULT 'tentative'
                          CHECK (status IN ('tentative','definite','cancelled')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_block_allotment (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_block_id   UUID NOT NULL REFERENCES group_block(id) ON DELETE CASCADE,
  room_type_id     UUID NOT NULL REFERENCES room_type(id),
  stay_date        DATE NOT NULL,
  blocked_rooms    INT NOT NULL DEFAULT 0,
  picked_up_rooms  INT NOT NULL DEFAULT 0,
  UNIQUE (group_block_id, room_type_id, stay_date)
);

-- ============================================================
-- RESERVATION
-- ============================================================

CREATE TABLE reservation (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id          UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  confirmation_number  TEXT NOT NULL UNIQUE,
  primary_guest_id     UUID NOT NULL REFERENCES guest_profile(id),
  status               TEXT NOT NULL DEFAULT 'booked'
                          CHECK (status IN ('booked','confirmed','checked_in','checked_out','cancelled','no_show')),
  source               TEXT NOT NULL
                          CHECK (source IN ('direct','ota','gds','phone','walk_in','group')),
  channel_reference    TEXT,
  room_type_id         UUID NOT NULL REFERENCES room_type(id),
  room_id              UUID REFERENCES room(id),
  rate_plan_id         UUID NOT NULL REFERENCES rate_plan(id),
  arrival_date         DATE NOT NULL,
  departure_date       DATE NOT NULL CHECK (departure_date > arrival_date),
  adults               INT NOT NULL DEFAULT 1,
  children             INT NOT NULL DEFAULT 0,
  guarantee_type       TEXT NOT NULL DEFAULT 'none'
                          CHECK (guarantee_type IN ('credit_card','deposit','company','none')),
  cancellation_deadline TIMESTAMPTZ,
  group_block_id       UUID REFERENCES group_block(id),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reservation_property_dates ON reservation(property_id, arrival_date, departure_date);
CREATE INDEX idx_reservation_guest ON reservation(primary_guest_id);
CREATE INDEX idx_reservation_room ON reservation(room_id) WHERE room_id IS NOT NULL;

CREATE TABLE reservation_status_event (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id    UUID NOT NULL REFERENCES reservation(id) ON DELETE CASCADE,
  from_status       TEXT,
  to_status         TEXT NOT NULL,
  actor_employee_id UUID REFERENCES employee(id), -- NULL = sistemski prelaz (npr. auto no-show)
  reason            TEXT,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_res_status_event ON reservation_status_event(reservation_id, occurred_at);

-- ============================================================
-- FOLIO / LINE ITEM / PAYMENT
-- ============================================================

CREATE TABLE folio (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  reservation_id  UUID NOT NULL REFERENCES reservation(id) ON DELETE CASCADE,
  folio_number    INT NOT NULL DEFAULT 1,
  owner_type      TEXT NOT NULL DEFAULT 'guest'
                    CHECK (owner_type IN ('guest','company','group_master')),
  owner_ref       TEXT, -- naziv kompanije ili referenca ako owner_type != guest
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','closed','voided')),
  currency        CHAR(3) NOT NULL DEFAULT 'RSD',
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  UNIQUE (reservation_id, folio_number)
);
CREATE INDEX idx_folio_reservation ON folio(reservation_id);

CREATE TABLE folio_line_item (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_id         UUID NOT NULL REFERENCES folio(id) ON DELETE CASCADE,
  department       TEXT NOT NULL
                     CHECK (department IN ('room','fnb','spa','minibar','activity','tax','other')),
  description      TEXT NOT NULL,
  quantity         NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price       NUMERIC(12,2) NOT NULL,
  amount           NUMERIC(12,2) NOT NULL,
  tax_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  source_system    TEXT NOT NULL DEFAULT 'pms'
                     CHECK (source_system IN ('pos','pms','spa','minibar','manual')),
  source_reference TEXT, -- ID transakcije u spoljnom sistemu (npr. Toast tenderIdentifier)
  voided           BOOLEAN NOT NULL DEFAULT false,
  voided_reason    TEXT,
  posted_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_folio_line_item_folio ON folio_line_item(folio_id);

CREATE TABLE payment (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_id         UUID NOT NULL REFERENCES folio(id) ON DELETE CASCADE,
  method           TEXT NOT NULL
                     CHECK (method IN ('card_token','cash','bank_transfer','voucher')),
  amount           NUMERIC(12,2) NOT NULL,
  currency         CHAR(3) NOT NULL DEFAULT 'RSD',
  token_reference  TEXT, -- token sa PCI-DSS gateway-a — NIKAD sirov broj kartice
  status           TEXT NOT NULL DEFAULT 'authorized'
                     CHECK (status IN ('authorized','captured','refunded','failed')),
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_folio ON payment(folio_id);

-- ============================================================
-- TASK (housekeeping / održavanje / gost zahtev)
-- ============================================================

CREATE TABLE task (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id            UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  type                   TEXT NOT NULL
                           CHECK (type IN ('housekeeping_clean','maintenance','guest_request','inspection')),
  status                 TEXT NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open','in_progress','completed','cancelled')),
  room_id                UUID REFERENCES room(id),
  related_reservation_id UUID REFERENCES reservation(id),
  assigned_to            UUID REFERENCES employee(id),
  priority               TEXT NOT NULL DEFAULT 'normal'
                           CHECK (priority IN ('low','normal','high','urgent')),
  source                 TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('auto','manual')),
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at                 TIMESTAMPTZ,
  completed_at           TIMESTAMPTZ
);
CREATE INDEX idx_task_property_status ON task(property_id, status);
CREATE INDEX idx_task_room ON task(room_id) WHERE room_id IS NOT NULL;

-- ============================================================
-- ACTIVITY BOOKING (arhitektura pogl. 11)
-- ============================================================

CREATE TABLE activity_booking (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id            UUID NOT NULL REFERENCES reservation(id) ON DELETE CASCADE,
  activity_type             TEXT NOT NULL
                              CHECK (activity_type IN ('excursion','tour','class','conference_session','external_event')),
  source                    TEXT NOT NULL
                              CHECK (source IN ('internal','external_operator','external_marketplace','external_reference_only')),
  provider_ref              TEXT,
  scheduled_at              TIMESTAMPTZ,
  duration_minutes          INT,
  participants              INT NOT NULL DEFAULT 1,
  price                     NUMERIC(12,2),
  payment_mode              TEXT
                              CHECK (payment_mode IN ('folio_charge','external_payment','referral_commission')),
  external_booking_reference TEXT,
  status                    TEXT NOT NULL DEFAULT 'requested'
                              CHECK (status IN ('requested','confirmed','waitlisted','cancelled','completed','no_show')),
  meeting_point              TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_booking_reservation ON activity_booking(reservation_id);

-- ============================================================
-- ROW-LEVEL SECURITY — primer obrasca (primeniti na sve tabele sa property_id)
-- Aplikacija pre svakog upita postavlja: SET app.current_property_id = '<uuid>';
-- ============================================================

ALTER TABLE reservation ENABLE ROW LEVEL SECURITY;
CREATE POLICY reservation_tenant_isolation ON reservation
  USING (property_id = current_setting('app.current_property_id', true)::uuid);

ALTER TABLE folio ENABLE ROW LEVEL SECURITY;
CREATE POLICY folio_tenant_isolation ON folio
  USING (property_id = current_setting('app.current_property_id', true)::uuid);

-- TODO pre produkcije: ista RLS politika na room, room_type, rate_plan, rate,
-- employee, group_block, task, i organization_id-scoped politika na guest_profile.
