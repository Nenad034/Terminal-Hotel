-- AlterTable
ALTER TABLE "property" ADD COLUMN     "tourist_tax_per_night" DECIMAL(8,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "fiscal_document" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "folio_id" UUID NOT NULL,
    "payment_id" UUID,
    "pfr_type" TEXT NOT NULL DEFAULT 'V-PFR',
    "fiscal_number" TEXT NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "vat_breakdown" JSONB NOT NULL DEFAULT '{}',
    "qr_code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_response" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "fiscal_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sef_invoice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "folio_id" UUID NOT NULL,
    "corporate_account_id" UUID,
    "invoice_number" TEXT NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMPTZ,
    "sef_response" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sef_invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eturista_batch" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "guest_count" INTEGER NOT NULL DEFAULT 0,
    "tourist_tax_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMPTZ,
    "payload" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eturista_batch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_fiscal_doc_property_date" ON "fiscal_document"("property_id", "issued_at");

-- CreateIndex
CREATE UNIQUE INDEX "sef_invoice_invoice_number_key" ON "sef_invoice"("invoice_number");

-- CreateIndex
CREATE INDEX "idx_sef_invoice_property_date" ON "sef_invoice"("property_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_eturista_batch_property_period" ON "eturista_batch"("property_id", "period_start");

-- AddForeignKey
ALTER TABLE "fiscal_document" ADD CONSTRAINT "fiscal_document_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_document" ADD CONSTRAINT "fiscal_document_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sef_invoice" ADD CONSTRAINT "sef_invoice_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sef_invoice" ADD CONSTRAINT "sef_invoice_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sef_invoice" ADD CONSTRAINT "sef_invoice_corporate_account_id_fkey" FOREIGN KEY ("corporate_account_id") REFERENCES "corporate_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eturista_batch" ADD CONSTRAINT "eturista_batch_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

