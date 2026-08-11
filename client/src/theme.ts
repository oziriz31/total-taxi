import { createTheme } from "@mui/material/styles";

// Design tokens for the Taxi Management module, expressed as an MUI theme.
// Semantic roles mirror docs/ui-ux-design-requirements.md section 2:
// primary = main actions (submit/approve/book), error = destructive/danger
// (reject/cancel/dispute/flag), success = positive completion (approve/
// complete/validate/clear), warning = caution (ManCom gates, escalation,
// late-booking notices), secondary = auxiliary tooling actions (auto-match).
export const theme = createTheme({
  palette: {
    primary: { main: "#1d4ed8", dark: "#1e40af" }, // blue-700 / blue-800
    error: { main: "#991b1b", dark: "#7f1d1d" }, // red-800 / red-900
    success: { main: "#047857", dark: "#065f46" }, // emerald-700 / emerald-800
    warning: { main: "#92400e", dark: "#78350f" }, // amber-800 / amber-900
    secondary: { main: "#6d28d9", dark: "#5b21b6" }, // violet-700 / violet-800
    background: { default: "#f8fafc", paper: "#ffffff" },
  },
  typography: {
    fontFamily: ["system-ui", "Segoe UI", "Roboto", "sans-serif"].join(","),
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 600, color: "#6b7280" },
      },
    },
  },
});
