import { ReasonCode } from "./enums";

// Mirrors docs/taxi-management-module-spec.md section 1.2 (Appendix 1 "Approved
// Reasons for Taxi Use" table). Kept as data, not scattered `if`s, so the
// per-reason preconditions stay auditable against the policy document.
export interface ReasonCodeMeta {
  code: ReasonCode;
  label: string;
  description: string;
  requiresDeclaration: boolean; // "all alternative transport options exhausted"
  requiresManComApprover: boolean; // must route to a ManCom member, not just N+1
  requiresWorkAttendanceClearance: boolean; // reason G's second gate
}

export const REASON_CODES: ReasonCodeMeta[] = [
  {
    code: "A_OVERTIME",
    label: "A - Overtime",
    description:
      "Employees who are not eligible for a company vehicle or transport allowance (other than bus fare) and stay after 16:30 to complete authorised extra work. Requires at least 2 hours of overtime, duly authorised by N+1. Taxi sharing is mandatory for multiple employees travelling to the same locality.",
    requiresDeclaration: true,
    requiresManComApprover: false,
    requiresWorkAttendanceClearance: false,
  },
  {
    code: "B_NIGHT_SHIFT",
    label: "B - Night Shift",
    description:
      "Night shift or employees working after 16:30 who normally travel by public transport but are delayed unexpectedly beyond their normal finishing time and/or their public transport has ceased.",
    requiresDeclaration: true,
    requiresManComApprover: false,
    requiresWorkAttendanceClearance: false,
  },
  {
    code: "C_APPOINTMENT",
    label: "C - Appointment",
    description:
      "Employees not eligible for a company vehicle having to attend an appointment during working hours outside the office. All other transport options must be exhausted prior to booking.",
    requiresDeclaration: true,
    requiresManComApprover: false,
    requiresWorkAttendanceClearance: false,
  },
  {
    code: "D_COMPANY_EVENT",
    label: "D - Company Event",
    description:
      "Being requested to attend an event hosted by TEMML after normal working hours or during the weekend where all other options for transport (Messenger/Drivers) have been exhausted prior to booking.",
    requiresDeclaration: true,
    requiresManComApprover: false,
    requiresWorkAttendanceClearance: false,
  },
  {
    code: "E_AIRPORT_TRANSFER",
    label: "E - Airport Transfer",
    description:
      "To drop off to or pick up employees from the airport for official work-related travel outside normal working hours where the Messenger/Drivers are unavailable to transport employees.",
    requiresDeclaration: true,
    requiresManComApprover: false,
    requiresWorkAttendanceClearance: false,
  },
  {
    code: "F_MEDICAL",
    label: "F - Medical",
    description:
      "Being sent home from work due to ill health or other compassionate grounds.",
    requiresDeclaration: false, // urgency overrides exhaustion-of-alternatives requirement
    requiresManComApprover: false,
    requiresWorkAttendanceClearance: false,
  },
  {
    code: "G_EMERGENCY_WORK",
    label: "G - Emergency Work",
    description:
      "Being requested to work during a major incident when public transport is not available or too time consuming. The employee must receive clear authorisation from their ManCom member prior to attending work as well as prior to booking the taxi.",
    requiresDeclaration: true,
    requiresManComApprover: true,
    requiresWorkAttendanceClearance: true,
  },
  {
    code: "H_EXCEPTIONAL_CASE",
    label: "H - Exceptional Case",
    description:
      "Employees under exceptional circumstances, approved by their respective ManCom member.",
    requiresDeclaration: true,
    requiresManComApprover: true,
    requiresWorkAttendanceClearance: false,
  },
];

export function getReasonMeta(code: ReasonCode): ReasonCodeMeta {
  const meta = REASON_CODES.find((r) => r.code === code);
  if (!meta) throw new Error(`Unknown reason code: ${code}`);
  return meta;
}
