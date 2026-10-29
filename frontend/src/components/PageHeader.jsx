import React from "react";

/**
 * Sayfa başlığı: etiket (eyebrow), başlık, açıklama, isteğe bağlı görsel öge (visual) ve eylem düğmeleri.
 * Koyu temada yumuşak marka ışıması içerir; görsel öge yalnızca geniş ekranda gösterilir.
 */
export default function PageHeader({ eyebrow, title, description, actions, visual, className = "" }) {
  return (
    <div className={`relative mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-16 h-56 w-56 rounded-full bg-brand-500/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute right-48 -bottom-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">{eyebrow}</p>
        )}
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {visual && <div className="relative hidden h-16 w-48 shrink-0 xl:block" aria-hidden="true">{visual}</div>}
      {actions && <div className="relative flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
