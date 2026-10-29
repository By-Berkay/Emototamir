import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PrivacyProvider } from "./context/PrivacyContext";
import { Toaster } from "sonner";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Motorcycles from "./pages/Motorcycles";
import MotorcycleDetail from "./pages/MotorcycleDetail";
import ServiceOrders from "./pages/ServiceOrders";
import ServiceOrderCreate from "./pages/ServiceOrderCreate";
import ServiceOrderDetail from "./pages/ServiceOrderDetail";
import ServiceOrderEdit from "./pages/ServiceOrderEdit";

import CurrentAccounts from "./pages/CurrentAccounts";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import Reminders from "./pages/Reminders";
import Settings from "./pages/Settings";
import Products from "./pages/Products";
import Services from "./pages/Services";
import AdminTenants from "./pages/AdminTenants";
import AdminTenantEdit from "./pages/AdminTenantEdit";
import AdminAuditLogs from "./pages/AdminAuditLogs";
import PublicApproval from "./pages/PublicApproval";
import Quotes from "./pages/Quotes";
import QuoteEdit from "./pages/QuoteEdit";
import QuotePublic from "./pages/QuotePublic";
import Trash from "./pages/Trash";
import ChangePassword from "./pages/ChangePassword";
import Profile from "./pages/Profile";
import Finance from "./pages/Finance";
import Staff from "./pages/Staff";
import Inspections from "./pages/Inspections";
import InspectionEdit from "./pages/InspectionEdit";
import InspectionDetail from "./pages/InspectionDetail";
import Landing from "./pages/Landing";
import AdminLanding from "./pages/AdminLanding";
import AdminReport3D from "./pages/AdminReport3D";
import "./App.css";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Yükleniyor…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function IndexRoute() {
  const { user } = useAuth();
  if (user?.role === "super_admin") return <Navigate to="/admin/tenants" replace />;
  return <Dashboard />;
}

// Kök adres: misafirlere fiyat/paket vitrini, giriş yapanlara panel.
function RootGate() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Yükleniyor…</div>;
  if (!user) return <Landing />;
  return <Navigate to={user.role === "super_admin" ? "/admin/tenants" : "/dashboard"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PrivacyProvider>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/" element={<RootGate />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/onay/:token" element={<PublicApproval />} />
          <Route path="/q/:token" element={<QuotePublic />} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route path="/dashboard" element={<IndexRoute />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/motorcycles" element={<Motorcycles />} />
            <Route path="/motorcycles/:id" element={<MotorcycleDetail />} />
            <Route path="/service-orders" element={<ServiceOrders />} />
            <Route path="/service-orders/new" element={<ServiceOrderCreate />} />
            <Route path="/service-orders/:id" element={<ServiceOrderDetail />} />
            <Route path="/service-orders/:id/edit" element={<ServiceOrderEdit />} />
            <Route path="/quotes" element={<Quotes />} />
            <Route path="/quotes/new" element={<QuoteEdit />} />
            <Route path="/quotes/:id" element={<QuoteEdit />} />
            <Route path="/trash" element={<Trash />} />
            <Route path="/products" element={<Products />} />
            <Route path="/services" element={<Services />} />
            <Route path="/current-accounts" element={<CurrentAccounts />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/account/password" element={<ChangePassword />} />
            <Route path="/profil" element={<Profile />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/finance/staff" element={<Staff />} />
            <Route path="/inspections" element={<Inspections />} />
            <Route path="/inspections/new" element={<InspectionEdit />} />
            <Route path="/inspections/:id" element={<InspectionDetail />} />
            <Route path="/inspections/:id/edit" element={<InspectionEdit />} />
            <Route path="/admin/tenants" element={<AdminTenants />} />
            <Route path="/admin/tenants/:id" element={<AdminTenantEdit />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
            <Route path="/admin/landing" element={<AdminLanding />} />
            <Route path="/admin/report" element={<AdminReport3D />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </PrivacyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
