import React from "react";

// Cam yüzeyli kart: açık ve koyu temada token tabanlı (index.css `.glass-card`).
export default function GlassCard({ className = "", as: Tag = "div", children, ...rest }) {
  return (
    <Tag className={`glass-card rounded-xl p-4 ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
