import { NavLink, Outlet } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Badge from "@mui/material/Badge";
import CircularProgress from "@mui/material/CircularProgress";
import LocalTaxiIcon from "@mui/icons-material/LocalTaxi";
import { useIdentity } from "../identity/IdentityContext";
import { api } from "../api/client";
import { useFetch } from "../api/useFetch";
import type { TaxiBookingRequest } from "../api/types";

const NAV_ITEMS = [
  { to: "/new-request", label: "New Request" },
  { to: "/my-requests", label: "My Requests" },
  { to: "/approvals", label: "Approvals" },
  { to: "/hr", label: "HR Monitoring" },
];

export function Layout() {
  const { employees, currentEmployee, switchTo, loading } = useIdentity();

  // Approvals badge count — lets a manager/ManCom member see at a glance
  // there's something waiting without opening the tab (design doc section 5).
  const { data: pending } = useFetch(
    () =>
      currentEmployee
        ? api.get<TaxiBookingRequest[]>("/requests?forApproval=true")
        : Promise.resolve(null),
    [currentEmployee?.id]
  );
  const pendingCount = pending?.length ?? 0;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ gap: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <LocalTaxiIcon color="primary" />
            <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
              TotalTaxi
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 0.5, flexGrow: 1 }}>
            {NAV_ITEMS.map((item) => (
              <Button
                key={item.to}
                component={NavLink}
                to={item.to}
                sx={{
                  "&.active": { bgcolor: "primary.main", color: "primary.contrastText" },
                }}
              >
                {item.label === "Approvals" && pendingCount > 0 ? (
                  <Badge badgeContent={pendingCount} color="error" sx={{ "& .MuiBadge-badge": { right: -10, top: 2 } }}>
                    {item.label}
                  </Badge>
                ) : (
                  item.label
                )}
              </Button>
            ))}
          </Box>

          <Typography variant="caption" color="text.secondary">
            Logged in as
          </Typography>
          {loading ? (
            <CircularProgress size={18} />
          ) : (
            <Select
              size="small"
              value={currentEmployee?.id ?? ""}
              onChange={(e) => switchTo(e.target.value)}
              sx={{ minWidth: 260 }}
            >
              {employees.map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {e.name} — {e.position}
                  {e.isManCom ? " (ManCom)" : ""}
                </MenuItem>
              ))}
            </Select>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
