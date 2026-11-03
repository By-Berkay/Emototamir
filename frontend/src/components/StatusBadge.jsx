import React from "react";
import { STATUS_META } from "../lib/api";

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, cls: "bg-slate-100 text-slate-700 border-slate-200" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium ${meta.cls}`}
      data-testid={`status-badge-${status}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
