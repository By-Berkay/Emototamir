import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

// Suppress benign ResizeObserver loop errors from webpack-dev-server overlay
const RO_MSGS = ["ResizeObserver loop", "ResizeObserver loop limit exceeded"];
window.addEventListener("error", (e) => {
  if (e?.message && RO_MSGS.some((m) => String(e.message).includes(m))) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = e?.reason?.message || "";
  if (RO_MSGS.some((m) => String(msg).includes(m))) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
