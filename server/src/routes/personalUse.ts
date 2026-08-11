import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireCurrentUser } from "../lib/currentUser";
import { recordAuditEvent } from "../lib/audit";
import { asRequestStatus } from "../lib/enums";

export const personalUseRouter = Router();
personalUseRouter.use(requireCurrentUser);

// HR flags a request during monthly monitoring (spec section 5, step 3).
personalUseRouter.post("/requests/:id/flag-for-review", async (req, res) => {
  const request = await prisma.taxiBookingRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: "Request not found" });

  const updated = await prisma.taxiBookingRequest.update({
    where: { id: request.id },
    data: { status: "FLAGGED_FOR_REVIEW" },
  });
  await recordAuditEvent({
    requestId: request.id,
    actorId: req.currentEmployeeId!,
    fromStatus: asRequestStatus(request.status),
    toStatus: "FLAGGED_FOR_REVIEW",
  });
  res.json(updated);
});

personalUseRouter.post("/requests/:id/clear-review", async (req, res) => {
  const request = await prisma.taxiBookingRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: "Request not found" });

  const updated = await prisma.taxiBookingRequest.update({
    where: { id: request.id },
    data: { status: "CLEARED" },
  });
  await recordAuditEvent({
    requestId: request.id,
    actorId: req.currentEmployeeId!,
    fromStatus: asRequestStatus(request.status),
    toStatus: "CLEARED",
  });
  res.json(updated);
});

const confirmSchema = z.object({
  amount: z.number().positive(),
  recoveryMethod: z.enum(["CASHIER_PAYMENT", "SALARY_DEDUCTION"]),
  employeeConsentRef: z.string().optional(),
});

// Confirms personal use and raises the recoverable charge (spec section 4 & 5).
// Salary deduction requires documented employee consent per policy section 4.
personalUseRouter.post("/requests/:id/confirm-personal-use", async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.recoveryMethod === "SALARY_DEDUCTION" && !parsed.data.employeeConsentRef) {
    return res.status(422).json({ error: "Salary deduction requires recorded employee consent" });
  }

  const request = await prisma.taxiBookingRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: "Request not found" });

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const priorChargeCount = await prisma.personalUseCharge.count({
    where: { employeeId: request.employeeId, createdAt: { gte: twelveMonthsAgo } },
  });

  const [charge, updatedRequest] = await prisma.$transaction([
    prisma.personalUseCharge.create({
      data: {
        requestId: request.id,
        employeeId: request.employeeId,
        amount: parsed.data.amount,
        recoveryMethod: parsed.data.recoveryMethod,
        employeeConsentRef: parsed.data.employeeConsentRef,
        disciplinaryFlag: priorChargeCount >= 1, // repeat abuse (spec section 4)
      },
    }),
    prisma.taxiBookingRequest.update({
      where: { id: request.id },
      data: { status: "PERSONAL_USE_CONFIRMED", personalUseFlag: true },
    }),
  ]);

  await recordAuditEvent({
    requestId: request.id,
    actorId: req.currentEmployeeId!,
    fromStatus: asRequestStatus(request.status),
    toStatus: "PERSONAL_USE_CONFIRMED",
    note: charge.disciplinaryFlag ? "Repeat personal-use abuse — disciplinary flag raised" : undefined,
  });

  res.status(201).json({ charge, request: updatedRequest });
});

personalUseRouter.get("/personal-use-charges", async (req, res) => {
  const { employeeId, status } = req.query;
  const where: any = {};
  if (typeof employeeId === "string") where.employeeId = employeeId;
  if (typeof status === "string") where.status = status;

  const charges = await prisma.personalUseCharge.findMany({
    where,
    include: { employee: true, request: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(charges);
});

personalUseRouter.patch("/personal-use-charges/:id/recover", async (req, res) => {
  const charge = await prisma.personalUseCharge.update({
    where: { id: req.params.id },
    data: { status: "RECOVERED" },
  });
  res.json(charge);
});
