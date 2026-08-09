-- Terminal Hotel — ljudski resursi, finansije/KPI, audit log
-- Prati docs/architecture.md poglavlja 19-22 i docs/data-model.md
-- Zavisi od: 0001_init_pms_core.sql, 0002_package_integration.sql
-- PostgreSQL 14+

-- ============================================================
-- SHIFT / TIME CLOCK / STAFF CERTIFICATION
-- ============================================================

CREATE TABLE shift (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  employee_id      UUID REFERENCES employee(id), -- NULL = otvorena smena, ceka preuzimanje
  role_id          UUID NOT NULL REFERENCES role(id),
  start_at         TIMESTAMPTZ NOT NULL,
  end_at           TIMESTAMPTZ NOT NULL CHECK (end_at > start_at),
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','assigned','confirmed','completed','no_show','cancelled')),
  forecast_source  TEXT NOT NULL DEFAULT 'manual' CHECK (forecast_source IN ('auto','manual')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shift_property_dates ON shift(property_id, start_at, end_at);
CREATE INDEX idx_shift_employee ON shift(employee_id) WHERE employee_id IS NOT NULL;

CREATE TABLE time_clock_event (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  property_id      UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL
                     CHECK (event_type IN ('clock_in','clock_out','break_start','break_end')),
  source           TEXT NOT NULL DEFAULT 'manual'
                     CHECK (source IN ('badge','biometric','manual','mobile')),
  device_reference TEXT,
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_time_clock_employee ON time_clock_event(employee_id, occurred_at);

CREATE TABLE staff_certification (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id             UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  certification_type      TEXT NOT NULL,
  issued_at               DATE NOT NULL,
  expires_at              DATE,
  verified_by_employee_id UUID REFERENCES employee(id),
  document_reference      TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_staff_cert_employee ON staff_certification(employee_id);
CREATE INDEX idx_staff_cert_expiry ON staff_certification(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================
-- JOURNAL ENTRY (GL export — interni kanonican format)
-- ============================================================

CREATE TABLE journal_entry (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  business_date     DATE NOT NULL,
  gl_account_code   TEXT NOT NULL,
  debit_amount      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
  credit_amount     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  department        TEXT,
  description       TEXT NOT NULL,
  source_reference  UUID REFERENCES folio_line_item(id),
  exported_at       TIMESTAMPTZ, -- NULL dok adapter ka knjigovodstvenom sistemu ne potvrdi izvoz
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT journal_entry_one_side_check CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0)
  )
);
CREATE INDEX idx_journal_entry_property_date ON journal_entry(property_id, business_date);
CREATE INDEX idx_journal_entry_unexported ON journal_entry(property_id) WHERE exported_at IS NULL;

-- ============================================================
-- AUDIT EVENT (append-only, ne pun event sourcing — videti arhitektura pogl. 22)
-- ============================================================

CREATE TABLE audit_event (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  property_id         UUID REFERENCES property(id), -- NULL za organization-nivo evente
  actor_employee_id   UUID REFERENCES employee(id),  -- NULL za sistemske/API akcije
  actor_type          TEXT NOT NULL DEFAULT 'employee'
                        CHECK (actor_type IN ('employee','system','api_key')),
  action              TEXT NOT NULL,            -- npr. 'reservation.rate_changed'
  resource_type       TEXT NOT NULL,
  resource_id         UUID,
  before_state        JSONB,                    -- BEZ PII direktno — samo guest_profile.id reference
  after_state         JSONB,
  metadata            JSONB NOT NULL DEFAULT '{}', -- IP, user-agent, request-id
  prev_event_hash     TEXT,
  event_hash          TEXT,
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_event_org_time ON audit_event(organization_id, occurred_at DESC);
CREATE INDEX idx_audit_event_resource ON audit_event(resource_type, resource_id);

-- audit_event se upisuje isključivo append-only iz aplikacionog sloja (u istoj transakciji
-- kao mutacija koju prati) — namerno nema UPDATE/DELETE dozvolu za obicne aplikacione naloge,
-- samo INSERT. Primeniti na nivou baznih permisija pre produkcije (REVOKE UPDATE, DELETE).

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE shift ENABLE ROW LEVEL SECURITY;
CREATE POLICY shift_tenant_isolation ON shift
  USING (property_id = current_setting('app.current_property_id', true)::uuid);

ALTER TABLE journal_entry ENABLE ROW LEVEL SECURITY;
CREATE POLICY journal_entry_tenant_isolation ON journal_entry
  USING (property_id = current_setting('app.current_property_id', true)::uuid);

ALTER TABLE audit_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_event_tenant_isolation ON audit_event
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- TODO pre produkcije: ista RLS politika na time_clock_event, staff_certification
-- (preko employee.property_id joina ili denormalizovanog property_id polja).
