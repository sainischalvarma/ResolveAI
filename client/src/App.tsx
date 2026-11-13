import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppLayout } from "./layouts/AppLayout";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AiSupport } from "./pages/AiSupport";
import { Analytics } from "./pages/Analytics";
import { KnowledgeBase } from "./pages/KnowledgeBase";
import { LoginPage } from "./pages/LoginPage";
import { Notifications } from "./pages/Notifications";
import { Settings } from "./pages/Settings";
import { TechnicianDashboard } from "./pages/TechnicianDashboard";
import { TechnicianManagement } from "./pages/TechnicianManagement";
import { TicketDetails } from "./pages/TicketDetails";
import { Tickets } from "./pages/Tickets";
import { TroubleshootingSessions } from "./pages/TroubleshootingSessions";
import { UserDashboard } from "./pages/UserDashboard";

function ProtectedRoutes() {
  const { isAuthenticated, isAdmin, isStaff, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-teal-500 border-r-transparent mb-3" />
          <p className="text-xs text-slate-400">Loading ResolveAI...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Default route: redirect to role-specific dashboard */}
        <Route
          index
          element={
            isAdmin ? (
              <Navigate to="/admin/dashboard" replace />
            ) : isStaff ? (
              <Navigate to="/staff/dashboard" replace />
            ) : (
              <Navigate to="/user/dashboard" replace />
            )
          }
        />

        {/* Dedicated role dashboard routes */}
        <Route path="user/dashboard" element={<UserDashboard />} />
        <Route
          path="staff/dashboard"
          element={isStaff || isAdmin ? <TechnicianDashboard /> : <Navigate to="/user/dashboard" replace />}
        />
        <Route
          path="admin/dashboard"
          element={
            isAdmin ? (
              <AdminDashboard />
            ) : isStaff ? (
              <Navigate to="/staff/dashboard" replace />
            ) : (
              <Navigate to="/user/dashboard" replace />
            )
          }
        />

        {/* Route aliases and features */}
        <Route
          path="dashboard"
          element={
            isAdmin ? (
              <Navigate to="/admin/dashboard" replace />
            ) : isStaff ? (
              <Navigate to="/staff/dashboard" replace />
            ) : (
              <UserDashboard />
            )
          }
        />
        <Route path="support" element={<AiSupport />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="tickets/:id" element={<TicketDetails />} />
        <Route path="sessions" element={<TroubleshootingSessions />} />
        <Route path="sessions/:id" element={<TroubleshootingSessions />} />
        <Route
          path="technician"
          element={isStaff || isAdmin ? <TechnicianDashboard /> : <Navigate to="/user/dashboard" replace />}
        />
        <Route
          path="staff"
          element={isStaff || isAdmin ? <TechnicianDashboard /> : <Navigate to="/user/dashboard" replace />}
        />
        <Route
          path="admin"
          element={
            isAdmin ? (
              <AdminDashboard />
            ) : isStaff ? (
              <Navigate to="/staff/dashboard" replace />
            ) : (
              <Navigate to="/user/dashboard" replace />
            )
          }
        />
        <Route path="technicians" element={isAdmin ? <TechnicianManagement /> : <Navigate to="/" replace />} />
        <Route path="knowledge" element={isAdmin ? <KnowledgeBase /> : <Navigate to="/" replace />} />
        <Route path="analytics" element={isAdmin ? <Analytics /> : <Navigate to="/" replace />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
