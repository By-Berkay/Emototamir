import React from "react";

/** Gerçekçi motosiklet görseli. Servis raporlarındaki SVG çizimler yerine sayfa başlıklarında ve ana ekranda kullanılır. */
export default function MotoPhoto({ className = "", alt = "Motosiklet" }) {
  return (
    <img
      src="/visuals/moto-main.png"
      alt={alt}
      width="689"
      height="533"
      decoding="async"
      loading="lazy"
      className={`h-full w-full object-contain ${className}`}
    />
  );
}
