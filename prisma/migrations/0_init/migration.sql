-- CreateEnum
CREATE TYPE "occupancy_status_enum" AS ENUM ('vacant', 'occupied');

-- CreateEnum
CREATE TYPE "cleanliness_status_enum" AS ENUM ('dirty', 'clean', 'inspected', 'pickup');

-- CreateTable
CREATE TABLE "organization" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Belgrade',
    "currency" CHAR(3) NOT NULL DEFAULT 'RSD',
    "address" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_type" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "base_occupancy" INTEGER NOT NULL DEFAULT 2,
    "max_occupancy" INTEGER NOT NULL DEFAULT 2,
    "accessible" BOOLEAN NOT NULL DEFAULT false,
    "amenities" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "room_number" TEXT NOT NULL,
    "floor" TEXT,
    "occupancy_status" TEXT NOT NULL DEFAULT 'vacant',
    "cleanliness_status" TEXT NOT NULL DEFAULT 'clean',
    "out_of_order" BOOLEAN NOT NULL DEFAULT false,
    "out_of_service" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_status_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_id" UUID NOT NULL,
    "occupancy_status" TEXT NOT NULL,
    "cleanliness_status" TEXT NOT NULL,
    "changed_by" UUID,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_group" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "rate_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_plan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "rate_group_id" UUID,
    "corporate_account_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "cancellation_policy" JSONB NOT NULL DEFAULT '{}',
    "min_los" INTEGER,
    "max_los" INTEGER,
    "closed_to_arrival" BOOLEAN NOT NULL DEFAULT false,
    "closed_to_departure" BOOLEAN NOT NULL DEFAULT false,
    "last_room_availability" BOOLEAN NOT NULL DEFAULT false,
    "currency" CHAR(3) NOT NULL DEFAULT 'RSD',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rate_plan_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "stay_date" DATE NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "min_los_override" INTEGER,
    "closed_to_arrival_override" BOOLEAN,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_profile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "id_document_type" TEXT,
    "id_document_number" TEXT,
    "nationality" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "consent_recorded_at" TIMESTAMPTZ,
    "gdpr_deleted_at" TIMESTAMPTZ,
    "loyalty_tier" TEXT,
    "loyalty_number" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_block" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'tentative',
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "release_strategy" TEXT NOT NULL DEFAULT 'none',
    "release_date" DATE,
    "master_folio_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_block_allotment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_block_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "stay_date" DATE NOT NULL,
    "total_rooms" INTEGER NOT NULL,
    "picked_up" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "group_block_allotment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "confirmation_number" TEXT NOT NULL,
    "primary_guest_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "source" TEXT NOT NULL DEFAULT 'direct',
    "channel_reference" TEXT,
    "hold_expires_at" TIMESTAMPTZ,
    "external_package_id" TEXT,
    "room_type_id" UUID NOT NULL,
    "room_id" UUID,
    "rate_plan_id" UUID,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "special_requests" TEXT,
    "group_block_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_status_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reservation_id" UUID NOT NULL,
    "from_status" TEXT NOT NULL,
    "to_status" TEXT NOT NULL,
    "actor_employee_id" UUID,
    "actor_type" TEXT NOT NULL DEFAULT 'employee',
    "note" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "reservation_id" UUID,
    "owner_type" TEXT NOT NULL DEFAULT 'guest',
    "owner_guest_id" UUID,
    "owner_company" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "currency" CHAR(3) NOT NULL DEFAULT 'RSD',
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_line_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "folio_id" UUID NOT NULL,
    "charge_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "revenue_category" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "voided_at" TIMESTAMPTZ,
    "posted_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folio_line_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "folio_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'RSD',
    "method" TEXT NOT NULL,
    "payment_token" TEXT,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'captured',
    "posted_by" UUID,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "room_id" UUID,
    "reservation_id" UUID,
    "task_type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigned_to" UUID,
    "due_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_booking" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reservation_id" UUID NOT NULL,
    "guest_profile_id" UUID NOT NULL,
    "activity_name" TEXT NOT NULL,
    "provider" TEXT,
    "external_ref" TEXT,
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "pax_count" INTEGER NOT NULL DEFAULT 1,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'RSD',
    "status" TEXT NOT NULL DEFAULT 'booked',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "employee_id" UUID,
    "role_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "forecast_source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_clock_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "device_reference" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_clock_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_certification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "certification_type" TEXT NOT NULL,
    "issued_at" DATE NOT NULL,
    "expires_at" DATE,
    "verified_by_employee_id" UUID,
    "document_reference" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "gl_account_code" TEXT NOT NULL,
    "debit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "department" TEXT,
    "description" TEXT NOT NULL,
    "source_reference" UUID,
    "exported_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "property_id" UUID,
    "actor_employee_id" UUID,
    "actor_type" TEXT NOT NULL DEFAULT 'employee',
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID,
    "before_state" JSONB,
    "after_state" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "prev_event_hash" TEXT,
    "event_hash" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrective_action" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "action_taken" TEXT NOT NULL,
    "resolved_by_employee_id" UUID,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corrective_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "haccp_ccp_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "ccp_type" TEXT NOT NULL,
    "location_reference" TEXT,
    "reading_value" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'C',
    "threshold_min" DECIMAL(10,2),
    "threshold_max" DECIMAL(10,2),
    "pass_fail" BOOLEAN NOT NULL,
    "staff_employee_id" UUID,
    "corrective_action_id" UUID,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "haccp_ccp_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_report" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "incident_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "involved_guest_id" UUID,
    "involved_employee_id" UUID,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "evidence_refs" JSONB NOT NULL DEFAULT '[]',
    "root_cause" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reported_by_employee_id" UUID,
    "insurance_claim_reference" TEXT,
    "corrective_action_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "contract_start" DATE,
    "contract_end" DATE,
    "access_code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corporate_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esg_metric" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "metric_type" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "value" DECIMAL(15,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "esg_metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "program" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "audit_date" DATE,
    "expiry_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_point_transaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guest_profile_id" UUID NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source_reservation_id" UUID,
    "earned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,
    "hold_until" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "description" TEXT,

    CONSTRAINT "loyalty_point_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_tier" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tier_name" TEXT NOT NULL,
    "qualifying_nights" INTEGER,
    "qualifying_stays" INTEGER,
    "qualifying_spend" DECIMAL(12,2),
    "benefits" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "loyalty_tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_tier_assignment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guest_profile_id" UUID NOT NULL,
    "tier_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "qualifying_period" TEXT,

    CONSTRAINT "loyalty_tier_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_outlet" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "outlet_type" TEXT NOT NULL DEFAULT 'restaurant',
    "total_seats" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dining_outlet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_table" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "outlet_id" UUID NOT NULL,
    "table_number" TEXT NOT NULL,
    "seat_capacity" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'available',
    "current_booking_id" UUID,

    CONSTRAINT "dining_table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_reservation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "outlet_id" UUID NOT NULL,
    "table_id" UUID,
    "guest_profile_id" UUID,
    "party_size" INTEGER NOT NULL DEFAULT 2,
    "reservation_time" TIMESTAMPTZ NOT NULL,
    "duration_minutes_estimate" INTEGER NOT NULL DEFAULT 90,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dining_reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spa_resource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "external_ref" TEXT,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "can_exceed_capacity" BOOLEAN NOT NULL DEFAULT false,
    "room_category" TEXT,
    "last_synced_at" TIMESTAMPTZ,

    CONSTRAINT "spa_resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spa_resource_status" (
    "spa_resource_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "status_since" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_appointment_reference" TEXT,

    CONSTRAINT "spa_resource_status_pkey" PRIMARY KEY ("spa_resource_id")
);

-- CreateTable
CREATE TABLE "spa_resource_blockout" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "spa_resource_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "reason" TEXT,

    CONSTRAINT "spa_resource_blockout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "function_space" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity_by_setup" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "function_space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "function_space_booking" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "function_space_id" UUID NOT NULL,
    "event_reference" TEXT,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "setup_type" TEXT,
    "buffer_before_minutes" INTEGER NOT NULL DEFAULT 0,
    "buffer_after_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'tentative',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "function_space_booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occupancy_snapshot_daily" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_category" TEXT,
    "snapshot_date" DATE NOT NULL,
    "total_units" INTEGER NOT NULL,
    "occupied_units" INTEGER NOT NULL,
    "available_units" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'night_audit',

    CONSTRAINT "occupancy_snapshot_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_property_org" ON "property"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_type_property_id_code_key" ON "room_type"("property_id", "code");

-- CreateIndex
CREATE INDEX "idx_room_property" ON "room"("property_id");

-- CreateIndex
CREATE INDEX "idx_room_type" ON "room"("room_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_property_id_room_number_key" ON "room"("property_id", "room_number");

-- CreateIndex
CREATE INDEX "idx_room_status_event_room" ON "room_status_event"("room_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_rate_plan_corporate" ON "rate_plan"("corporate_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_plan_property_id_code_key" ON "rate_plan"("property_id", "code");

-- CreateIndex
CREATE INDEX "idx_rate_plan_date" ON "rate"("rate_plan_id", "stay_date");

-- CreateIndex
CREATE INDEX "idx_rate_room_type_date" ON "rate"("room_type_id", "stay_date");

-- CreateIndex
CREATE UNIQUE INDEX "rate_rate_plan_id_room_type_id_stay_date_key" ON "rate"("rate_plan_id", "room_type_id", "stay_date");

-- CreateIndex
CREATE INDEX "idx_guest_org_email" ON "guest_profile"("organization_id", "email");

-- CreateIndex
CREATE INDEX "idx_guest_loyalty" ON "guest_profile"("organization_id", "loyalty_number");

-- CreateIndex
CREATE INDEX "idx_employee_property" ON "employee"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_block_allotment_group_block_id_room_type_id_stay_date_key" ON "group_block_allotment"("group_block_id", "room_type_id", "stay_date");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_confirmation_number_key" ON "reservation"("confirmation_number");

-- CreateIndex
CREATE INDEX "idx_reservation_dates" ON "reservation"("property_id", "check_in", "check_out");

-- CreateIndex
CREATE INDEX "idx_reservation_status" ON "reservation"("property_id", "status");

-- CreateIndex
CREATE INDEX "idx_reservation_external_package" ON "reservation"("external_package_id");

-- CreateIndex
CREATE INDEX "idx_reservation_guest" ON "reservation"("primary_guest_id");

-- CreateIndex
CREATE INDEX "idx_res_status_event" ON "reservation_status_event"("reservation_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_folio_reservation" ON "folio"("reservation_id");

-- CreateIndex
CREATE INDEX "idx_folio_line_item_folio" ON "folio_line_item"("folio_id", "charge_date");

-- CreateIndex
CREATE INDEX "idx_payment_folio" ON "payment"("folio_id");

-- CreateIndex
CREATE INDEX "idx_task_property_status" ON "task"("property_id", "status");

-- CreateIndex
CREATE INDEX "idx_task_room" ON "task"("room_id");

-- CreateIndex
CREATE INDEX "idx_shift_property_dates" ON "shift"("property_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "idx_time_clock_employee" ON "time_clock_event"("employee_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_staff_cert_employee" ON "staff_certification"("employee_id");

-- CreateIndex
CREATE INDEX "idx_journal_entry_property_date" ON "journal_entry"("property_id", "business_date");

-- CreateIndex
CREATE INDEX "idx_audit_event_org_time" ON "audit_event"("organization_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_event_resource" ON "audit_event"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "idx_haccp_log_property_time" ON "haccp_ccp_log"("property_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_incident_property_time" ON "incident_report"("property_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "corporate_account_access_code_key" ON "corporate_account"("access_code");

-- CreateIndex
CREATE INDEX "idx_loyalty_txn_guest" ON "loyalty_point_transaction"("guest_profile_id", "earned_at");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_tier_tier_name_key" ON "loyalty_tier"("tier_name");

-- CreateIndex
CREATE UNIQUE INDEX "dining_table_outlet_id_table_number_key" ON "dining_table"("outlet_id", "table_number");

-- CreateIndex
CREATE INDEX "idx_dining_res_outlet_time" ON "dining_reservation"("outlet_id", "reservation_time");

-- CreateIndex
CREATE INDEX "idx_spa_blockout_resource" ON "spa_resource_blockout"("spa_resource_id", "start_at");

-- CreateIndex
CREATE INDEX "idx_fn_space_booking_time" ON "function_space_booking"("function_space_id", "start_at");

-- CreateIndex
CREATE INDEX "idx_occupancy_snapshot_date" ON "occupancy_snapshot_daily"("property_id", "snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "occupancy_snapshot_daily_property_id_resource_type_resource_key" ON "occupancy_snapshot_daily"("property_id", "resource_type", "resource_category", "snapshot_date");

-- AddForeignKey
ALTER TABLE "property" ADD CONSTRAINT "property_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_type" ADD CONSTRAINT "room_type_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room" ADD CONSTRAINT "room_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room" ADD CONSTRAINT "room_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_status_event" ADD CONSTRAINT "room_status_event_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_group" ADD CONSTRAINT "rate_group_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plan" ADD CONSTRAINT "rate_plan_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plan" ADD CONSTRAINT "rate_plan_rate_group_id_fkey" FOREIGN KEY ("rate_group_id") REFERENCES "rate_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plan" ADD CONSTRAINT "rate_plan_corporate_account_id_fkey" FOREIGN KEY ("corporate_account_id") REFERENCES "corporate_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate" ADD CONSTRAINT "rate_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate" ADD CONSTRAINT "rate_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_profile" ADD CONSTRAINT "guest_profile_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_block" ADD CONSTRAINT "group_block_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_block_allotment" ADD CONSTRAINT "group_block_allotment_group_block_id_fkey" FOREIGN KEY ("group_block_id") REFERENCES "group_block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_block_allotment" ADD CONSTRAINT "group_block_allotment_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_primary_guest_id_fkey" FOREIGN KEY ("primary_guest_id") REFERENCES "guest_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_status_event" ADD CONSTRAINT "reservation_status_event_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio" ADD CONSTRAINT "folio_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_line_item" ADD CONSTRAINT "folio_line_item_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_booking" ADD CONSTRAINT "activity_booking_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_booking" ADD CONSTRAINT "activity_booking_guest_profile_id_fkey" FOREIGN KEY ("guest_profile_id") REFERENCES "guest_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift" ADD CONSTRAINT "shift_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift" ADD CONSTRAINT "shift_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift" ADD CONSTRAINT "shift_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_event" ADD CONSTRAINT "time_clock_event_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_event" ADD CONSTRAINT "time_clock_event_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_certification" ADD CONSTRAINT "staff_certification_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_source_reference_fkey" FOREIGN KEY ("source_reference") REFERENCES "folio_line_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_action" ADD CONSTRAINT "corrective_action_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_action" ADD CONSTRAINT "corrective_action_resolved_by_employee_id_fkey" FOREIGN KEY ("resolved_by_employee_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "haccp_ccp_log" ADD CONSTRAINT "haccp_ccp_log_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "haccp_ccp_log" ADD CONSTRAINT "haccp_ccp_log_staff_employee_id_fkey" FOREIGN KEY ("staff_employee_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "haccp_ccp_log" ADD CONSTRAINT "haccp_ccp_log_corrective_action_id_fkey" FOREIGN KEY ("corrective_action_id") REFERENCES "corrective_action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_report" ADD CONSTRAINT "incident_report_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_report" ADD CONSTRAINT "incident_report_involved_guest_id_fkey" FOREIGN KEY ("involved_guest_id") REFERENCES "guest_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_report" ADD CONSTRAINT "incident_report_involved_employee_id_fkey" FOREIGN KEY ("involved_employee_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_report" ADD CONSTRAINT "incident_report_reported_by_employee_id_fkey" FOREIGN KEY ("reported_by_employee_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_report" ADD CONSTRAINT "incident_report_corrective_action_id_fkey" FOREIGN KEY ("corrective_action_id") REFERENCES "corrective_action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_account" ADD CONSTRAINT "corporate_account_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esg_metric" ADD CONSTRAINT "esg_metric_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification" ADD CONSTRAINT "certification_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_point_transaction" ADD CONSTRAINT "loyalty_point_transaction_guest_profile_id_fkey" FOREIGN KEY ("guest_profile_id") REFERENCES "guest_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_point_transaction" ADD CONSTRAINT "loyalty_point_transaction_source_reservation_id_fkey" FOREIGN KEY ("source_reservation_id") REFERENCES "reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_tier_assignment" ADD CONSTRAINT "loyalty_tier_assignment_guest_profile_id_fkey" FOREIGN KEY ("guest_profile_id") REFERENCES "guest_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_tier_assignment" ADD CONSTRAINT "loyalty_tier_assignment_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "loyalty_tier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_outlet" ADD CONSTRAINT "dining_outlet_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_table" ADD CONSTRAINT "dining_table_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "dining_outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_table" ADD CONSTRAINT "dining_table_current_booking_id_fkey" FOREIGN KEY ("current_booking_id") REFERENCES "dining_reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_reservation" ADD CONSTRAINT "dining_reservation_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "dining_outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_reservation" ADD CONSTRAINT "dining_reservation_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "dining_table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_reservation" ADD CONSTRAINT "dining_reservation_guest_profile_id_fkey" FOREIGN KEY ("guest_profile_id") REFERENCES "guest_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spa_resource" ADD CONSTRAINT "spa_resource_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spa_resource_status" ADD CONSTRAINT "spa_resource_status_spa_resource_id_fkey" FOREIGN KEY ("spa_resource_id") REFERENCES "spa_resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spa_resource_blockout" ADD CONSTRAINT "spa_resource_blockout_spa_resource_id_fkey" FOREIGN KEY ("spa_resource_id") REFERENCES "spa_resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "function_space" ADD CONSTRAINT "function_space_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "function_space_booking" ADD CONSTRAINT "function_space_booking_function_space_id_fkey" FOREIGN KEY ("function_space_id") REFERENCES "function_space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupancy_snapshot_daily" ADD CONSTRAINT "occupancy_snapshot_daily_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

