import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import { api } from "../api/client";
import { useFetch } from "../api/useFetch";
import { useIdentity } from "../identity/IdentityContext";
import type { TaxiBookingRequest } from "../api/types";
import { StatusBadge } from "../components/StatusBadge";

export function ApprovalsPage() {
  const { currentEmployee } = useIdentity();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: pending, reload: reloadPending } = useFetch(
    () => api.get<TaxiBookingRequest[]>("/requests?forApproval=true"),
    [currentEmployee?.id]
  );

  const { data: needsClearance, reload: reloadClearance } = useFetch(
    () =>
      currentEmployee?.isManCom
        ? api.get<TaxiBookingRequest[]>("/requests?needsWorkAttendanceClearance=true")
        : Promise.resolve([]),
    [currentEmployee?.id, currentEmployee?.isManCom]
  );

  async function runAction(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      reloadPending();
      reloadClearance();
    } catch (err: any) {
      setError(err.message ?? "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!currentEmployee) return <Typography>Loading…</Typography>;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
        Approvals
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {currentEmployee.isManCom && needsClearance && needsClearance.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
            Emergency-work attendance clearance (reason G — separate gate before booking approval)
          </Typography>
          <Stack spacing={1.25}>
            {needsClearance.map((r) => (
              <Card key={r.id} variant="outlined">
                <CardContent
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    "&:last-child": { pb: 2 },
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>
                      {r.employee?.name} — {r.journeyFrom} → {r.journeyTo}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(r.travelDate).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    color="warning"
                    size="small"
                    disabled={busyId === r.id}
                    onClick={() => runAction(r.id, () => api.post(`/requests/${r.id}/clear-work-attendance`))}
                  >
                    Clear to attend work
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
          Pending booking approvals
        </Typography>
        <Stack spacing={1.25}>
          {pending?.length === 0 && (
            <Typography color="text.secondary">Nothing pending your approval.</Typography>
          )}
          {pending?.map((r) => (
            <Card key={r.id} variant="outlined">
              <CardContent>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                  <Box>
                    <Typography component="span" sx={{ fontWeight: 700 }}>
                      {r.employee?.name}
                    </Typography>
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      {r.reasonCode.replace(/_/g, " ")}
                    </Typography>
                  </Box>
                  <StatusBadge status={r.status} />
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
                  {r.journeyFrom} → {r.journeyTo} · {new Date(r.travelDate).toLocaleDateString()} ·{" "}
                  {new Date(r.pickupTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {r.lateBooking && <Box component="span" color="warning.main"> · late booking</Box>}
                </Typography>
                {r.justification && (
                  <Typography variant="body2" color="text.secondary">
                    Justification: {r.justification}
                  </Typography>
                )}

                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mt: 1.5 }}>
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    disabled={busyId === r.id}
                    onClick={() => runAction(r.id, () => api.post(`/requests/${r.id}/approve`))}
                  >
                    Approve
                  </Button>
                  <TextField
                    size="small"
                    placeholder="Rejection reason"
                    value={rejectReason[r.id] ?? ""}
                    onChange={(e) => setRejectReason((s) => ({ ...s, [r.id]: e.target.value }))}
                  />
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    disabled={busyId === r.id || !rejectReason[r.id]}
                    onClick={() =>
                      runAction(r.id, () => api.post(`/requests/${r.id}/reject`, { reason: rejectReason[r.id] }))
                    }
                  >
                    Reject
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
