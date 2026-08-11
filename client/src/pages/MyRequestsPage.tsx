import { useState } from "react";
import { useSearchParams } from "react-router-dom";
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

  if (!currentEmployee) return <p>Loading…</p>;

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>My Taxi Requests</h1>
      {actionError && <p style={{ color: "#991b1b", marginBottom: 12 }}>{actionError}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {requests?.length === 0 && <p style={{ color: "#6b7280" }}>No requests yet.</p>}
        {requests?.map((r) => (
          <div
            key={r.id}
            style={{
              border: r.id === highlight ? "2px solid #1d4ed8" : "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 16,
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>
                  {r.journeyFrom} → {r.journeyTo}
                </strong>
                <span style={{ marginLeft: 10, fontSize: 12, color: "#6b7280" }}>
                  {new Date(r.travelDate).toLocaleDateString()} · {new Date(r.pickupTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <StatusBadge status={r.status} />
            </div>

            <p style={{ fontSize: 13, color: "#374151", marginTop: 6 }}>
              Reason: {r.reasonCode.replace(/_/g, " ")}
              {r.lateBooking && <span style={{ color: "#92400e" }}> · submitted after policy deadline</span>}
            </p>

            {r.reasonCode === "G_EMERGENCY_WORK" && r.status === "DRAFT" && (
              <p style={{ fontSize: 12, color: r.workAttendanceClearedAt ? "#065f46" : "#92400e" }}>
                Work-attendance clearance: {r.workAttendanceClearedAt ? "cleared" : "awaiting ManCom clearance"}
              </p>
            )}

            {r.rejectionReason && (
              <p style={{ fontSize: 13, color: "#991b1b" }}>Rejected: {r.rejectionReason}</p>
            )}
            {r.taxiContactNumber && (
              <p style={{ fontSize: 13, color: "#374151" }}>Taxi contact: {r.taxiContactNumber}</p>
            )}
            {r.personalUseCharge && (
              <p style={{ fontSize: 13, color: "#7f1d1d" }}>
                Personal-use charge: {r.personalUseCharge.amount} ({r.personalUseCharge.status})
              </p>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
              {r.status === "DRAFT" && (
                <>
                  <button
                    disabled={busyId === r.id || (r.reasonCode === "G_EMERGENCY_WORK" && !r.workAttendanceClearedAt)}
                    onClick={() => runAction(r.id, () => api.post(`/requests/${r.id}/submit`))}
                    style={btn("#1d4ed8")}
                  >
                    Submit for Approval
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => runAction(r.id, () => api.post(`/requests/${r.id}/cancel`))}
                    style={btn("#6b7280")}
                  >
                    Cancel
                  </button>
                </>
              )}

              {r.status === "PENDING_APPROVAL" && (
                <button
                  disabled={busyId === r.id}
                  onClick={() => runAction(r.id, () => api.post(`/requests/${r.id}/cancel`))}
                  style={btn("#6b7280")}
                >
                  Cancel
                </button>
              )}

              {r.status === "APPROVED" && (
                <>
                  <input
                    placeholder="Taxi contact number"
                    value={contactInputs[r.id] ?? ""}
                    onChange={(e) => setContactInputs((c) => ({ ...c, [r.id]: e.target.value }))}
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                  <button
                    disabled={busyId === r.id || !contactInputs[r.id]}
                    onClick={() =>
                      runAction(r.id, () =>
                        api.post(`/requests/${r.id}/book`, { taxiContactNumber: contactInputs[r.id] })
                      )
                    }
                    style={btn("#1d4ed8")}
                  >
                    Confirm Booking
                  </button>
                </>
              )}

              {r.status === "BOOKED" && (
                <button
                  disabled={busyId === r.id}
                  onClick={() => runAction(r.id, () => api.post(`/requests/${r.id}/complete`))}
                  style={btn("#047857")}
                >
                  Mark Trip Completed
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
