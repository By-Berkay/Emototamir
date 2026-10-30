import React from "react";
import { Wrench } from "lucide-react";

/** Herkese açık sayfalar (onay, teklif) için ortak kabuk: aurora arka plan, marka başlığı ve cam kart. */
export default function PublicShell({ eyebrow, tenantName, children, footer }) {
  return (
    <div className="emt-aurora min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-heading truncate font-bold text-slate-900 dark:text-white">{tenantName || "Moto Servis"}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{eyebrow}</div>
          </div>
        </header>
        {children}
        {footer && <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">{footer}</p>}
      </div>
    </div>
  );
}
