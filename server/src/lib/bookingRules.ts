import { Employee } from "@prisma/client";
import { ReasonCode } from "./enums";
import { getReasonMeta } from "./reasonCodes";

export class RuleViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleViolation";
  }
}

/**
 * Spec section 3.1 — declaration gate, with reason F exempted (urgency
 * overrides the exhaustion-of-alternatives requirement).
 */
export function assertDeclarationSatisfied(reasonCode: ReasonCode, declarationConfirmed: boolean) {
  const meta = getReasonMeta(reasonCode);
  if (meta.requiresDeclaration && !declarationConfirmed) {
    throw new RuleViolation(
      `Reason ${meta.label} requires confirming that all alternative transport options have been exhausted.`
    );
  }
}

/**
 * Spec section 3.2 — approver resolution. Returns the employee id that must
 * approve this request, or throws if the org chart can't satisfy the
 * ManCom requirement for reasons G/H.
 */
export function resolveRequiredApprover(requester: Employee, reasonCode: ReasonCode): { requiresManCom: boolean } {
  const meta = getReasonMeta(reasonCode);
  if (meta.requiresManComApprover) {
    return { requiresManCom: true };
  }
  if (!requester.managerId) {
    throw new RuleViolation(`${requester.name} has no N+1 manager on file to approve this request.`);
  }
  return { requiresManCom: false };
}

export function assertApproverEligible(approver: Employee, reasonCode: ReasonCode, requester: Employee) {
  const meta = getReasonMeta(reasonCode);
  if (meta.requiresManComApprover && !approver.isManCom) {
    throw new RuleViolation(
      `Reason ${meta.label} requires approval from a ManCom member, but ${approver.name} is not one.`
    );
  }
  if (!meta.requiresManComApprover && approver.id !== requester.managerId && !approver.isManCom) {
    throw new RuleViolation(`${approver.name} is not ${requester.name}'s N+1 manager.`);
  }
}

/**
 * Spec section 3.3 — booking deadlines. Returns whether this submission is
 * late relative to policy, without hard-blocking it (reason G exists
 * precisely for genuine emergencies).
 */
export function isLateBooking(
  reasonCode: ReasonCode,
  travelDate: Date,
  submittedAt: Date
): boolean {
  const isWeekendOrHoliday = [0, 6].includes(travelDate.getDay());

  if (reasonCode === "E_AIRPORT_TRANSFER" && isWeekendOrHoliday) {
    const twoDaysBefore = new Date(travelDate);
    twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);
    return submittedAt > twoDaysBefore;
  }

  if (reasonCode === "A_OVERTIME" && isWeekendOrHoliday) {
    const priorWorkingDay15h = new Date(travelDate);
    priorWorkingDay15h.setDate(priorWorkingDay15h.getDate() - 1);
    priorWorkingDay15h.setHours(15, 0, 0, 0);
    return submittedAt > priorWorkingDay15h;
  }

  if (reasonCode === "A_OVERTIME" || reasonCode === "B_NIGHT_SHIFT") {
    const sameDay15h = new Date(travelDate);
    sameDay15h.setHours(15, 0, 0, 0);
    return submittedAt > sameDay15h;
  }

  return false;
}

/**
 * Spec section 3.4 — mandatory sharing for reason A. Finds other
 * Approved/Booked requests heading to the same locality within a
 * reasonable time window of this one.
 */
export function findShareWindow(pickupTime: Date, windowMinutes = 60): { from: Date; to: Date } {
  const from = new Date(pickupTime.getTime() - windowMinutes * 60000);
  const to = new Date(pickupTime.getTime() + windowMinutes * 60000);
  return { from, to };
}

export function sameLocality(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
