-- AlterTable
ALTER TABLE "employee" ADD COLUMN     "password_hash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "employee_property_id_email_key" ON "employee"("property_id", "email");

