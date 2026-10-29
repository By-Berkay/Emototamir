import React from "react";

/**
 * Sayfa başlığı görsel ögesi: parlayan marka ikonu ve iki dönen halka.
 * Yalnızca geniş ekranda gösterilir (PageHeader içinde); süs amaçlıdır, bilgi taşımaz.
 */
export default function PageVisual({ icon: Icon }) {
  return (
    <div className="relative flex h-full w-full items-center justify-end">
      <span className="absolute right-10 top-1/2 h-20 w-20 -translate-y-1/2 animate-spin rounded-full border border-brand-500/30 [animation-duration:18s] motion-reduce:animate-none" />
      <span className="absolute right-2 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full border border-cyan-400/15 motion-reduce:hidden" />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-[0_0_28px_rgba(249,115,22,0.45)]">
        {Icon && <Icon className="h-7 w-7" />}
      </span>
    </div>
  );
}
