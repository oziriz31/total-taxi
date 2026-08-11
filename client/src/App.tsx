import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { NewRequestPage } from "./pages/NewRequestPage";
import { MyRequestsPage } from "./pages/MyRequestsPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { HrMonitoringPage } from "./pages/HrMonitoringPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/new-request" replace />} />
        <Route path="/new-request" element={<NewRequestPage />} />
        <Route path="/my-requests" element={<MyRequestsPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/hr" element={<HrMonitoringPage />} />
      </Route>
    </Routes>
  );
}
