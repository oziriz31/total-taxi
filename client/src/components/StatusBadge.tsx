import Chip from "@mui/material/Chip";
import EditNoteIcon from "@mui/icons-material/EditNote";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import LocalTaxiIcon from "@mui/icons-material/LocalTaxi";
import ErrorIcon from "@mui/icons-material/Error";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import type { SvgIconComponent } from "@mui/icons-material";
import type { ChipProps } from "@mui/material/Chip";
import type { RequestStatus } from "../api/types";

// Status -> {label, MUI semantic color, icon}. The icon matters as much as
// the color here — color-blind users shouldn't have to rely on hue alone
// to tell "Approved" from "Rejected" (docs/ui-ux-design-requirements.md
// section 7).
const STATUS_META: Record<RequestStatus, { label: string; color: ChipProps["color"]; icon: SvgIconComponent }> = {
  DRAFT: { label: "Draft", color: "default", icon: EditNoteIcon },
  PENDING_APPROVAL: { label: "Pending approval", color: "warning", icon: HourglassEmptyIcon },
  APPROVED: { label: "Approved", color: "info", icon: CheckCircleIcon },
  REJECTED: { label: "Rejected", color: "error", icon: CancelIcon },
  CANCELLED: { label: "Cancelled", color: "default", icon: CancelIcon },
  BOOKED: { label: "Booked", color: "secondary", icon: LocalTaxiIcon },
  COMPLETED: { label: "Completed", color: "success", icon: CheckCircleIcon },
  FLAGGED_FOR_REVIEW: { label: "Flagged for review", color: "error", icon: ReportProblemIcon },
  PERSONAL_USE_CONFIRMED: { label: "Personal use confirmed", color: "error", icon: ErrorIcon },
  CLEARED: { label: "Cleared", color: "success", icon: CheckCircleIcon },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Chip
      size="small"
      color={meta.color}
      icon={<Icon fontSize="small" />}
      label={meta.label}
      sx={{ fontWeight: 600 }}
    />
  );
}
