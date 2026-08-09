-- Terminal Hotel — spremnost za paketizaciju putovanja (hotel + let + transfer)
-- Prati docs/architecture.md poglavlje 15 i docs/data-model.md
-- Zavisi od: 0001_init_pms_core.sql
-- PostgreSQL 14+

-- ============================================================
-- RESERVATION — hold/confirm/cancel ugovor za eksterni Package orkestrator
-- ============================================================

-- Novi status enum: dodato 'held' (privremeno drži TTL) i 'expired' (TTL istekao pre potvrde)
ALTER TABLE reservation DROP CONSTRAINT reservation_status_check;
ALTER TABLE reservation ADD CONSTRAINT reservation_status_check
  CHECK (status IN ('held','booked','confirmed','checked_in','checked_out','cancelled','no_show','expired'));

-- Novi source: 'package' za rezervacije nastale kroz paket orkestrator
ALTER TABLE reservation DROP CONSTRAINT reservation_source_check;
ALTER TABLE reservation ADD CONSTRAINT reservation_source_check
  CHECK (source IN ('direct','ota','gds','phone','walk_in','group','package'));

-- TTL za 'held' status — postavljeno samo dok status = 'held'
ALTER TABLE reservation ADD COLUMN hold_expires_at TIMESTAMPTZ;

-- Referenca ka Package zapisu u eksternom orkestracionom servisu — ne normalizovati tuđi model
ALTER TABLE reservation ADD COLUMN external_package_id TEXT;
CREATE INDEX idx_reservation_external_package ON reservation(external_package_id)
  WHERE external_package_id IS NOT NULL;

-- Konzistentnost: hold_expires_at ima smisla samo dok je soba stvarno 'held'
ALTER TABLE reservation ADD CONSTRAINT reservation_hold_expiry_check
  CHECK (
    (status = 'held' AND hold_expires_at IS NOT NULL)
    OR (status != 'held')
  );

-- ============================================================
-- FOLIO — paket kao platilac (merchant of record je orkestrator/tour operator)
-- ============================================================

ALTER TABLE folio DROP CONSTRAINT folio_owner_type_check;
ALTER TABLE folio ADD CONSTRAINT folio_owner_type_check
  CHECK (owner_type IN ('guest','company','group_master','package_operator'));

-- ============================================================
-- TTL SWEEP — primer upita koji pozadinski job pokreće periodično (npr. svakih 60s)
-- Prebacuje istekle 'held' rezervacije u 'expired' i oslobađa sobu bez čekanja na orkestrator.
-- Aplikacija treba i da emituje 'reservation.expired' event posle ovoga (arhitektura pogl. 14).
-- ============================================================

-- Primer (ne izvršava se automatski ovom migracijom — pokreće ga scheduled worker):
--
-- UPDATE reservation
-- SET status = 'expired', room_id = NULL, updated_at = now()
-- WHERE status = 'held' AND hold_expires_at < now()
-- RETURNING id;
--
-- Za svaki vraćeni id, aplikacioni sloj upisuje red u reservation_status_event
-- (from_status='held', to_status='expired', actor_employee_id=NULL) i objavljuje event.
