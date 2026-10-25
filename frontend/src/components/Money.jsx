import React from "react";
import { fmtMoney } from "../lib/api";
import { usePrivacy } from "../context/PrivacyContext";

const MASK = "**.***,** ₺";

/** Parasal değer. Gizliyken (ya da sunucu maskelediyse) rakamlar * ile gösterilir. */
export default function Money({ value, className = "" }) {
  const { unlocked } = usePrivacy();
  const hidden = !unlocked || value === null || value === undefined;
  return (
    <span className={`${className} tabular-nums`} aria-label={hidden ? "gizli tutar" : undefined}>
      {hidden ? MASK : fmtMoney(value)}
    </span>
  );
}
