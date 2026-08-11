import type { RequestStatus } from "../api/types";

const STYLES: Record<RequestStatus, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: "#e5e7eb", fg: "#374151", label: "Draft" },
  PENDING_APPROVAL: { bg: "#fef3c7", fg: "#92400e", label: "Pending approval" },
  APPROVED: { bg: "#dbeafe", fg: "#1e40af", label: "Approved" },
  REJECTED: { bg: "#fee2e2", fg: "#991b1b", label: "Rejected" },
  CANCELLED: { bg: "#e5e7eb", fg: "#6b7280", label: "Cancelled" },
  BOOKED: { bg: "#e0e7ff", fg: "#3730a3", label: "Booked" },
  COMPLETED: { bg: "#d1fae5", fg: "#065f46", label: "Completed" },
  FLAGGED_FOR_REVIEW: { bg: "#fee2e2", fg: "#991b1b", label: "Flagged for review" },
  PERSONAL_USE_CONFIRMED: { bg: "#fecaca", fg: "#7f1d1d", label: "Personal use confirmed" },
  CLEARED: { bg: "#d1fae5", fg: "#065f46", label: "Cleared" },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const s = STYLES[status];
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        borderRadius: 999,
        padding: "2px 10px",
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}
