// SQLite (Prisma's dev-mode datasource here) has no native enum support, so
// the schema stores these as plain strings. These are the single source of
// truth for valid values on the TypeScript side — swap the Prisma
// datasource to Postgres/SQL Server later and these can become real
// Prisma enums without touching call sites, since the string values match.

export const REASON_CODE_VALUES = [
  "A_OVERTIME",
  "B_NIGHT_SHIFT",
  "C_APPOINTMENT",
  "D_COMPANY_EVENT",
  "E_AIRPORT_TRANSFER",
  "F_MEDICAL",
  "G_EMERGENCY_WORK",
  "H_EXCEPTIONAL_CASE",
] as const;
export type ReasonCode = (typeof REASON_CODE_VALUES)[number];

export const REQUEST_STATUS_VALUES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "BOOKED",
  "COMPLETED",
  "FLAGGED_FOR_REVIEW",
  "PERSONAL_USE_CONFIRMED",
  "CLEARED",
] as const;
export type RequestStatus = (typeof REQUEST_STATUS_VALUES)[number];

export const RECOVERY_METHOD_VALUES = ["CASHIER_PAYMENT", "SALARY_DEDUCTION"] as const;
export type RecoveryMethod = (typeof RECOVERY_METHOD_VALUES)[number];

export const CHARGE_STATUS_VALUES = ["PENDING", "RECOVERED"] as const;
export type ChargeStatus = (typeof CHARGE_STATUS_VALUES)[number];

export const MATCH_STATUS_VALUES = ["MATCHED", "UNMATCHED", "DISPUTED"] as const;
export type MatchStatus = (typeof MATCH_STATUS_VALUES)[number];

// Narrowing casts for values read back from Prisma (typed as plain `string`
// since SQLite has no native enum support — see schema.prisma). Safe because
// these columns are only ever written through the zod-validated API routes.
export function asReasonCode(value: string): ReasonCode {
  return value as ReasonCode;
}
export function asRequestStatus(value: string): RequestStatus {
  return value as RequestStatus;
}
