import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PrivacyProvider } from "./context/PrivacyContext";
import { Toaster } from "sonner";
import Layout from "./components/Layout";
import Login from "./pages/Login";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const Motorcycles = lazy(() => import("./pages/Motorcycles"));
const MotorcycleDetail = lazy(() => import("./pages/MotorcycleDetail"));
const ServiceOrders = lazy(() => import("./pages/ServiceOrders"));
const ServiceOrderCreate = lazy(() => import("./pages/ServiceOrderCreate"));
const ServiceOrderDetail = lazy(() => import("./pages/ServiceOrderDetail"));
const ServiceOrderEdit = lazy(() => import("./pages/ServiceOrderEdit"));

const CurrentAccounts = lazy(() => import("./pages/CurrentAccounts"));
const Payments = lazy(() => import("./pages/Payments"));
const Reports = lazy(() => import("./pages/Reports"));
const Reminders = lazy(() => import("./pages/Reminders"));
const Settings = lazy(() => import("./pages/Settings"));
const Products = lazy(() => import("./pages/Products"));
const Services = lazy(() => import("./pages/Services"));
const AdminTenants = lazy(() => import("./pages/AdminTenants"));
const AdminTenantEdit = lazy(() => import("./pages/AdminTenantEdit"));
const AdminAuditLogs = lazy(() => import("./pages/AdminAuditLogs"));
const PublicApproval = lazy(() => import("./pages/PublicApproval"));
const Quotes = lazy(() => import("./pages/Quotes"));
const QuoteEdit = lazy(() => import("./pages/QuoteEdit"));
const QuotePublic = lazy(() => import("./pages/QuotePublic"));
const Trash = lazy(() => import("./pages/Trash"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const Profile = lazy(() => import("./pages/Profile"));
const Finance = lazy(() => import("./pages/Finance"));
const Staff = lazy(() => import("./pages/Staff"));
const Inspections = lazy(() => import("./pages/Inspections"));
const InspectionEdit = lazy(() => import("./pages/InspectionEdit"));
const InspectionDetail = lazy(() => import("./pages/InspectionDetail"));
import Landing from "./pages/Landing";
const AdminLanding = lazy(() => import("./pages/AdminLanding"));
const AdminReport3D = lazy(() => import("./pages/AdminReport3D"));
import BrandLoader from "./components/BrandLoader";
import "./App.css";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <BrandLoader />;
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
  if (loading) return <BrandLoader />;
  if (!user) return <Landing />;
  return <Navigate to={user.role === "super_admin" ? "/admin/tenants" : "/dashboard"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PrivacyProvider>
        <Toaster position="top-right" richColors />
        <Suspense fallback={<BrandLoader />}>
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
        </Suspense>
        </PrivacyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
