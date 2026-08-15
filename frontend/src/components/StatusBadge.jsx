import React from "react";
import { STATUS_META } from "../lib/api";

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, cls: "bg-slate-100 text-slate-700 border-slate-200" };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}
      data-testid={`status-badge-${status}`}
    >
      {meta.label}
    </span>
  );
}
