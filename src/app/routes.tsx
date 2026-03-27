import { createBrowserRouter, Navigate } from "react-router";
import Login from "./Login";
import WhatsAppSender from "./WhatsAppSender";
import AdminDashboard from "./AdminDashboard";
import Unauthorized from "./Unauthorized";
import { ProtectedRoute } from "./components/ProtectedRoute";
// LOCAL TEST ONLY — remove before production migration
import TemplateTestPage from "@/pages/TemplateTestPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/home" replace />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    // Account is authenticated but missing role / branch — no ProtectedRoute
    // wrapper because we never want to redirect *away* from this page
    path: "/unauthorized",
    element: <Unauthorized />,
  },
  {
    path: "/home",
    element: (
      <ProtectedRoute>
        <WhatsAppSender />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute requireAdmin>
        <AdminDashboard />
      </ProtectedRoute>
    ),
  },
  {
    // LOCAL TEST ONLY — remove this route before production migration
    path: "/template-test",
    element: (
      <ProtectedRoute>
        <TemplateTestPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "*",
    element: <Navigate to="/home" replace />,
  },
]);
