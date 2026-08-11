import { prisma } from "./prisma";
import { sameLocality } from "./bookingRules";

/**
 * Spec section 5, step 2 — auto-match invoice lines to booking requests by
 * date + route. Only auto-matches when exactly one candidate is found;
 * ambiguous or absent matches are left for HR to resolve manually, since a
 * wrong auto-match would defeat the point of the reconciliation.
 */
export async function autoMatchBatch(batchId: string) {
  const lines = await prisma.taxiVendorInvoiceLine.findMany({
    where: { batchId, matchStatus: "UNMATCHED" },
  });

  let matched = 0;
  for (const line of lines) {
    const dayStart = new Date(line.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(line.date);
    dayEnd.setHours(23, 59, 59, 999);

    const candidates = await prisma.taxiBookingRequest.findMany({
      where: {
        status: { in: ["BOOKED", "COMPLETED"] },
        travelDate: { gte: dayStart, lte: dayEnd },
        invoiceLines: { none: {} },
      },
    });

    const routeMatches = candidates.filter(
      (c) => sameLocality(c.journeyFrom, line.fromLocation) && sameLocality(c.journeyTo, line.toLocation)
    );

    if (routeMatches.length === 1) {
      await prisma.taxiVendorInvoiceLine.update({
        where: { id: line.id },
        data: { matchedRequestId: routeMatches[0].id, matchStatus: "MATCHED" },
      });
      matched++;
    }
  }

  return { totalLines: lines.length, matched, unmatched: lines.length - matched };
}
