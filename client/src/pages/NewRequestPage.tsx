import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Button from "@mui/material/Button";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import type { Dayjs } from "dayjs";
import { api } from "../api/client";
import { useFetch } from "../api/useFetch";
import { useIdentity } from "../identity/IdentityContext";
import type { ReasonCode, ReasonCodeMeta, TaxiBookingRequest } from "../api/types";

const emptyForm = {
  reasonCode: "" as ReasonCode | "",
  journeyFrom: "",
  journeyTo: "",
  travelDate: null as Dayjs | null,
  pickupTime: null as Dayjs | null,
  declarationConfirmed: false,
  justification: "",
};

export function NewRequestPage() {
  const { currentEmployee } = useIdentity();
  const navigate = useNavigate();
  // Depends on currentEmployee.id so this waits until the identity picker
  // has resolved a logged-in employee — otherwise this fetch races the
  // IdentityProvider's initial load and hits the API with no
  // X-Employee-Id header, which the server rejects with 401.
  const { data: reasonCodes } = useFetch(
    () => (currentEmployee ? api.get<ReasonCodeMeta[]>("/requests/reason-codes") : Promise.resolve(null)),
    [currentEmployee?.id]
  );
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedMeta = reasonCodes?.find((r) => r.code === form.reasonCode);

  if (!currentEmployee) return <Typography>Loading…</Typography>;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.reasonCode) {
      setError("Please select a reason for the taxi request.");
      return;
    }
    if (selectedMeta?.requiresDeclaration && !form.declarationConfirmed) {
      setError("You must confirm that all alternative transport options have been exhausted.");
      return;
    }
    if (!form.travelDate || !form.pickupTime) {
      setError("Please select a travel date and pick-up time.");
      return;
    }

    setSubmitting(true);
    try {
      const dateStr = form.travelDate.format("YYYY-MM-DD");
      const timeStr = form.pickupTime.format("HH:mm:ss");
      const created = await api.post<TaxiBookingRequest>("/requests", {
        reasonCode: form.reasonCode,
        declarationConfirmed: form.declarationConfirmed,
        justification: form.justification || undefined,
        journeyFrom: form.journeyFrom,
        journeyTo: form.journeyTo,
        travelDate: `${dateStr}T00:00:00`,
        pickupTime: `${dateStr}T${timeStr}`,
      });
      navigate(`/my-requests?highlight=${created.id}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
        Taxi Booking Form
      </Typography>

      <Alert severity="error" variant="filled" sx={{ mb: 3, fontWeight: 600 }}>
        Taxi services are strictly for business use only. Personal use is prohibited.
      </Alert>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={2}>
              <TextField label="Employee Name" value={currentEmployee.name} disabled fullWidth />
              <TextField label="Position" value={currentEmployee.position} disabled fullWidth />
            </Stack>
            <TextField label="Section / Dept." value={currentEmployee.department} disabled fullWidth />

            <TextField
              select
              label="Reason"
              value={form.reasonCode}
              onChange={(e) => setForm((f) => ({ ...f, reasonCode: e.target.value as ReasonCode }))}
              helperText={selectedMeta?.description}
              required
              fullWidth
            >
              <MenuItem value="" disabled={!reasonCodes}>
                {reasonCodes ? "Select a reason…" : "Loading reasons…"}
              </MenuItem>
              {reasonCodes?.map((r) => (
                <MenuItem key={r.code} value={r.code}>
                  {r.label}
                </MenuItem>
              ))}
            </TextField>

            {selectedMeta?.code === "H_EXCEPTIONAL_CASE" && (
              <TextField
                label="Justification"
                value={form.justification}
                onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))}
                multiline
                rows={3}
                required
                fullWidth
              />
            )}

            {selectedMeta?.requiresDeclaration && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.declarationConfirmed}
                    onChange={(e) => setForm((f) => ({ ...f, declarationConfirmed: e.target.checked }))}
                  />
                }
                label="I confirm that all alternative transport options have been exhausted prior to requesting a taxi."
              />
            )}

            <Stack direction="row" spacing={2}>
              <TextField
                label="From"
                value={form.journeyFrom}
                onChange={(e) => setForm((f) => ({ ...f, journeyFrom: e.target.value }))}
                required
                fullWidth
              />
              <TextField
                label="To"
                value={form.journeyTo}
                onChange={(e) => setForm((f) => ({ ...f, journeyTo: e.target.value }))}
                required
                fullWidth
              />
            </Stack>

            <Stack direction="row" spacing={2}>
              <DatePicker
                label="Date"
                value={form.travelDate}
                onChange={(value) => setForm((f) => ({ ...f, travelDate: value }))}
                slotProps={{ textField: { required: true, fullWidth: true } }}
              />
              <TimePicker
                label="Pick-up Time"
                value={form.pickupTime}
                onChange={(value) => setForm((f) => ({ ...f, pickupTime: value }))}
                slotProps={{ textField: { required: true, fullWidth: true } }}
              />
            </Stack>

            {selectedMeta?.requiresManComApprover && (
              <Alert severity="warning">
                This reason requires approval from a ManCom member
                {selectedMeta.requiresWorkAttendanceClearance
                  ? " and separate ManCom clearance to attend work before the taxi can be booked"
                  : ""}
                .
              </Alert>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            <Box>
              <Button type="submit" variant="contained" disabled={submitting} size="large">
                {submitting ? "Saving…" : "Save Draft"}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                Saved as a draft first — submit it for N+1/ManCom approval from "My Requests".
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
