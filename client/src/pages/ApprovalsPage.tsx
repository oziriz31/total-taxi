import { useState } from "react";
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

  if (!currentEmployee) return <p>Loading…</p>;

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Approvals</h1>
      {error && <p style={{ color: "#991b1b", marginBottom: 12 }}>{error}</p>}

      {currentEmployee.isManCom && needsClearance && needsClearance.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>
            Emergency-work attendance clearance (reason G — separate gate before booking approval)
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {needsClearance.map((r) => (
              <div key={r.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <strong>{r.employee?.name}</strong> — {r.journeyFrom} → {r.journeyTo}
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {new Date(r.travelDate).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => runAction(r.id, () => api.post(`/requests/${r.id}/clear-work-attendance`))}
                    style={btn("#92400e")}
                  >
                    Clear to attend work
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Pending booking approvals</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pending?.length === 0 && <p style={{ color: "#6b7280" }}>Nothing pending your approval.</p>}
          {pending?.map((r) => (
            <div key={r.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{r.employee?.name}</strong>
                  <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>
                    {r.reasonCode.replace(/_/g, " ")}
                  </span>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <p style={{ fontSize: 13, color: "#374151", margin: "6px 0" }}>
                {r.journeyFrom} → {r.journeyTo} · {new Date(r.travelDate).toLocaleDateString()} ·{" "}
                {new Date(r.pickupTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {r.lateBooking && <span style={{ color: "#92400e" }}> · late booking</span>}
              </p>
              {r.justification && <p style={{ fontSize: 13, color: "#374151" }}>Justification: {r.justification}</p>}

              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  disabled={busyId === r.id}
                  onClick={() => runAction(r.id, () => api.post(`/requests/${r.id}/approve`))}
                  style={btn("#047857")}
                >
                  Approve
                </button>
                <input
                  placeholder="Rejection reason"
                  value={rejectReason[r.id] ?? ""}
                  onChange={(e) => setRejectReason((s) => ({ ...s, [r.id]: e.target.value }))}
                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                />
                <button
                  disabled={busyId === r.id || !rejectReason[r.id]}
                  onClick={() =>
                    runAction(r.id, () => api.post(`/requests/${r.id}/reject`, { reason: rejectReason[r.id] }))
                  }
                  style={btn("#991b1b")}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const card: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, background: "#fff" };

function btn(color: string): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 6,
    border: "none",
    background: color,
    color: "#fff",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  };
}
