import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireCurrentUser } from "../lib/currentUser";
import { recordAuditEvent } from "../lib/audit";
import { getReasonMeta, REASON_CODES } from "../lib/reasonCodes";
import {
  assertApproverEligible,
  assertDeclarationSatisfied,
  findShareWindow,
  isLateBooking,
  RuleViolation,
  sameLocality,
} from "../lib/bookingRules";
import { REASON_CODE_VALUES, asReasonCode, asRequestStatus } from "../lib/enums";

export const requestsRouter = Router();
requestsRouter.use(requireCurrentUser);

function handleRuleViolation(res: any, err: unknown) {
  if (err instanceof RuleViolation) {
    return res.status(422).json({ error: err.message });
  }
  throw err;
}

requestsRouter.get("/reason-codes", (_req, res) => {
  res.json(REASON_CODES);
});

// List requests. Query params:
//   mine=true                        -> requests submitted by the current user
//   forApproval=true                 -> pending requests where current user is the resolved approver
//   needsWorkAttendanceClearance=true -> reason-G drafts awaiting ManCom clearance (spec 3.2)
//   status=PENDING_APPROVAL,...
requestsRouter.get("/", async (req, res) => {
  const { mine, forApproval, needsWorkAttendanceClearance, status } = req.query;
  const where: any = {};

  if (mine === "true") {
    where.employeeId = req.currentEmployeeId;
  }
  if (forApproval === "true") {
    const me = await prisma.employee.findUnique({ where: { id: req.currentEmployeeId! } });
    where.status = "PENDING_APPROVAL";
    if (me?.isManCom) {
      where.OR = [
        { employee: { managerId: req.currentEmployeeId } },
        { reasonCode: { in: ["G_EMERGENCY_WORK", "H_EXCEPTIONAL_CASE"] } },
      ];
    } else {
      where.employee = { managerId: req.currentEmployeeId };
    }
  }
  if (needsWorkAttendanceClearance === "true") {
    where.status = "DRAFT";
    where.reasonCode = "G_EMERGENCY_WORK";
    where.workAttendanceClearedAt = null;
  }
  if (typeof status === "string") {
    where.status = { in: status.split(",") };
  }

  const requests = await prisma.taxiBookingRequest.findMany({
    where,
    include: { employee: true, approver: true, personalUseCharge: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(requests);
});

requestsRouter.get("/:id", async (req, res) => {
  const request = await prisma.taxiBookingRequest.findUnique({
    where: { id: req.params.id },
    include: { employee: true, approver: true, personalUseCharge: true, auditEvents: { orderBy: { createdAt: "asc" } } },
  });
  if (!request) return res.status(404).json({ error: "Request not found" });
  res.json(request);
});

const createSchema = z.object({
  reasonCode: z.enum(REASON_CODE_VALUES),
  justification: z.string().optional(),
  declarationConfirmed: z.boolean().default(false),
  journeyFrom: z.string().min(1),
  journeyTo: z.string().min(1),
  travelDate: z.coerce.date(),
  pickupTime: z.coerce.date(),
});

// Create a Draft request (Appendix 1 form).
requestsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const employee = await prisma.employee.findUnique({ where: { id: req.currentEmployeeId! } });
  if (!employee) return res.status(401).json({ error: "Unknown employee" });

  const request = await prisma.taxiBookingRequest.create({
    data: {
      employeeId: employee.id,
      positionSnapshot: employee.position,
      departmentSnapshot: employee.department,
      status: "DRAFT",
      ...parsed.data,
    },
  });
  res.status(201).json(request);
});

const updateSchema = createSchema.partial();

requestsRouter.patch("/:id", async (req, res) => {
  const existing = await prisma.taxiBookingRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Request not found" });
  if (existing.employeeId !== req.currentEmployeeId) return res.status(403).json({ error: "Not your request" });
  if (existing.status !== "DRAFT") return res.status(409).json({ error: "Only draft requests can be edited" });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await prisma.taxiBookingRequest.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(updated);
});

// Reason G's first gate: ManCom clears the employee to attend work at all,
// distinct from and prior to the booking approval (spec section 3.2).
requestsRouter.post("/:id/clear-work-attendance", async (req, res) => {
  try {
    const request = await prisma.taxiBookingRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.reasonCode !== "G_EMERGENCY_WORK") {
      throw new RuleViolation("Work-attendance clearance only applies to reason G (Emergency Work).");
    }
    const actor = await prisma.employee.findUnique({ where: { id: req.currentEmployeeId! } });
    if (!actor?.isManCom) {
      throw new RuleViolation("Only a ManCom member can clear work attendance for emergency work.");
    }
    const updated = await prisma.taxiBookingRequest.update({
      where: { id: req.params.id },
      data: { workAttendanceClearedAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    handleRuleViolation(res, err);
  }
});

// Submit for approval: Draft -> PendingApproval.
requestsRouter.post("/:id/submit", async (req, res) => {
  try {
    const request = await prisma.taxiBookingRequest.findUnique({
      where: { id: req.params.id },
      include: { employee: true },
    });
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.employeeId !== req.currentEmployeeId) return res.status(403).json({ error: "Not your request" });
    if (request.status !== "DRAFT") return res.status(409).json({ error: "Request is not in Draft" });

    const reasonCode = asReasonCode(request.reasonCode);
    assertDeclarationSatisfied(reasonCode, request.declarationConfirmed);

    const meta = getReasonMeta(reasonCode);
    if (meta.requiresWorkAttendanceClearance && !request.workAttendanceClearedAt) {
      throw new RuleViolation(
        "Reason G requires ManCom clearance to attend work before the taxi booking can be submitted for approval."
      );
    }
    if (!meta.requiresManComApprover && !request.employee.managerId) {
      throw new RuleViolation(`${request.employee.name} has no N+1 manager on file to approve this request.`);
    }

    const submittedAt = new Date();
    const lateBooking = isLateBooking(reasonCode, request.travelDate, submittedAt);

    // Mandatory-sharing check for reason A (spec 3.4): surfaced as a
    // suggestion on the response, not auto-merged.
    let shareCandidates: any[] = [];
    if (reasonCode === "A_OVERTIME") {
      const { from, to } = findShareWindow(request.pickupTime);
      const candidates = await prisma.taxiBookingRequest.findMany({
        where: {
          id: { not: request.id },
          reasonCode: "A_OVERTIME",
          status: { in: ["APPROVED", "BOOKED"] },
          pickupTime: { gte: from, lte: to },
        },
        include: { employee: true },
      });
      shareCandidates = candidates.filter((c: (typeof candidates)[number]) =>
        sameLocality(c.journeyTo, request.journeyTo)
      );
    }

    const updated = await prisma.taxiBookingRequest.update({
      where: { id: request.id },
      data: { status: "PENDING_APPROVAL", submittedAt, lateBooking },
    });

    await recordAuditEvent({
      requestId: request.id,
      actorId: req.currentEmployeeId!,
      fromStatus: "DRAFT",
      toStatus: "PENDING_APPROVAL",
      note: lateBooking ? "Submitted after the policy deadline for this reason code" : undefined,
    });

    res.json({ request: updated, shareCandidates, lateBooking });
  } catch (err) {
    handleRuleViolation(res, err);
  }
});

const approveSchema = z.object({ note: z.string().optional() });

requestsRouter.post("/:id/approve", async (req, res) => {
  try {
    const request = await prisma.taxiBookingRequest.findUnique({
      where: { id: req.params.id },
      include: { employee: true },
    });
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "PENDING_APPROVAL") return res.status(409).json({ error: "Request is not pending approval" });

    const approver = await prisma.employee.findUnique({ where: { id: req.currentEmployeeId! } });
    if (!approver) return res.status(401).json({ error: "Unknown employee" });

    assertApproverEligible(approver, asReasonCode(request.reasonCode), request.employee);
    const { note } = approveSchema.parse(req.body ?? {});

    const updated = await prisma.taxiBookingRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", approverId: approver.id, approvedAt: new Date() },
    });
    await recordAuditEvent({
      requestId: request.id,
      actorId: approver.id,
      fromStatus: "PENDING_APPROVAL",
      toStatus: "APPROVED",
      note,
    });
    res.json(updated);
  } catch (err) {
    handleRuleViolation(res, err);
  }
});

