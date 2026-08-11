import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireCurrentUser } from "../lib/currentUser";
import { autoMatchBatch } from "../lib/matching";

export const invoicesRouter = Router();
invoicesRouter.use(requireCurrentUser);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Spec section 5, step 1: ingest the monthly vendor report. CSV columns:
// vendorTripRef,date,from,to,amount,waitingTimeCharge
const csvRowSchema = z.object({
  vendorTripRef: z.string().optional(),
  date: z.coerce.date(),
  from: z.string().min(1),
  to: z.string().min(1),
  amount: z.coerce.number(),
  waitingTimeCharge: z.coerce.number().default(0),
});

invoicesRouter.get("/batches", async (_req, res) => {
  const batches = await prisma.taxiVendorInvoiceBatch.findMany({
    orderBy: { receivedAt: "desc" },
    include: { _count: { select: { lines: true } } },
  });
  res.json(batches);
});

invoicesRouter.get("/batches/:id", async (req, res) => {
  const batch = await prisma.taxiVendorInvoiceBatch.findUnique({
    where: { id: req.params.id },
    include: { lines: { include: { matchedRequest: { include: { employee: true } } } }, validatedBy: true },
  });
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  res.json(batch);
});

invoicesRouter.post("/batches", async (req, res) => {
  const { month } = z.object({ month: z.string().min(1) }).parse(req.body);
  const batch = await prisma.taxiVendorInvoiceBatch.create({ data: { month } });
  res.status(201).json(batch);
});

// Import lines either as an uploaded CSV file or a JSON array in the body.
invoicesRouter.post("/batches/:id/lines", upload.single("file"), async (req, res) => {
  const batch = await prisma.taxiVendorInvoiceBatch.findUnique({ where: { id: req.params.id } });
  if (!batch) return res.status(404).json({ error: "Batch not found" });

  let rawRows: any[];
  if (req.file) {
    rawRows = parse(req.file.buffer.toString("utf-8"), { columns: true, skip_empty_lines: true, trim: true });
  } else if (Array.isArray(req.body?.lines)) {
    rawRows = req.body.lines;
  } else {
    return res.status(400).json({ error: "Provide a CSV file upload or a JSON `lines` array" });
  }

  const rows = rawRows.map((r) => csvRowSchema.parse(r));

  const created = await prisma.$transaction(
    rows.map((r) =>
      prisma.taxiVendorInvoiceLine.create({
        data: {
          batchId: batch.id,
          vendorTripRef: r.vendorTripRef,
          date: r.date,
          fromLocation: r.from,
          toLocation: r.to,
          amount: r.amount,
          waitingTimeCharge: r.waitingTimeCharge,
        },
      })
    )
  );

  const totalAmount = await prisma.taxiVendorInvoiceLine.aggregate({
    where: { batchId: batch.id },
    _sum: { amount: true, waitingTimeCharge: true },
  });
  await prisma.taxiVendorInvoiceBatch.update({
    where: { id: batch.id },
    data: { totalAmount: (totalAmount._sum.amount ?? 0) + (totalAmount._sum.waitingTimeCharge ?? 0) },
  });

  res.status(201).json({ imported: created.length });
});

invoicesRouter.post("/batches/:id/match", async (req, res) => {
  const batch = await prisma.taxiVendorInvoiceBatch.findUnique({ where: { id: req.params.id } });
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  const result = await autoMatchBatch(batch.id);
  res.json(result);
});

const manualMatchSchema = z.object({ requestId: z.string().min(1) });

invoicesRouter.post("/lines/:id/match", async (req, res) => {
  const { requestId } = manualMatchSchema.parse(req.body);
  const line = await prisma.taxiVendorInvoiceLine.update({
    where: { id: req.params.id },
    data: { matchedRequestId: requestId, matchStatus: "MATCHED" },
  });
  res.json(line);
});

invoicesRouter.post("/lines/:id/dispute", async (req, res) => {
  const line = await prisma.taxiVendorInvoiceLine.update({
    where: { id: req.params.id },
    data: { matchStatus: "DISPUTED" },
  });
  res.json(line);
});

// HR validates the batch (spec section 5, step 4).
invoicesRouter.post("/batches/:id/validate", async (req, res) => {
  const batch = await prisma.taxiVendorInvoiceBatch.update({
    where: { id: req.params.id },
    data: { validatedByHRId: req.currentEmployeeId, validatedAt: new Date() },
  });
  res.json(batch);
});

// Escalate to ManCom for further scrutiny (spec section 5, step 5).
invoicesRouter.post("/batches/:id/escalate", async (req, res) => {
  const batch = await prisma.taxiVendorInvoiceBatch.update({
    where: { id: req.params.id },
    data: { escalatedToManCom: true },
  });
  res.json(batch);
});
