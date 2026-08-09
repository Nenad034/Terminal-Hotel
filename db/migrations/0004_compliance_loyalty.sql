-- Terminal Hotel — HACCP, incidenti, korporativni ugovori, ESG, loyalty
-- Prati docs/architecture.md poglavlja 23-28 i docs/data-model.md
-- Zavisi od: 0001_init_pms_core.sql, 0002_package_integration.sql, 0003_hr_finance_audit.sql
-- PostgreSQL 14+

-- ============================================================
-- CORRECTIVE ACTION (deljen izmedju HACCP i incidenata) — kreira se prvo,
-- jer haccp_ccp_log i incident_report na njega referenciraju unazad preko FK.
-- ============================================================

CREATE TABLE corrective_action (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id             UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  action_taken            TEXT NOT NULL,
  resolved_by_employee_id UUID REFERENCES employee(id),
  resolved_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_corrective_action_property ON corrective_action(property_id);

-- ============================================================
-- HACCP
-- ============================================================

CREATE TABLE haccp_ccp_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  ccp_type          TEXT NOT NULL, -- npr. 'fridge_temp' | 'freezer_temp' | 'cooking_temp' | 'delivery_check'
  location_reference TEXT,
  reading_value     NUMERIC(10,2) NOT NULL,
  unit              TEXT NOT NULL DEFAULT 'C',
  threshold_min     NUMERIC(10,2),
  threshold_max     NUMERIC(10,2),
  pass_fail         BOOLEAN NOT NULL,
  staff_employee_id UUID REFERENCES employee(id),
  corrective_action_id UUID REFERENCES corrective_action(id),
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_haccp_log_property_time ON haccp_ccp_log(property_id, occurred_at);
CREATE INDEX idx_haccp_log_failed ON haccp_ccp_log(property_id) WHERE pass_fail = false;

CREATE TABLE supplier_certificate (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id          UUID NOT NULL, -- FK ka Vendor entitetu iz nabavke (pogl. 6, zasebna migracija)
  cert_type          TEXT NOT NULL,
  issuing_body       TEXT,
  expiry_date        DATE,
  document_reference TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_supplier_cert_expiry ON supplier_certificate(expiry_date) WHERE expiry_date IS NOT NULL;

-- ============================================================
-- INCIDENT REPORT
-- ============================================================

CREATE TABLE incident_report (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id               UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  incident_type             TEXT NOT NULL
                              CHECK (incident_type IN ('guest_injury','workplace_accident','security','property_damage','other')),
  occurred_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  location                   TEXT,
  involved_guest_id          UUID REFERENCES guest_profile(id),
  involved_employee_id       UUID REFERENCES employee(id),
  description                TEXT NOT NULL,
  severity                   TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
  evidence_refs              JSONB NOT NULL DEFAULT '[]',
  root_cause                 TEXT,
  status                     TEXT NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','investigating','resolved','closed')),
  reported_by_employee_id    UUID REFERENCES employee(id),
  insurance_claim_reference  TEXT,
  corrective_action_id       UUID REFERENCES corrective_action(id),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_incident_property_time ON incident_report(property_id, occurred_at);

-- ============================================================
-- CORPORATE ACCOUNT / RFP — proširenje postojeceg rate_plan
-- ============================================================

CREATE TABLE corporate_account (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  company_name   TEXT NOT NULL,
  contract_start DATE,
  contract_end   DATE,
  access_code    TEXT NOT NULL UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rate_plan ADD COLUMN corporate_account_id UUID REFERENCES corporate_account(id);
ALTER TABLE rate_plan ADD COLUMN last_room_availability BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_rate_plan_corporate ON rate_plan(corporate_account_id) WHERE corporate_account_id IS NOT NULL;

-- ============================================================
-- ESG / SUSTAINABILITY
-- ============================================================

CREATE TABLE esg_metric (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  metric_type   TEXT NOT NULL CHECK (metric_type IN ('energy','water','waste','carbon')),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL CHECK (period_end >= period_start),
  value         NUMERIC(14,3) NOT NULL,
  unit          TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('iot_sensor','manual')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_esg_metric_property_period ON esg_metric(property_id, period_start, period_end);

CREATE TABLE certification (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  program      TEXT NOT NULL CHECK (program IN ('green_key','earthcheck','green_globe','leed')),
  status       TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','certified','expired','revoked')),
  audit_date   DATE,
  expiry_date  DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_certification_property ON certification(property_id);

-- ============================================================
-- LOYALTY
-- ============================================================

CREATE TABLE loyalty_tier (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  tier_name                   TEXT NOT NULL,
  qualifying_nights_threshold INT,
  qualifying_stays_threshold  INT,
  qualifying_spend_threshold  NUMERIC(12,2),
  benefits                    JSONB NOT NULL DEFAULT '[]',
  UNIQUE (organization_id, tier_name)
);

CREATE TABLE loyalty_tier_assignment (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_profile_id  UUID NOT NULL REFERENCES guest_profile(id) ON DELETE CASCADE,
  tier_id           UUID NOT NULL REFERENCES loyalty_tier(id),
  effective_from    DATE NOT NULL,
  effective_to      DATE,
  qualifying_period TEXT NOT NULL DEFAULT 'rolling_12mo' CHECK (qualifying_period IN ('rolling_12mo','calendar_year')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_loyalty_tier_assignment_guest ON loyalty_tier_assignment(guest_profile_id);

-- Append-only ledger — aplikacioni sloj ne sme dozvoliti UPDATE/DELETE (isti princip kao audit_event)
CREATE TABLE loyalty_point_transaction (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_profile_id    UUID NOT NULL REFERENCES guest_profile(id) ON DELETE CASCADE,
  type                TEXT NOT NULL CHECK (type IN ('earn','redeem','expire','adjust')),
  amount              INT NOT NULL, -- pozitivno za earn, negativno za redeem/expire (konvencija)
  source_reservation_id UUID REFERENCES reservation(id),
  earned_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ,
  hold_until          TIMESTAMPTZ, -- bodovi nisu trosivi pre ovog trenutka (npr. do nepovratnosti boravka)
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','expired'))
);
CREATE INDEX idx_loyalty_txn_guest ON loyalty_point_transaction(guest_profile_id, earned_at);
CREATE INDEX idx_loyalty_txn_expiry ON loyalty_point_transaction(expires_at) WHERE expires_at IS NOT NULL AND status = 'posted';

CREATE TABLE redemption_catalog_item (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  point_cost  INT NOT NULL CHECK (point_cost > 0),
  type        TEXT NOT NULL CHECK (type IN ('voucher','upgrade','free_night','partner_reward')),
  active      BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- REVIEW MANAGEMENT — namerno bez nove tabele (plitka integracija, pogl. 27).
-- Jedina dodirna tacka: postojeci guest_profile.marketing_consent flag (0001)
-- gejtuje da li se webhook za zahtev recenzije uopste salje.
-- ============================================================

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE haccp_ccp_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY haccp_ccp_log_tenant_isolation ON haccp_ccp_log
  USING (property_id = current_setting('app.current_property_id', true)::uuid);

ALTER TABLE incident_report ENABLE ROW LEVEL SECURITY;
CREATE POLICY incident_report_tenant_isolation ON incident_report
  USING (property_id = current_setting('app.current_property_id', true)::uuid);

ALTER TABLE esg_metric ENABLE ROW LEVEL SECURITY;
CREATE POLICY esg_metric_tenant_isolation ON esg_metric
  USING (property_id = current_setting('app.current_property_id', true)::uuid);

-- TODO pre produkcije: ista RLS politika na corrective_action, supplier_certificate,
-- corporate_account (organization_id), certification, loyalty_* tabele.
