import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { api } from "../api/client";
import { useFetch } from "../api/useFetch";
import { useIdentity } from "../identity/IdentityContext";
import type { InvoiceBatch, InvoiceLine, PersonalUseCharge, TaxiBookingRequest } from "../api/types";
import { StatusBadge } from "../components/StatusBadge";

// Rs X,XXX.XX — see docs/ui-ux-design-requirements.md section 9 (currency
// formatting was previously a raw float everywhere).
function formatCurrency(amount: number) {
  return `Rs ${amount.toLocaleString("en-MU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function HrMonitoringPage() {
  const { currentEmployee } = useIdentity();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // --- Invoice batches -----------------------------------------------
  // Each fetch below is gated on currentEmployee.id so it waits for the
  // identity picker to resolve a logged-in employee before calling an API
  // that requires the X-Employee-Id header (see NewRequestPage for the
  // same fix and why it's needed).
  const { data: batches, reload: reloadBatches } = useFetch(
    () => (currentEmployee ? api.get<InvoiceBatch[]>("/invoices/batches") : Promise.resolve(null)),
    [currentEmployee?.id]
  );
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const { data: batchDetail, reload: reloadBatchDetail } = useFetch(
    () => (selectedBatchId ? api.get<InvoiceBatch>(`/invoices/batches/${selectedBatchId}`) : Promise.resolve(null)),
    [selectedBatchId]
  );
  const [newMonth, setNewMonth] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [matchInputs, setMatchInputs] = useState<Record<string, string>>({});

  async function withBusy(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      reloadBatches();
      if (selectedBatchId) reloadBatchDetail();
    } catch (err: any) {
      setError(err.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  }

  // --- Completed/booked requests, for flagging ------------------------
  const { data: completedRequests, reload: reloadCompleted } = useFetch(
    () =>
      currentEmployee
        ? api.get<TaxiBookingRequest[]>("/requests?status=BOOKED,COMPLETED,FLAGGED_FOR_REVIEW")
        : Promise.resolve(null),
    [currentEmployee?.id]
  );

  // --- Personal-use charges -------------------------------------------
  const { data: charges, reload: reloadCharges } = useFetch(
    () => (currentEmployee ? api.get<PersonalUseCharge[]>("/personal-use-charges") : Promise.resolve(null)),
    [currentEmployee?.id]
  );
  const [confirmForm, setConfirmForm] = useState<Record<string, { amount: string; method: string; consent: string }>>(
    {}
  );

  const invoiceLineColumns: GridColDef<InvoiceLine>[] = [
    { field: "date", headerName: "Date", width: 110, valueGetter: (_v, row) => new Date(row.date).toLocaleDateString() },
    { field: "fromLocation", headerName: "From", flex: 1, minWidth: 140 },
    { field: "toLocation", headerName: "To", flex: 1, minWidth: 140 },
    {
      field: "amount",
      headerName: "Amount",
      width: 120,
      align: "right",
      headerAlign: "right",
      valueGetter: (_v, row) => formatCurrency(row.amount),
    },
    {
      field: "waitingTimeCharge",
      headerName: "Waiting",
      width: 110,
      align: "right",
      headerAlign: "right",
      valueGetter: (_v, row) => formatCurrency(row.waitingTimeCharge),
    },
    {
      field: "matchStatus",
      headerName: "Match",
      width: 180,
      renderCell: ({ row }) =>
        row.matchStatus === "MATCHED" ? (
          <Typography variant="body2" color="success.main">
            {row.matchedRequest?.employee?.name}
          </Typography>
        ) : (
          <Typography variant="body2" color={row.matchStatus === "DISPUTED" ? "error.main" : "warning.main"}>
            {row.matchStatus}
          </Typography>
        ),
    },
    {
      field: "actions",
      headerName: "",
      width: 260,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) =>
        row.matchStatus !== "MATCHED" ? (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", py: 1 }}>
            <TextField
              size="small"
              placeholder="Request id"
              value={matchInputs[row.id] ?? ""}
              onChange={(e) => setMatchInputs((m) => ({ ...m, [row.id]: e.target.value }))}
              sx={{ width: 110 }}
            />
            <Button
              size="small"
              variant="contained"
              disabled={busy || !matchInputs[row.id]}
              onClick={() => withBusy(() => api.post(`/invoices/lines/${row.id}/match`, { requestId: matchInputs[row.id] }))}
            >
              Match
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              disabled={busy}
              onClick={() => withBusy(() => api.post(`/invoices/lines/${row.id}/dispute`))}
            >
              Dispute
            </Button>
          </Stack>
        ) : null,
    },
  ];

  const requestColumns: GridColDef<TaxiBookingRequest>[] = [
    { field: "employee", headerName: "Employee", width: 160, valueGetter: (_v, row) => row.employee?.name ?? "" },
    {
      field: "journey",
      headerName: "Journey",
      flex: 1,
      minWidth: 200,
      valueGetter: (_v, row) => `${row.journeyFrom} → ${row.journeyTo}`,
    },
    {
      field: "status",
      headerName: "Status",
      width: 190,
      renderCell: ({ row }) => <StatusBadge status={row.status} />,
    },
    {
      field: "id",
      headerName: "Request ID",
      width: 140,
      renderCell: ({ row }) => (
        <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
          {row.id}
        </Typography>
      ),
    },
    {
      field: "actions",
      headerName: "",
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) =>
        row.status !== "FLAGGED_FOR_REVIEW" ? (
          <Button
            size="small"
            variant="contained"
            color="warning"
            disabled={busy}
            onClick={() =>
              withBusy(async () => {
                await api.post(`/requests/${row.id}/flag-for-review`);
                reloadCompleted();
              })
            }
          >
            Flag for review
          </Button>
        ) : (
          <Button
            size="small"
            variant="contained"
            color="success"
            disabled={busy}
            onClick={() =>
              withBusy(async () => {
                await api.post(`/requests/${row.id}/clear-review`);
                reloadCompleted();
              })
            }
          >
            Clear
          </Button>
        ),
    },
  ];

  const chargeColumns: GridColDef<PersonalUseCharge>[] = [
    { field: "employee", headerName: "Employee", width: 160, valueGetter: (_v, row) => row.employee?.name ?? "" },
    {
      field: "amount",
      headerName: "Amount",
      width: 130,
      align: "right",
      headerAlign: "right",
      valueGetter: (_v, row) => formatCurrency(row.amount),
    },
    {
      field: "recoveryMethod",
      headerName: "Method",
      width: 160,
      valueGetter: (_v, row) => row.recoveryMethod.replace("_", " "),
    },
    { field: "status", headerName: "Status", width: 120 },
    {
      field: "disciplinaryFlag",
      headerName: "Disciplinary",
      width: 140,
      renderCell: ({ row }) =>
        row.disciplinaryFlag ? (
          <Typography variant="body2" color="error.main">
            ⚠ repeat abuse
          </Typography>
        ) : null,
    },
    {
      field: "actions",
      headerName: "",
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) =>
        row.status === "PENDING" ? (
          <Button
            size="small"
            variant="contained"
            color="success"
            disabled={busy}
            onClick={() =>
              withBusy(async () => {
                await api.patch(`/personal-use-charges/${row.id}/recover`);
                reloadCharges();
              })
            }
          >
            Mark recovered
          </Button>
        ) : null,
    },
  ];

  const flaggedRequests = completedRequests?.filter((r) => r.status === "FLAGGED_FOR_REVIEW") ?? [];

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
        HR Monitoring &amp; Reconciliation
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Batches */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
          Vendor invoice batches
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <TextField
            size="small"
            placeholder="Month, e.g. 2026-07"
            value={newMonth}
            onChange={(e) => setNewMonth(e.target.value)}
          />
          <Button
            variant="contained"
            disabled={busy || !newMonth}
            onClick={() =>
              withBusy(async () => {
                await api.post("/invoices/batches", { month: newMonth });
                setNewMonth("");
              })
            }
          >
            Create batch
          </Button>
        </Stack>

        <Stack direction="row" spacing={3}>
          <Paper variant="outlined" sx={{ width: 260 }}>
            <List dense disablePadding>
              {batches?.map((b) => (
                <ListItemButton
                  key={b.id}
                  selected={selectedBatchId === b.id}
                  onClick={() => setSelectedBatchId(b.id)}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {b.month}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {b._count?.lines ?? 0} lines · {formatCurrency(b.totalAmount)}
                      {b.validatedAt && " · validated"}
                      {b.escalatedToManCom && " · escalated"}
                    </Typography>
                  </Box>
                </ListItemButton>
              ))}
            </List>
          </Paper>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {!batchDetail && <Typography color="text.secondary">Select a batch to view its lines.</Typography>}
            {batchDetail && (
              <Box>
                <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap", alignItems: "center" }}>
                  <Button component="label" variant="outlined" size="small" startIcon={<UploadFileIcon />}>
                    {uploadFile ? uploadFile.name : "Choose CSV"}
                    <input
                      type="file"
                      accept=".csv"
                      hidden
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    />
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={busy || !uploadFile}
                    onClick={() =>
                      withBusy(async () => {
                        const form = new FormData();
                        form.append("file", uploadFile as File);
                        await api.postForm(`/invoices/batches/${selectedBatchId}/lines`, form);
                        setUploadFile(null);
                      })
                    }
                  >
                    Upload CSV
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    size="small"
                    disabled={busy}
                    onClick={() => withBusy(() => api.post(`/invoices/batches/${selectedBatchId}/match`))}
                  >
                    Auto-match
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    disabled={busy}
                    onClick={() => withBusy(() => api.post(`/invoices/batches/${selectedBatchId}/validate`))}
                  >
                    Validate batch
                  </Button>
                  <Button
                    variant="contained"
                    color="warning"
                    size="small"
                    disabled={busy}
                    onClick={() => withBusy(() => api.post(`/invoices/batches/${selectedBatchId}/escalate`))}
                  >
                    Escalate to ManCom
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  CSV columns: vendorTripRef,date,from,to,amount,waitingTimeCharge
                </Typography>

                <DataGrid
                  rows={batchDetail.lines ?? []}
                  columns={invoiceLineColumns}
                  density="compact"
                  autoHeight
                  hideFooter={(batchDetail.lines?.length ?? 0) <= 100}
                  disableRowSelectionOnClick
                />
              </Box>
            )}
          </Box>
        </Stack>
      </Box>

      {/* Requests eligible for flagging */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
          Booked / completed trips
        </Typography>
        <DataGrid
          rows={completedRequests ?? []}
          columns={requestColumns}
          density="compact"
          autoHeight
          hideFooter={(completedRequests?.length ?? 0) <= 100}
          disableRowSelectionOnClick
        />
      </Box>

      {/* Flagged -> confirm personal use */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
          Flagged for review — confirm personal use
        </Typography>
        {flaggedRequests.length === 0 && <Typography color="text.secondary">No flagged requests.</Typography>}
        <Stack spacing={1.25}>
          {flaggedRequests.map((r) => {
            const form = confirmForm[r.id] ?? { amount: "", method: "CASHIER_PAYMENT", consent: "" };
            return (
              <Card key={r.id} variant="outlined">
                <CardContent>
                  <Typography sx={{ fontWeight: 700 }}>
                    {r.employee?.name} — {r.journeyFrom} → {r.journeyTo}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", alignItems: "center" }}>
                    <TextField
                      size="small"
                      label="Amount"
                      type="number"
                      value={form.amount}
                      onChange={(e) => setConfirmForm((s) => ({ ...s, [r.id]: { ...form, amount: e.target.value } }))}
                      sx={{ width: 120 }}
                    />
                    <TextField
                      size="small"
                      select
                      label="Recovery method"
                      value={form.method}
                      onChange={(e) => setConfirmForm((s) => ({ ...s, [r.id]: { ...form, method: e.target.value } }))}
                      sx={{ width: 190 }}
                    >
                      <MenuItem value="CASHIER_PAYMENT">Cashier payment</MenuItem>
                      <MenuItem value="SALARY_DEDUCTION">Salary deduction</MenuItem>
                    </TextField>
                    {form.method === "SALARY_DEDUCTION" && (
                      <TextField
                        size="small"
                        label="Employee consent ref"
                        value={form.consent}
                        onChange={(e) =>
                          setConfirmForm((s) => ({ ...s, [r.id]: { ...form, consent: e.target.value } }))
                        }
                      />
                    )}
                    <Button
                      variant="contained"
                      color="error"
                      disabled={busy || !form.amount}
                      onClick={() =>
                        withBusy(async () => {
                          await api.post(`/requests/${r.id}/confirm-personal-use`, {
                            amount: Number(form.amount),
                            recoveryMethod: form.method,
                            employeeConsentRef: form.consent || undefined,
                          });
                          reloadCompleted();
                          reloadCharges();
                        })
                      }
                    >
                      Confirm personal use
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Box>

      {/* Charges ledger */}
      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
          Personal-use charges
        </Typography>
        <DataGrid
          rows={charges ?? []}
          columns={chargeColumns}
          density="compact"
          autoHeight
          hideFooter={(charges?.length ?? 0) <= 100}
          disableRowSelectionOnClick
        />
      </Box>
    </Box>
  );
}
