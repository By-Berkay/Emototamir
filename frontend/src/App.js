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
import Products from "./pages/Products";
import Services from "./pages/Services";
import CurrentAccounts from "./pages/CurrentAccounts";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import "./App.css";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Yükleniyor…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/motorcycles" element={<Motorcycles />} />
            <Route path="/motorcycles/:id" element={<MotorcycleDetail />} />
            <Route path="/service-orders" element={<ServiceOrders />} />
            <Route path="/service-orders/new" element={<ServiceOrderCreate />} />
            <Route path="/service-orders/:id" element={<ServiceOrderDetail />} />
            <Route path="/products" element={<Products />} />
            <Route path="/services" element={<Services />} />
            <Route path="/current-accounts" element={<CurrentAccounts />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
