import React, { useRef } from "react";
import "./AnimatedMotorcycleSVG.css";

/**
 * E-Moto Tamir - enhanced animated 2.5D motorcycle vector viewer (V4).
 * Copy the V4 models to frontend/public/moto-svg/*.svg.
 * Compatible with FaultViewer's {type,color,label,selected,onToggle,height,className} API.
 * Vector graphics are 2.5D, not true 360-degree rotating geometry.
 */
const MODEL_BY_TYPE = {
  naked: "naked",
  sport: "supersport",
  supersport: "supersport",
  touring: "touring",
  adventure: "adventure",
  adv: "adventure",
  enduro: "motocross",
  cross: "motocross",
  motocross: "motocross",
  cruiser: "cruiser",
  chopper: "chopper",
  scooter: "scooter",
  "maxi scooter": "maxi_scooter",
  "cafe racer": "cafe_racer",
  "café racer": "cafe_racer",
  elektrikli: "naked",
  diğer: "naked",
};

export function resolveSvgMotorcycleType(type) {
  return MODEL_BY_TYPE[String(type || "Naked").toLocaleLowerCase("tr-TR").trim()] || "naked";
}

const FAULT_ZONES = [
  ["Ön Fren", 668, 382], ["Arka Fren", 233, 382],
  ["Ön Teker", 691, 425], ["Arka Teker", 221, 426],
  ["Motor", 443, 312], ["Şanzıman", 487, 351],
  ["Egzoz", 337, 376], ["Elektrik", 603, 220],
  ["Akü", 365, 270], ["Yakıt Sistemi", 463, 218],
  ["Süspansiyon", 630, 295],
];

const SCOOTER_ZONES = FAULT_ZONES.map(([name, x, y]) => {
  if (name === "Motor") return [name, 341, 332];
  if (name === "Şanzıman") return [name, 376, 345];
  if (name === "Akü") return [name, 411, 293];
  if (name === "Yakıt Sistemi") return [name, 286, 300];
  return [name, x, y];
});

export default function AnimatedMotorcycleSVG({
  type = "Naked", label, selected = [], onToggle,
  height = "auto", className = "", color,
}) {
  const model = resolveSvgMotorcycleType(type);
  const stageRef = useRef(null);
  const zones = model === "scooter" || model === "maxi_scooter" ? SCOOTER_ZONES : FAULT_ZONES;

  const onMove = (e) => {
    if (!stageRef.current || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = stageRef.current.getBoundingClientRect();
    const x = (e.clientX - bounds.left) / bounds.width - 0.5;
    const y = (e.clientY - bounds.top) / bounds.height - 0.5;
    stageRef.current.style.setProperty("--em-yaw", `${x * 20}deg`);
    stageRef.current.style.setProperty("--em-pitch", `${-y * 10}deg`);
  };
  const reset = () => {
    stageRef.current?.style.setProperty("--em-yaw", "0deg");
    stageRef.current?.style.setProperty("--em-pitch", "0deg");
  };

  return (
    <div className={`em-bike-viewer ${className}`} data-testid="moto-svg-viewer" data-bike-type={model}>
      <div className="em-bike-frame" style={height === "auto" ? { aspectRatio: "900 / 520" } : { height }}>
        <div
          ref={stageRef}
          className="em-bike-stage"
          onPointerMove={onMove}
          onPointerLeave={reset}
        >
          <img
            className="em-bike-art"
            src={`/moto-svg/${model}.svg`}
            alt={`${label || type} — hareketli SVG motosiklet`}
            loading="lazy"
            draggable={false}
            data-color-requested={color || undefined}
          />
          {typeof onToggle === "function" && zones.map(([name, x, y]) => {
            const active = selected.includes(name);
            return (
              <button
                key={name}
                type="button"
                className={`em-bike-hotspot ${active ? "is-active" : ""}`}
                style={{ left: `${x / 900 * 100}%`, top: `${y / 520 * 100}%` }}
                title={name}
                aria-label={`${name} arıza bölgesi`}
                aria-pressed={active}
                data-testid={`fault-zone-${name}`}
                onClick={() => onToggle(name)}
              >
                <span aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
      {typeof onToggle === "function" && (
        <div className="em-bike-zone-list" role="group" aria-label="Arıza bölgeleri">
          {zones.map(([name]) => (
            <button
              key={name}
              type="button"
              aria-pressed={selected.includes(name)}
              onClick={() => onToggle(name)}
              className={selected.includes(name) ? "is-active" : ""}
              data-testid={`fault-btn-${name}`}
            >{name}</button>
          ))}
        </div>
      )}
    </div>
  );
}
