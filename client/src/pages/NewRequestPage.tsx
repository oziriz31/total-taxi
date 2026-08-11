import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../api/useFetch";
import { useIdentity } from "../identity/IdentityContext";
import type { ReasonCode, ReasonCodeMeta, TaxiBookingRequest } from "../api/types";

const emptyForm = {
  reasonCode: "" as ReasonCode | "",
  journeyFrom: "",
  journeyTo: "",
  travelDate: "",
  pickupTime: "",
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

  if (!currentEmployee) return <p>Loading…</p>;

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

    setSubmitting(true);
    try {
      const pickupDateTime = `${form.travelDate}T${form.pickupTime}:00`;
      const created = await api.post<TaxiBookingRequest>("/requests", {
        reasonCode: form.reasonCode,
        declarationConfirmed: form.declarationConfirmed,
        justification: form.justification || undefined,
        journeyFrom: form.journeyFrom,
        journeyTo: form.journeyTo,
        travelDate: `${form.travelDate}T00:00:00`,
        pickupTime: pickupDateTime,
      });
      navigate(`/my-requests?highlight=${created.id}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Taxi Booking Form</h1>
      <p
        style={{
          background: "#fee2e2",
          color: "#991b1b",
          fontWeight: 600,
          fontSize: 13,
          padding: "8px 12px",
          borderRadius: 6,
          marginBottom: 20,
        }}
      >
        Taxi services are strictly for business use only. Personal use is prohibited.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={fieldRow}>
          <Field label="Employee Name">
            <input value={currentEmployee.name} disabled style={input} />
          </Field>
          <Field label="Position">
            <input value={currentEmployee.position} disabled style={input} />
          </Field>
        </div>
        <Field label="Section / Dept.">
          <input value={currentEmployee.department} disabled style={input} />
        </Field>

        <Field label="Reason">
          <select
            value={form.reasonCode}
            onChange={(e) => setForm((f) => ({ ...f, reasonCode: e.target.value as ReasonCode }))}
            style={input}
            required
          >
            <option value="">Select a reason…</option>
            {reasonCodes?.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
          {selectedMeta && (
            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>{selectedMeta.description}</p>
          )}
        </Field>

        {selectedMeta?.code === "H_EXCEPTIONAL_CASE" && (
          <Field label="Justification">
            <textarea
              value={form.justification}
              onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))}
              style={{ ...input, minHeight: 70 }}
              required
            />
          </Field>
        )}

        {selectedMeta?.requiresDeclaration && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={form.declarationConfirmed}
              onChange={(e) => setForm((f) => ({ ...f, declarationConfirmed: e.target.checked }))}
              style={{ marginTop: 3 }}
            />
            I confirm that all alternative transport options have been exhausted prior to requesting a taxi.
          </label>
        )}

        <div style={fieldRow}>
          <Field label="From">
            <input
              value={form.journeyFrom}
              onChange={(e) => setForm((f) => ({ ...f, journeyFrom: e.target.value }))}
              style={input}
              required
            />
          </Field>
          <Field label="To">
            <input
              value={form.journeyTo}
              onChange={(e) => setForm((f) => ({ ...f, journeyTo: e.target.value }))}
              style={input}
              required
            />
          </Field>
        </div>

        <div style={fieldRow}>
          <Field label="Date">
            <input
              type="date"
              value={form.travelDate}
              onChange={(e) => setForm((f) => ({ ...f, travelDate: e.target.value }))}
              style={input}
              required
            />
          </Field>
          <Field label="Pick-up Time">
            <input
              type="time"
              value={form.pickupTime}
              onChange={(e) => setForm((f) => ({ ...f, pickupTime: e.target.value }))}
              style={input}
              required
            />
          </Field>
        </div>

        {selectedMeta?.requiresManComApprover && (
          <p style={{ fontSize: 13, color: "#92400e", background: "#fef3c7", padding: "8px 12px", borderRadius: 6 }}>
            This reason requires approval from a ManCom member{selectedMeta.requiresWorkAttendanceClearance
              ? " and separate ManCom clearance to attend work before the taxi can be booked"
              : ""}
            .
          </p>
        )}

        {error && <p style={{ color: "#991b1b", fontSize: 14 }}>{error}</p>}

        <button type="submit" disabled={submitting} style={primaryButton}>
          {submitting ? "Saving…" : "Save Draft"}
        </button>
        <p style={{ fontSize: 12, color: "#6b7280" }}>
          Saved as a draft first — submit it for N+1/ManCom approval from "My Requests".
        </p>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, flex: 1 }}>
      {label}
      {children}
    </label>
  );
}

const fieldRow: React.CSSProperties = { display: "flex", gap: 16 };

const input: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  fontSize: 14,
  fontWeight: 400,
};

const primaryButton: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: "#1d4ed8",
  color: "#fff",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  alignSelf: "flex-start",
};
