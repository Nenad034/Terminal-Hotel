-- Terminal Hotel — kapacitet i zauzetost (sobe/restoran/spa/kongresne sale)
-- Prati docs/architecture.md poglavlje 29 i docs/data-model.md
-- Zavisi od: 0001_init_pms_core.sql .. 0004_compliance_loyalty.sql
-- PostgreSQL 14+

-- ============================================================
-- SOBE — popuna ARI propusta: samo prosirenje group_block,
-- raspolozivost se izvodi upitom (vidi primer view-a na dnu fajla),
-- nema nove fizicke "inventory" tabele u v1.
-- ============================================================

ALTER TABLE group_block ADD COLUMN release_strategy TEXT NOT NULL DEFAULT 'none'
  CHECK (release_strategy IN ('fixed','rolling','none'));
ALTER TABLE group_block ADD COLUMN release_date DATE;

-- ============================================================
-- RESTORAN
-- ============================================================

CREATE TABLE dining_outlet (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  outlet_type  TEXT NOT NULL DEFAULT 'restaurant' CHECK (outlet_type IN ('restaurant','bar')),
  total_seats  INT NOT NULL DEFAULT 0
);

CREATE TABLE dining_table (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id      UUID NOT NULL REFERENCES dining_outlet(id) ON DELETE CASCADE,
  table_number   TEXT NOT NULL,
  seat_capacity  INT NOT NULL DEFAULT 2,
  status         TEXT NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available','occupied','reserved','blocked')),
  current_booking_id UUID, -- FK ka dining_reservation, dodato posle (kruzna referenca)
  UNIQUE (outlet_id, table_number)
);

