import React from "react";
import AnimatedMotorcycleSVG from "./AnimatedMotorcycleSVG";

/**
 * Motosiklet görünümü (E-Moto V4 animasyonlu SVG).
 * - onToggle verilirse: arıza seçimli görünüm (servis kaydı).
 * - onToggle yoksa: salt görüntüleme (detay/önizleme).
 * type boşsa varsayılan "naked" gösterilir.
 */
export default function FaultViewer({ type, color, label, selected = [], onToggle, height, className }) {
  return (
    <AnimatedMotorcycleSVG
      type={type}
      color={color}
      label={label}
      selected={selected}
      onToggle={onToggle}
      height={height || "auto"}
      className={className}
    />
  );
}
