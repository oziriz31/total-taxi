import { NavLink, Outlet } from "react-router-dom";
import { useIdentity } from "../identity/IdentityContext";

export function Layout() {
  const { employees, currentEmployee, switchTo, loading } = useIdentity();

  const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
    padding: "8px 14px",
    borderRadius: 8,
    textDecoration: "none",
    color: isActive ? "#fff" : "#1f2937",
    background: isActive ? "#1d4ed8" : "transparent",
    fontWeight: 600,
    fontSize: 14,
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#111827" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <strong style={{ fontSize: 18, color: "#1d4ed8" }}>TotalTaxi</strong>
          <nav style={{ display: "flex", gap: 6 }}>
            <NavLink to="/new-request" style={navLinkStyle}>
              New Request
            </NavLink>
            <NavLink to="/my-requests" style={navLinkStyle}>
              My Requests
            </NavLink>
            <NavLink to="/approvals" style={navLinkStyle}>
              Approvals
            </NavLink>
            <NavLink to="/hr" style={navLinkStyle}>
              HR Monitoring
            </NavLink>
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Logged in as</span>
          {loading ? (
            <span style={{ fontSize: 13 }}>Loading…</span>
          ) : (
            <select
              value={currentEmployee?.id ?? ""}
              onChange={(e) => switchTo(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} — {e.position}
                  {e.isManCom ? " (ManCom)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
        <Outlet />
      </main>
    </div>
  );
}
