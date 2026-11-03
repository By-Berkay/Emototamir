import React from "react";

/** Boş liste / veri yok durumu. */
export default function EmptyState({ icon: Icon, title, description, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      {Icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <p className="font-heading text-base font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