const rejectSchema = z.object({ reason: z.string().min(1) });

requestsRouter.post("/:id/reject", async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const request = await prisma.taxiBookingRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.status !== "PENDING_APPROVAL") return res.status(409).json({ error: "Request is not pending approval" });

  const updated = await prisma.taxiBookingRequest.update({
    where: { id: request.id },
    data: { status: "REJECTED", rejectionReason: parsed.data.reason, approverId: req.currentEmployeeId },
  });
  await recordAuditEvent({
    requestId: request.id,
    actorId: req.currentEmployeeId!,
    fromStatus: "PENDING_APPROVAL",
    toStatus: "REJECTED",
    note: parsed.data.reason,
  });
  res.json(updated);
});

requestsRouter.post("/:id/cancel", async (req, res) => {
  const request = await prisma.taxiBookingRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.employeeId !== req.currentEmployeeId) return res.status(403).json({ error: "Not your request" });
  if (!["DRAFT", "PENDING_APPROVAL"].includes(request.status)) {
    return res.status(409).json({ error: "Only draft or pending requests can be cancelled" });
  }

  const updated = await prisma.taxiBookingRequest.update({
    where: { id: request.id },
    data: { status: "CANCELLED" },
  });
  await recordAuditEvent({
    requestId: request.id,
    actorId: req.currentEmployeeId!,
    fromStatus: asRequestStatus(request.status),
    toStatus: "CANCELLED",
  });
  res.json(updated);
});

const bookSchema = z.object({ taxiContactNumber: z.string().min(1), sharedGroupId: z.string().optional() });

requestsRouter.post("/:id/book", async (req, res) => {
  const parsed = bookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const request = await prisma.taxiBookingRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.status !== "APPROVED") return res.status(409).json({ error: "Request must be Approved before booking" });

  const updated = await prisma.taxiBookingRequest.update({
    where: { id: request.id },
    data: { status: "BOOKED", taxiContactNumber: parsed.data.taxiContactNumber, sharedGroupId: parsed.data.sharedGroupId },
  });
  await recordAuditEvent({
    requestId: request.id,
    actorId: req.currentEmployeeId!,
    fromStatus: "APPROVED",
    toStatus: "BOOKED",
  });
  res.json(updated);
});

const completeSchema = z.object({
  actualPickupAt: z.coerce.date().optional(),
  actualDropoffAt: z.coerce.date().optional(),
});

requestsRouter.post("/:id/complete", async (req, res) => {
  const parsed = completeSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const request = await prisma.taxiBookingRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.status !== "BOOKED") return res.status(409).json({ error: "Request must be Booked before completing" });

  const updated = await prisma.taxiBookingRequest.update({
    where: { id: request.id },
    data: {
      status: "COMPLETED",
      actualPickupAt: parsed.data.actualPickupAt ?? new Date(),
      actualDropoffAt: parsed.data.actualDropoffAt,
    },
  });
  await recordAuditEvent({
    requestId: request.id,
    actorId: req.currentEmployeeId!,
    fromStatus: "BOOKED",
    toStatus: "COMPLETED",
  });
  res.json(updated);
});
