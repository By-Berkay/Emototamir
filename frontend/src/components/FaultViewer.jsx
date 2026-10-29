import React, { Suspense } from "react";
import FaultDiagram from "./FaultDiagram";
import MotorcycleIllustration from "./MotorcycleIllustration";

// 3D modeli tembel yükler (three.js ayrı parça olarak gelir). Yüklenemezse veya WebGL yoksa SVG'ye düşer.
const MotorcycleModel3D = React.lazy(() => import("./MotorcycleModel3D"));

/**
 * Motosiklet görünümü.
 * - onToggle verilirse: arıza seçimli 3D model (servis kaydı).
 * - onToggle yoksa: salt görüntüleme 3D modeli (detay/önizleme).
 * type/color boşsa varsayılan hologram motor gösterilir.
 */
export default function FaultViewer({ type, color, label, selected = [], onToggle, height, className }) {
  const svgFallback = onToggle
    ? <FaultDiagram selected={selected} onToggle={onToggle} motoType={type} />
    : <MotorcycleIllustration type={type} className={className || "w-full h-40"} />;
  return (
    <Suspense fallback={svgFallback}>
      <MotorcycleModel3D
        type={type}
        color={color}
        label={label}
        selected={selected}
        onToggle={onToggle}
        height={height || (onToggle ? 260 : 180)}
        className={className}
        fallback={svgFallback}
      />
    </Suspense>
  );
}