CREATE TABLE dining_reservation (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id                UUID NOT NULL REFERENCES dining_outlet(id) ON DELETE CASCADE,
  table_id                 UUID REFERENCES dining_table(id), -- nullable dok se ne dodeli
  guest_profile_id         UUID REFERENCES guest_profile(id), -- nullable za walk-in
  party_size               INT NOT NULL DEFAULT 2,
  reservation_time         TIMESTAMPTZ NOT NULL,
  duration_minutes_estimate INT NOT NULL DEFAULT 90,
  status                   TEXT NOT NULL DEFAULT 'booked'
                             CHECK (status IN ('booked','seated','completed','cancelled','no_show')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dining_reservation_outlet_time ON dining_reservation(outlet_id, reservation_time);

ALTER TABLE dining_table ADD CONSTRAINT dining_table_current_booking_fk
  FOREIGN KEY (current_booking_id) REFERENCES dining_reservation(id);

-- ============================================================
-- SPA — lokalni read-only mirror (Zenoti/Book4Time ostaje sistem zapisa)
-- ============================================================

CREATE TABLE spa_resource (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  external_ref      TEXT, -- ID sobe u Zenoti/Book4Time
  name              TEXT NOT NULL,
  capacity          INT NOT NULL DEFAULT 1,
  can_exceed_capacity BOOLEAN NOT NULL DEFAULT false,
  room_category     TEXT,
  last_synced_at    TIMESTAMPTZ
);

CREATE TABLE spa_resource_status (
  spa_resource_id             UUID PRIMARY KEY REFERENCES spa_resource(id) ON DELETE CASCADE,
  status                      TEXT NOT NULL DEFAULT 'available'
                                CHECK (status IN ('available','occupied','blocked')),
  status_since                TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_appointment_reference TEXT -- eksterna referenca (Zenoti), ne FK
);

CREATE TABLE spa_resource_blockout (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spa_resource_id UUID NOT NULL REFERENCES spa_resource(id) ON DELETE CASCADE,
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL CHECK (end_at > start_at),
  reason          TEXT
);
CREATE INDEX idx_spa_blockout_resource ON spa_resource_blockout(spa_resource_id, start_at);

-- ============================================================
-- KONGRESNE SALE
-- ============================================================

CREATE TABLE function_space (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id        UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  capacity_by_setup  JSONB NOT NULL DEFAULT '{}' -- npr. {"theater":200,"banquet":120,"classroom":80}
);

CREATE TABLE function_space_booking (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_space_id     UUID NOT NULL REFERENCES function_space(id) ON DELETE CASCADE,
  event_reference        TEXT, -- BEO/Cvent/Delphi eksterna referenca, ne FK
  start_at               TIMESTAMPTZ NOT NULL,
  end_at                 TIMESTAMPTZ NOT NULL CHECK (end_at > start_at),
  setup_type              TEXT,
  buffer_before_minutes   INT NOT NULL DEFAULT 0,
  buffer_after_minutes    INT NOT NULL DEFAULT 0,
  status                  TEXT NOT NULL DEFAULT 'tentative'
                            CHECK (status IN ('tentative','definite','cancelled')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_function_space_booking_space_time ON function_space_booking(function_space_id, start_at);

-- ============================================================
-- ISTORIJSKI ROLLUP — generise se pri nocnom auditu (isti okidac kao JournalEntry)
-- ============================================================

CREATE TABLE occupancy_snapshot_daily (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  resource_type     TEXT NOT NULL CHECK (resource_type IN ('room','dining_table','spa_resource','function_space')),
  resource_category TEXT NOT NULL, -- room_type_id / outlet_id / itd. kao tekst, generickog radi kroz tipove
  snapshot_date     DATE NOT NULL,
  total_units       INT NOT NULL,
  occupied_units    INT NOT NULL,
  available_units   INT NOT NULL,
  source            TEXT NOT NULL DEFAULT 'night_audit' CHECK (source IN ('night_audit','manual')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, resource_type, resource_category, snapshot_date)
);
CREATE INDEX idx_occupancy_snapshot_property_date ON occupancy_snapshot_daily(property_id, snapshot_date);

-- ============================================================
-- PRIMER: izvedena dnevna raspolozivost soba (dokumentacioni obrazac, ne
-- materijalizovana tabela — koristi se za "sada/unapred" upite, pogl. 29)
-- ============================================================

-- NAPOMENA: total_rooms i rooms_reserved moraju biti NEZAVISNI podupiti, ne dva
-- LEFT JOIN-a u istom upitu — room i reservation se ne povezuju 1:1 (rezervacija
-- ima samo room_type_id dok se soba ne dodeli), pa bi dupli JOIN preko iste
-- room_type_id dimenzije umnozio redove (pogresno vratio rooms_reserved = broj
-- soba x broj rezervacija umesto stvarnog broja rezervacija). Ovo je otkriveno
-- test-om u ovoj migraciji, ne teorijski predvidjeno.
--
-- SELECT
--   rt.id AS room_type_id,
--   d.stay_date,
--   (SELECT COUNT(*) FROM room r
--      WHERE r.room_type_id = rt.id AND NOT r.out_of_order AND NOT r.out_of_service) AS total_rooms,
--   (SELECT COUNT(*) FROM reservation res
--      WHERE res.room_type_id = rt.id
--        AND res.status IN ('held','booked','confirmed','checked_in')
--        AND d.stay_date >= res.arrival_date AND d.stay_date < res.departure_date) AS rooms_reserved
-- FROM room_type rt
-- CROSS JOIN generate_series(current_date, current_date + interval '30 days', interval '1 day') AS d(stay_date);
-- -- rooms_available = total_rooms - rooms_reserved (racuna se u aplikacionom sloju ili spoljnom SELECT-u)

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE dining_outlet ENABLE ROW LEVEL SECURITY;
CREATE POLICY dining_outlet_tenant_isolation ON dining_outlet
  USING (property_id = current_setting('app.current_property_id', true)::uuid);

ALTER TABLE spa_resource ENABLE ROW LEVEL SECURITY;
CREATE POLICY spa_resource_tenant_isolation ON spa_resource
  USING (property_id = current_setting('app.current_property_id', true)::uuid);

ALTER TABLE function_space ENABLE ROW LEVEL SECURITY;
CREATE POLICY function_space_tenant_isolation ON function_space
  USING (property_id = current_setting('app.current_property_id', true)::uuid);

ALTER TABLE occupancy_snapshot_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY occupancy_snapshot_tenant_isolation ON occupancy_snapshot_daily
  USING (property_id = current_setting('app.current_property_id', true)::uuid);

-- TODO pre produkcije: ista RLS politika na dining_table, dining_reservation,
-- spa_resource_status, spa_resource_blockout, function_space_booking (preko joina).
