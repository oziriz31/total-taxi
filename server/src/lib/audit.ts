import { RequestStatus } from "./enums";
import { prisma } from "./prisma";

export async function recordAuditEvent(params: {
  requestId: string;
  actorId: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  note?: string;
}) {
  return prisma.auditEvent.create({
    data: {
      requestId: params.requestId,
      actorId: params.actorId,
      fromStatus: params.fromStatus ?? undefined,
      toStatus: params.toStatus,
      note: params.note,
    },
  });
}
