import React, { useEffect, useState } from "react";
import api from "../lib/api";

/** Sunucudaki bir dosyayı (logo, motor görseli) Authorization başlığıyla çekip gösterir. */
export default function AuthedImage({ path, alt = "", className = "" }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!path) { setSrc(null); return undefined; }
    let url = null;
    let cancelled = false;
    api.get(`/files/${path}`, { responseType: "blob" })
      .then(({ data }) => {
        if (cancelled) return;
        url = URL.createObjectURL(data);
        setSrc(url);
      })
      .catch(() => { if (!cancelled) setSrc(null); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  if (!src) return null;
  return <img src={src} alt={alt} className={className} />;
}
