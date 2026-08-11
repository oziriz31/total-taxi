import { useState } from "react";
import { api } from "../api/client";
import { useFetch } from "../api/useFetch";
import { useIdentity } from "../identity/IdentityContext";
import type { InvoiceBatch, PersonalUseCharge, TaxiBookingRequest } from "../api/types";
import { StatusBadge } from "../components/StatusBadge";

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

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>HR Monitoring &amp; Reconciliation</h1>
      {error && <p style={{ color: "#991b1b", marginBottom: 12 }}>{error}</p>}

      {/* Batches */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Vendor invoice batches</h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            placeholder="Month, e.g. 2026-07"
            value={newMonth}
            onChange={(e) => setNewMonth(e.target.value)}
            style={inputStyle}
          />
          <button
            disabled={busy || !newMonth}
            onClick={() => withBusy(async () => { await api.post("/invoices/batches", { month: newMonth }); setNewMonth(""); })}
            style={btn("#1d4ed8")}
          >
            Create batch
          </button>
        </div>

        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ width: 240 }}>
            {batches?.map((b) => (
              <div
                key={b.id}
                onClick={() => setSelectedBatchId(b.id)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  marginBottom: 6,
                  background: selectedBatchId === b.id ? "#dbeafe" : "#f3f4f6",
                  fontSize: 13,
                }}
              >
                <strong>{b.month}</strong>
                <div style={{ color: "#6b7280" }}>
                  {b._count?.lines ?? 0} lines · Rs {b.totalAmount.toFixed(0)}
                  {b.validatedAt && " · validated"}
                  {b.escalatedToManCom && " · escalated"}
                </div>
              </div>
            ))}
          </div>

          <div style={{ flex: 1 }}>
            {!batchDetail && <p style={{ color: "#6b7280" }}>Select a batch to view its lines.</p>}
            {batchDetail && (
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="file" accept=".csv" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <button
                    disabled={busy || !uploadFile}
                    onClick={() =>
                      withBusy(async () => {
                        const form = new FormData();
                        form.append("file", uploadFile as File);
                        await api.postForm(`/invoices/batches/${selectedBatchId}/lines`, form);
                        setUploadFile(null);
                      })
                    }
                    style={btn("#1d4ed8")}
                  >
                    Upload CSV
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => withBusy(() => api.post(`/invoices/batches/${selectedBatchId}/match`))}
                    style={btn("#6d28d9")}
                  >
                    Auto-match
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => withBusy(() => api.post(`/invoices/batches/${selectedBatchId}/validate`))}
                    style={btn("#047857")}
                  >
                    Validate batch
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => withBusy(() => api.post(`/invoices/batches/${selectedBatchId}/escalate`))}
                    style={btn("#92400e")}
                  >
                    Escalate to ManCom
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
                  CSV columns: vendorTripRef,date,from,to,amount,waitingTimeCharge
                </p>

                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Date</th>
                      <th style={th}>From</th>
                      <th style={th}>To</th>
                      <th style={th}>Amount</th>
                      <th style={th}>Waiting</th>
                      <th style={th}>Match</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchDetail.lines?.map((l) => (
                      <tr key={l.id}>
                        <td style={td}>{new Date(l.date).toLocaleDateString()}</td>
                        <td style={td}>{l.fromLocation}</td>
                        <td style={td}>{l.toLocation}</td>
                        <td style={td}>{l.amount}</td>
                        <td style={td}>{l.waitingTimeCharge}</td>
                        <td style={td}>
                          {l.matchStatus === "MATCHED" ? (
                            <span style={{ color: "#065f46" }}>{l.matchedRequest?.employee?.name}</span>
                          ) : (
                            <span style={{ color: l.matchStatus === "DISPUTED" ? "#991b1b" : "#92400e" }}>
                              {l.matchStatus}
                            </span>
                          )}
                        </td>
                        <td style={td}>
                          {l.matchStatus !== "MATCHED" && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <input
                                placeholder="Request id"
                                value={matchInputs[l.id] ?? ""}
                                onChange={(e) => setMatchInputs((m) => ({ ...m, [l.id]: e.target.value }))}
                                style={{ ...inputStyle, width: 110, fontSize: 11 }}
                              />
                              <button
                                disabled={busy || !matchInputs[l.id]}
                                onClick={() =>
                                  withBusy(() =>
                                    api.post(`/invoices/lines/${l.id}/match`, { requestId: matchInputs[l.id] })
                                  )
                                }
                                style={btn("#1d4ed8")}
                              >
                                Match
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => withBusy(() => api.post(`/invoices/lines/${l.id}/dispute`))}
                                style={btn("#991b1b")}
                              >
                                Dispute
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Requests eligible for flagging */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Booked / completed trips</h2>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Employee</th>
              <th style={th}>Journey</th>
              <th style={th}>Status</th>
              <th style={th}>Request ID</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {completedRequests?.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.employee?.name}</td>
                <td style={td}>
                  {r.journeyFrom} → {r.journeyTo}
                </td>
                <td style={td}>
                  <StatusBadge status={r.status} />
                </td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.id}</td>
                <td style={td}>
                  {r.status !== "FLAGGED_FOR_REVIEW" ? (
                    <button
                      disabled={busy}
                      onClick={() =>
                        withBusy(async () => {
                          await api.post(`/requests/${r.id}/flag-for-review`);
                          reloadCompleted();
                        })
                      }
                      style={btn("#92400e")}
                    >
                      Flag for review
                    </button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() =>
                        withBusy(async () => {
                          await api.post(`/requests/${r.id}/clear-review`);
                          reloadCompleted();
                        })
                      }
                      style={btn("#047857")}
                    >
                      Clear
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Flagged -> confirm personal use */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Flagged for review — confirm personal use</h2>
        {completedRequests?.filter((r) => r.status === "FLAGGED_FOR_REVIEW").length === 0 && (
          <p style={{ color: "#6b7280" }}>No flagged requests.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {completedRequests
            ?.filter((r) => r.status === "FLAGGED_FOR_REVIEW")
            .map((r) => {
              const form = confirmForm[r.id] ?? { amount: "", method: "CASHIER_PAYMENT", consent: "" };
              return (
                <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
                  <strong>{r.employee?.name}</strong> — {r.journeyFrom} → {r.journeyTo}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      placeholder="Amount"
                      type="number"
                      value={form.amount}
                      onChange={(e) => setConfirmForm((s) => ({ ...s, [r.id]: { ...form, amount: e.target.value } }))}
                      style={{ ...inputStyle, width: 100 }}
                    />
                    <select
                      value={form.method}
                      onChange={(e) => setConfirmForm((s) => ({ ...s, [r.id]: { ...form, method: e.target.value } }))}
                      style={inputStyle}
                    >
                      <option value="CASHIER_PAYMENT">Cashier payment</option>
                      <option value="SALARY_DEDUCTION">Salary deduction</option>
                    </select>
                    {form.method === "SALARY_DEDUCTION" && (
                      <input
                        placeholder="Employee consent ref"
                        value={form.consent}
                        onChange={(e) =>
                          setConfirmForm((s) => ({ ...s, [r.id]: { ...form, consent: e.target.value } }))
                        }
                        style={inputStyle}
                      />
                    )}
                    <button
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
                      style={btn("#991b1b")}
                    >
                      Confirm personal use
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* Charges ledger */}
      <section>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Personal-use charges</h2>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Employee</th>
              <th style={th}>Amount</th>
              <th style={th}>Method</th>
              <th style={th}>Status</th>
              <th style={th}>Disciplinary</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {charges?.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.employee?.name}</td>
                <td style={td}>{c.amount}</td>
                <td style={td}>{c.recoveryMethod.replace("_", " ")}</td>
                <td style={td}>{c.status}</td>
                <td style={td}>{c.disciplinaryFlag ? "⚠ repeat abuse" : ""}</td>
                <td style={td}>
                  {c.status === "PENDING" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        withBusy(async () => {
                          await api.patch(`/personal-use-charges/${c.id}/recover`);
                          reloadCharges();
                        })
                      }
                      style={btn("#047857")}
                    >
                      Mark recovered
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "6px 8px", color: "#6b7280" };
const td: React.CSSProperties = { borderBottom: "1px solid #f3f4f6", padding: "6px 8px" };
const inputStyle: React.CSSProperties = { padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 };

function btn(color: string): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 6,
    border: "none",
    background: color,
    color: "#fff",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
  };
}
