import React from "react";

/** Gerçekçi motosiklet görseli. Servis raporlarındaki SVG çizimler yerine sayfa başlıklarında ve ana ekranda kullanılır. */
export default function MotoPhoto({ className = "", alt = "Motosiklet" }) {
  return (
    <img
      src="/visuals/moto-hologram.jpg"
      alt={alt}
      width="1386"
      height="665"
      decoding="async"
      loading="lazy"
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
