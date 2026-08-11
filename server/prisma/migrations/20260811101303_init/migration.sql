-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "managerId" TEXT,
    "isManCom" BOOLEAN NOT NULL DEFAULT false,
    "hasCompanyVehicle" BOOLEAN NOT NULL DEFAULT false,
    "hasTransportAllowance" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxiBookingRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "positionSnapshot" TEXT NOT NULL,
    "departmentSnapshot" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "justification" TEXT,
    "declarationConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "journeyFrom" TEXT NOT NULL,
    "journeyTo" TEXT NOT NULL,
    "travelDate" DATETIME NOT NULL,
    "pickupTime" DATETIME NOT NULL,
    "taxiContactNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "lateBooking" BOOLEAN NOT NULL DEFAULT false,
    "approverId" TEXT,
    "approvedAt" DATETIME,
    "rejectionReason" TEXT,
    "workAttendanceClearedAt" DATETIME,
    "actualPickupAt" DATETIME,
    "actualDropoffAt" DATETIME,
    "personalUseFlag" BOOLEAN NOT NULL DEFAULT false,
    "sharedGroupId" TEXT,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxiBookingRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaxiBookingRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxiVendorInvoiceBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "validatedByHRId" TEXT,
    "validatedAt" DATETIME,
    "escalatedToManCom" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TaxiVendorInvoiceBatch_validatedByHRId_fkey" FOREIGN KEY ("validatedByHRId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxiVendorInvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "vendorTripRef" TEXT,
    "date" DATETIME NOT NULL,
    "fromLocation" TEXT NOT NULL,
    "toLocation" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "waitingTimeCharge" REAL NOT NULL DEFAULT 0,
    "matchedRequestId" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxiVendorInvoiceLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "TaxiVendorInvoiceBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaxiVendorInvoiceLine_matchedRequestId_fkey" FOREIGN KEY ("matchedRequestId") REFERENCES "TaxiBookingRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PersonalUseCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "recoveryMethod" TEXT NOT NULL,
    "employeeConsentRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "disciplinaryFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonalUseCharge_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TaxiBookingRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PersonalUseCharge_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TaxiBookingRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalUseCharge_requestId_key" ON "PersonalUseCharge"("requestId");
