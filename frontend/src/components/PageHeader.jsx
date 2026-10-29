import React from "react";

/**
 * Sayfa başlığı: üstte küçük etiket (eyebrow), başlık, açıklama ve sağda eylem düğmeleri.
 * Tüm sayfalarda aynı hiyerarşiyi kullanmak için tek kaynak.
 */
export default function PageHeader({ eyebrow, title, description, actions, className = "" }) {
  return (
    <div className={`mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">{eyebrow}</p>
        )}
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
