import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

export function MyRequestsPage() {
  const { currentEmployee } = useIdentity();
  const [params] = useSearchParams();
  const highlight = params.get("highlight");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [contactInputs, setContactInputs] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: requests, reload } = useFetch(
    () => api.get<TaxiBookingRequest[]>("/requests?mine=true"),
    [currentEmployee?.id]
  );

  async function runAction(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      reload();
    } catch (err: any) {
      setActionError(err.message ?? "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!currentEmployee) return <Typography>Loading…</Typography>;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
        My Taxi Requests
      </Typography>
      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <Stack spacing={1.5}>
        {requests?.length === 0 && (
          <Card variant="outlined">
            <CardContent sx={{ textAlign: "center", py: 4 }}>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                No requests yet.
              </Typography>
              <Button component={Link} to="/new-request" variant="contained">
                Create your first request
              </Button>
            </CardContent>
          </Card>
        )}

        {requests?.map((r) => (
          <Card key={r.id} variant="outlined" sx={r.id === highlight ? { borderColor: "primary.main", borderWidth: 2 } : undefined}>
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography sx={{ fontWeight: 700 }} component="span">
                    {r.journeyFrom} → {r.journeyTo}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1.5 }}>
                    {new Date(r.travelDate).toLocaleDateString()} ·{" "}
                    {new Date(r.pickupTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Typography>
                </Box>
                <StatusBadge status={r.status} />
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Reason: {r.reasonCode.replace(/_/g, " ")}
                {r.lateBooking && <Box component="span" color="warning.main"> · submitted after policy deadline</Box>}
              </Typography>

              {r.reasonCode === "G_EMERGENCY_WORK" && r.status === "DRAFT" && (
                <Typography variant="caption" sx={{ display: "block", color: r.workAttendanceClearedAt ? "success.main" : "warning.main" }}>
                  Work-attendance clearance: {r.workAttendanceClearedAt ? "cleared" : "awaiting ManCom clearance"}
                </Typography>
              )}

              {r.rejectionReason && (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  Rejected: {r.rejectionReason}
                </Alert>
              )}
              {r.taxiContactNumber && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Taxi contact: {r.taxiContactNumber}
                </Typography>
              )}
              {r.personalUseCharge && (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  Personal-use charge: {r.personalUseCharge.amount} ({r.personalUseCharge.status})
                </Alert>
              )}

              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mt: 2 }}>
                {r.status === "DRAFT" && (
                  <>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={busyId === r.id || (r.reasonCode === "G_EMERGENCY_WORK" && !r.workAttendanceClearedAt)}
                      onClick={() => runAction(r.id, () => api.post(`/requests/${r.id}/submit`))}
                    >
                      Submit for Approval
                    </Button>
                    <Button
                      variant="outlined"
                      color="inherit"
                      size="small"
                      disabled={busyId === r.id}
                      onClick={() => runAction(r.id, () => api.post(`/requests/${r.id}/cancel`))}
                    >
                      Cancel
                    </Button>
                  </>
                )}

                {r.status === "PENDING_APPROVAL" && (
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    disabled={busyId === r.id}
                    onClick={() => runAction(r.id, () => api.post(`/requests/${r.id}/cancel`))}
                  >
                    Cancel
                  </Button>
                )}

                {r.status === "APPROVED" && (
                  <>
                    <TextField
                      size="small"
                      placeholder="Taxi contact number"
                      value={contactInputs[r.id] ?? ""}
                      onChange={(e) => setContactInputs((c) => ({ ...c, [r.id]: e.target.value }))}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      disabled={busyId === r.id || !contactInputs[r.id]}
                      onClick={() =>
                        runAction(r.id, () =>
                          api.post(`/requests/${r.id}/book`, { taxiContactNumber: contactInputs[r.id] })
                        )
                      }
                    >
                      Confirm Booking
                    </Button>
                  </>
                )}

                {r.status === "BOOKED" && (
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    disabled={busyId === r.id}
                    onClick={() => runAction(r.id, () => api.post(`/requests/${r.id}/complete`))}
                  >
                    Mark Trip Completed
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
