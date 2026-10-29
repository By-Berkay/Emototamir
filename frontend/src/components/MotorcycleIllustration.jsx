import React from "react";
import AuthedImage from "./AuthedImage";
import AnimatedMotorcycleSVG from "./AnimatedMotorcycleSVG";
import { useAuth } from "../context/AuthContext";

/**
 * Motosiklet tipi görseli. Kiracı özel bir tip görseli yüklediyse onu gösterir;
 * yoksa E-Moto animasyonlu SVG (salt görüntüleme) kullanır.
 */
export default function MotorcycleIllustration({ type = "Naked", className = "" }) {
  const { tenant } = useAuth() || {};
  const custom = tenant?.custom_moto_images?.[type];
  if (custom) {
    return (
      <div className={className}>
        <AuthedImage path={custom} alt={type} className="w-full h-full object-contain rounded-md bg-slate-100" />
      </div>
    );
  }
  return (
    <div className={className}>
      <AnimatedMotorcycleSVG type={type} label={type} height="100%" />
    </div>
  );
}
