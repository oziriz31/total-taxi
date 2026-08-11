export type ReasonCode =
  | "A_OVERTIME"
  | "B_NIGHT_SHIFT"
  | "C_APPOINTMENT"
  | "D_COMPANY_EVENT"
  | "E_AIRPORT_TRANSFER"
  | "F_MEDICAL"
  | "G_EMERGENCY_WORK"
  | "H_EXCEPTIONAL_CASE";

export type RequestStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "BOOKED"
  | "COMPLETED"
  | "FLAGGED_FOR_REVIEW"
  | "PERSONAL_USE_CONFIRMED"
  | "CLEARED";

export interface ReasonCodeMeta {
  code: ReasonCode;
  label: string;
  description: string;
  requiresDeclaration: boolean;
  requiresManComApprover: boolean;
  requiresWorkAttendanceClearance: boolean;
}

export interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string;
  managerId: string | null;
  isManCom: boolean;
  hasCompanyVehicle: boolean;
  hasTransportAllowance: boolean;
  manager?: { id: string; name: string } | null;
}

export interface TaxiBookingRequest {
  id: string;
  employeeId: string;
  employee?: Employee;
  positionSnapshot: string;
  departmentSnapshot: string;
  reasonCode: ReasonCode;
  justification: string | null;
  declarationConfirmed: boolean;
  journeyFrom: string;
  journeyTo: string;
  travelDate: string;
  pickupTime: string;
  taxiContactNumber: string | null;
  status: RequestStatus;
  lateBooking: boolean;
  approverId: string | null;
  approver?: Employee | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  workAttendanceClearedAt: string | null;
  actualPickupAt: string | null;
  actualDropoffAt: string | null;
  personalUseFlag: boolean;
  sharedGroupId: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  auditEvents?: AuditEvent[];
  personalUseCharge?: PersonalUseCharge | null;
}

export interface AuditEvent {
  id: string;
  requestId: string;
  actorId: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  note: string | null;
  createdAt: string;
}

export interface PersonalUseCharge {
  id: string;
  requestId: string;
  employeeId: string;
  employee?: Employee;
  request?: TaxiBookingRequest;
  amount: number;
  recoveryMethod: "CASHIER_PAYMENT" | "SALARY_DEDUCTION";
  employeeConsentRef: string | null;
  status: "PENDING" | "RECOVERED";
  disciplinaryFlag: boolean;
  createdAt: string;
}

export interface InvoiceBatch {
  id: string;
  month: string;
  receivedAt: string;
  totalAmount: number;
  validatedByHRId: string | null;
  validatedBy?: Employee | null;
  validatedAt: string | null;
  escalatedToManCom: boolean;
  _count?: { lines: number };
  lines?: InvoiceLine[];
}

export interface InvoiceLine {
  id: string;
  batchId: string;
  vendorTripRef: string | null;
  date: string;
  fromLocation: string;
  toLocation: string;
  amount: number;
  waitingTimeCharge: number;
  matchedRequestId: string | null;
  matchedRequest?: TaxiBookingRequest | null;
  matchStatus: "MATCHED" | "UNMATCHED" | "DISPUTED";
  createdAt: string;
}
