import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
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
import Products from "./pages/Products";
import Services from "./pages/Services";
import CurrentAccounts from "./pages/CurrentAccounts";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import Reminders from "./pages/Reminders";
import Settings from "./pages/Settings";
import AdminTenants from "./pages/AdminTenants";
import AdminTenantEdit from "./pages/AdminTenantEdit";
import AdminAuditLogs from "./pages/AdminAuditLogs";
import PublicApproval from "./pages/PublicApproval";
import Quotes from "./pages/Quotes";
import QuoteEdit from "./pages/QuoteEdit";
import QuotePublic from "./pages/QuotePublic";
import Trash from "./pages/Trash";
import ChangePassword from "./pages/ChangePassword";
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onay/:token" element={<PublicApproval />} />
          <Route path="/q/:token" element={<QuotePublic />} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route index element={<IndexRoute />} />
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
            <Route path="/products" element={<Settings />} />
            <Route path="/services" element={<Settings />} />
            <Route path="/current-accounts" element={<CurrentAccounts />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/account/password" element={<ChangePassword />} />
            <Route path="/admin/tenants" element={<AdminTenants />} />
            <Route path="/admin/tenants/:id" element={<AdminTenantEdit />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
