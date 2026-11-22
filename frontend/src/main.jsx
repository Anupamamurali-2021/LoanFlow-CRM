
import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import StaffDashboard from "./pages/StaffDashboard.jsx";

import "./index.css";

// Protect pages based on login and user role
function ProtectedRoute({ children, allowedRole }) {
  const location = useLocation();
  const token = sessionStorage.getItem("token");
  const savedUser = sessionStorage.getItem("user");

  const loginRedirect = (
    <Navigate
      to="/login"
      state={{
        from: location.pathname + location.search + location.hash,
      }}
      replace
    />
  );

  if (!token || !savedUser) {
    return loginRedirect;
  }

  let user;

  try {
    user = JSON.parse(savedUser);
  } catch {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");

    return loginRedirect;
  }

  // Prevent users from opening pages for another role
  if (user?.role !== allowedRole) {
    return loginRedirect;
  }

  return children;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Welcome Page */}
        <Route path="/" element={<App />} />

        {/* Login Page */}
        <Route path="/login" element={<Login />} />

        {/* Desktop Admin Portal */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Mobile Admin Portal */}
        <Route
          path="/mobile-admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Staff Portal */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRole="staff">
              <StaffDashboard />
            </ProtectedRoute>
          }
        />

        {/* Unknown Pages */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
