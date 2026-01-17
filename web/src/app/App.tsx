import React from "react";
import { Route, Routes, Navigate, useNavigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import Shell from "../components/Shell";
import DashboardPage from "../pages/DashboardPage";
import TenantsPage from "../pages/TenantsPage";
import MessagesPage from "../pages/MessagesPage";
import ConceptsPage from "../pages/ConceptsPage";
import TracePage from "../pages/TracePage";
import SettingsPage from "../pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={<Shell />}
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="concepts" element={<ConceptsPage />} />
        <Route path="trace" element={<TracePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
