import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FAULT_ZONES } from "./FaultDiagram";

/**
 * Parametrik 3D motosiklet (hologram görünümü).
 * - Marka/model lisanslı bir varlık kullanmaz; tip, renk ve ölçüler ilkel geometriyle üretilir.
 * - Arıza bölgeleri 3D sahnede işaretlenir ve tıklanabilir (klavye erişilebilir chip listesi de vardır).
 * - WebGL yoksa veya hata olursa `fallback` (statik SVG) gösterilir.
 * - prefers-reduced-motion: dönüş animasyonu kapalı, tek kare çizilir.
 */

const HOLO = 0x38bdf8;
const ACCENT = 0xf97316;

// Tip ölçüleri (metre benzeri birim). r: tekerlek yarıçapı, wb: dingil mesafesi, H: koltuk yüksekliği, bar: gidon yüksekliği.
const TYPES = {
  naked:        { r: 0.32, wb: 1.45, H: 0.8,  bar: 0.95 },
  sport:        { r: 0.30, wb: 1.38, H: 0.82, bar: 0.78 },
  touring:      { r: 0.33, wb: 1.55, H: 0.85, bar: 0.98 },
  adventure:    { r: 0.36, wb: 1.52, H: 0.95, bar: 1.05 },
  enduro:       { r: 0.38, wb: 1.5,  H: 0.95, bar: 1.0 },
  cross:        { r: 0.36, wb: 1.48, H: 0.9,  bar: 0.98 },
  chopper:      { r: 0.30, wb: 1.85, H: 0.7,  bar: 1.1 },
  cruiser:      { r: 0.31, wb: 1.65, H: 0.72, bar: 0.95 },
  "cafe racer": { r: 0.31, wb: 1.42, H: 0.78, bar: 0.8 },
  scooter:      { r: 0.2,  wb: 1.3,  H: 0.78, bar: 1.05 },
};

// Tip metninden ölçü seçer; bilinmeyen/boş tip "naked" (varsayılan hologram) olur.
export function resolveType(type) {
  const key = String(type || "").toLocaleLowerCase("tr").trim();
  return TYPES[key] ? key : "naked";
}

const COLOR_NAMES = {
  "kırmızı": "#dc2626", "kirmizi": "#dc2626", "siyah": "#111827", "beyaz": "#e5e7eb",
  "mavi": "#2563eb", "yeşil": "#16a34a", "yesil": "#16a34a", "sarı": "#eab308", "sari": "#eab308",
  "gri": "#6b7280", "gümüş": "#cbd5e1", "gumus": "#cbd5e1", "turuncu": "#f97316", "mor": "#7c3aed",
};

// Renk metninden hex üretir: hex kodu, bilinen Türkçe renk adı, aksi halde marka turuncusu.
export function resolveColor(color) {
  const raw = String(color || "").trim().toLocaleLowerCase("tr");
  if (/^#?[0-9a-f]{6}$/.test(raw)) return `#${raw.replace("#", "")}`;
  return COLOR_NAMES[raw] || "#f97316";
}

// Arıza bölgesi konumları (3D, tip ölçüsünden türetilir).
function anchors(d) {
  const front = new THREE.Vector3(d.wb / 2, d.r, 0);
  const rear = new THREE.Vector3(-d.wb / 2, d.r, 0);
  const neck = new THREE.Vector3(d.wb / 2 - 0.3, d.H + 0.05, 0);
  const z = 0.22;
  return {
    "Ön Fren": new THREE.Vector3(front.x + d.r * 0.45, front.y + d.r * 0.3, z),
    "Arka Fren": new THREE.Vector3(rear.x + d.r * 0.45, rear.y + d.r * 0.3, z),
    "Ön Teker": new THREE.Vector3(front.x - d.r * 0.7, front.y - d.r * 0.7, z),
    "Arka Teker": new THREE.Vector3(rear.x - d.r * 0.7, rear.y - d.r * 0.7, z),
    "Motor": new THREE.Vector3(0, d.r + 0.28, z),
    "Şanzıman": new THREE.Vector3(0.05, d.r + 0.08, z),
    "Egzoz": new THREE.Vector3(-0.45 * d.wb, d.r + 0.05, z),
    "Elektrik": new THREE.Vector3(neck.x + 0.12, neck.y + 0.1, z),
    "Akü": new THREE.Vector3(-0.25 * d.wb, d.H - 0.12, z),
    "Yakıt Sistemi": new THREE.Vector3(0.05, d.H + 0.02, z + 0.05),
    "Süspansiyon": new THREE.Vector3(front.x - 0.1, (neck.y + front.y) / 2, z),
  };
}

function holoMaterials(color, opacity = 0.16) {
  return {
    fill: new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }),
    line: new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }),
  };
}

// Geometriyi hem dolgu (saydam) hem kenar çizgisi olarak ekler.
function addSolid(group, geometry, position, color, opacity) {
  const { fill, line } = holoMaterials(color, opacity);
  const mesh = new THREE.Mesh(geometry, fill);
  mesh.position.copy(position);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), line);
  edges.position.copy(position);
  group.add(mesh, edges);
  return { mesh, edges };
}

// İki nokta arasında silindirik boru (çatal, şase, egzoz).
function beam(group, a, b, radius, color) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, 10);
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const { fill, line } = holoMaterials(color, 0.22);
  const mesh = new THREE.Mesh(geo, fill);
  mesh.position.copy(mid);
  mesh.quaternion.copy(q);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), line);
  edges.position.copy(mid);
  edges.quaternion.copy(q);
  group.add(mesh, edges);
}

function wheel(group, center, r, color) {
  const tyre = new THREE.TorusGeometry(r, 0.055, 12, 48);
  addSolid(group, tyre, center.clone().setZ(0.02), color, 0.12);
  const disc = new THREE.RingGeometry(r * 0.3, r * 0.62, 32);
  addSolid(group, disc, center.clone().setZ(0.09), HOLO, 0.25);
}

// Tipe göre 3D model kurar. bodyColor: tank/gövde rengi.
function buildBike(group, typeKey, bodyColor) {
  const d = TYPES[typeKey];
  const front = new THREE.Vector3(d.wb / 2, d.r, 0);
  const rear = new THREE.Vector3(-d.wb / 2, d.r, 0);
  wheel(group, front, d.r, HOLO);
  wheel(group, rear, d.r, HOLO);

  if (typeKey === "scooter") {
    // Scooter: alçak platform, ön kalkan, arka gövde.
    addSolid(group, new THREE.BoxGeometry(d.wb * 0.7, 0.12, 0.3), new THREE.Vector3(0.05, 0.25, 0), HOLO, 0.14);
    addSolid(group, new THREE.BoxGeometry(0.42, 0.55, 0.26), new THREE.Vector3(d.wb * 0.45, 0.6, 0), bodyColor, 0.35);
    addSolid(group, new THREE.BoxGeometry(0.5, 0.12, 0.22), new THREE.Vector3(-0.3, d.H, 0), HOLO, 0.2);
    beam(group, new THREE.Vector3(d.wb * 0.45, 0.9, 0), front.clone().setZ(0), 0.03, HOLO);
    return;
  }

  const neck = new THREE.Vector3(d.wb / 2 - 0.3, d.H + 0.05, 0);
  const engineC = new THREE.Vector3(0, d.r + 0.28, 0);

  // Şase ve çatal
  beam(group, neck, front, 0.035, HOLO);                             // ön çatal
  beam(group, neck, new THREE.Vector3(-0.2 * d.wb, d.H, 0), 0.04, HOLO); // üst şase
  beam(group, new THREE.Vector3(-0.2 * d.wb, d.H, 0), rear, 0.035, HOLO); // arka şase
  beam(group, rear, engineC, 0.03, HOLO);                             // salınım kolu
  beam(group, new THREE.Vector3(-0.2 * d.wb, d.H - 0.1, 0), new THREE.Vector3(-d.wb / 2 + 0.08, d.r + 0.2, 0), 0.025, HOLO); // amortisör
  beam(group, new THREE.Vector3(neck.x + 0.02, neck.y + 0.06, 0), new THREE.Vector3(neck.x - 0.1, d.bar, 0), 0.025, HOLO);  // gidon

  // Motor, tank, koltuk, egzoz, akü
  addSolid(group, new THREE.BoxGeometry(0.42, 0.3, 0.22), engineC, HOLO, 0.22);
  addSolid(group, new THREE.BoxGeometry(0.42, 0.16, 0.26), new THREE.Vector3(neck.x * 0.4, d.H + 0.02, 0), bodyColor, 0.4);
  addSolid(group, new THREE.BoxGeometry(0.5, 0.08, 0.22), new THREE.Vector3(-0.15 * d.wb, d.H, 0), HOLO, 0.2);
  beam(group, engineC.clone().add(new THREE.Vector3(0.15, -0.05, 0)), new THREE.Vector3(-0.45 * d.wb, d.r + 0.05, 0), 0.045, bodyColor);
  addSolid(group, new THREE.BoxGeometry(0.14, 0.1, 0.12), new THREE.Vector3(-0.25 * d.wb, d.H - 0.12, 0), HOLO, 0.25);
}

export default function MotorcycleModel3D({
  type, color, selected = [], onToggle, label, fallback = null, className = "", height = 260,
}) {
  const containerRef = useRef(null);
  const canvasHostRef = useRef(null);
  const hotspotRefs = useRef({});
  const pointerRef = useRef({ down: false, x: 0, rot: 0 });
  const [failed, setFailed] = useState(false);
  const typeKey = resolveType(type);
  const bodyHex = resolveColor(color);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      setFailed(true);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 0.85, 3.3);
    camera.lookAt(0, 0.5, 0);

    const group = new THREE.Group();
    buildBike(group, typeKey, new THREE.Color(bodyHex));
    scene.add(group);

    const ap = anchors(TYPES[typeKey]);
    const v = new THREE.Vector3();
    let raf = 0;
    let visible = true;
    let running = false;
    const t0 = performance.now();

    const resize = () => {
      const w = host.clientWidth || 300;
      const h = host.clientHeight || height;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // Tek kare çizer: modeli döndürür, arıza noktalarını ekran konumuna taşır.
    const draw = (t) => {
      if (!reduced && !pointerRef.current.down) {
        group.rotation.y = pointerRef.current.rot + Math.sin(t * 0.5) * 0.35;
      } else {
        group.rotation.y = pointerRef.current.rot;
      }
      renderer.render(scene, camera);
      Object.entries(ap).forEach(([zone, p]) => {
        const el = hotspotRefs.current[zone];
        if (!el) return;
        v.copy(p).applyMatrix4(group.matrixWorld).project(camera);
        const x = (v.x * 0.5 + 0.5) * host.clientWidth;
        const y = (-v.y * 0.5 + 0.5) * host.clientHeight;
        el.style.transform = `translate(${x - 22}px, ${y - 22}px)`;
      });
    };
    const loop = () => {
      if (!running) return;
      draw((performance.now() - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (reduced) { draw(0); return; } // hareket azaltma: dönüş yok, yalnızca tek kare
      if (running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    // Görünmüyorsa render etme (performans).
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !document.hidden) start(); else stop();
    });
    io.observe(host);
    const onVis = () => { if (document.hidden) stop(); else if (visible) start(); };
    document.addEventListener("visibilitychange", onVis);
    draw(0); // ilk kare her durumda çizilir

    // Sürükleyerek döndürme
    const el = renderer.domElement;
    const down = (e) => { pointerRef.current.down = true; pointerRef.current.x = e.clientX; };
    const move = (e) => {
      if (!pointerRef.current.down) return;
      pointerRef.current.rot += (e.clientX - pointerRef.current.x) * 0.01;
      pointerRef.current.x = e.clientX;
    };
    const up = () => { pointerRef.current.down = false; };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      renderer.dispose();
      if (el.parentNode === host) host.removeChild(el);
    };
  }, [typeKey, bodyHex, height, reduced]);

  if (failed && fallback) return <>{fallback}</>;

  const isSel = (z) => selected.includes(z);

  return (
    <div className={`relative w-full ${className}`} ref={containerRef} data-testid="moto-model-3d">
      <div
        ref={canvasHostRef}
        className="relative w-full overflow-hidden rounded-xl border border-cyan-400/20 bg-gradient-to-b from-[#0B1426] to-[#060B17]"
        style={{ height }}
        role="img"
        aria-label={label ? `${label} 3D model` : "Motosiklet 3D model"}
      >
        {/* Arıza noktaları */}
        {onToggle && FAULT_ZONES.map((zone) => (
          <button
            key={zone}
            type="button"
            ref={(node) => { if (node) hotspotRefs.current[zone] = node; else delete hotspotRefs.current[zone]; }}
            onClick={() => onToggle(zone)}
            aria-pressed={isSel(zone)}
            aria-label={`${zone} arıza bölgesi`}
            title={zone}
            className={`absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${isSel(zone) ? "text-white" : "text-cyan-200/70"}`}
          >
            <span className={`block h-3.5 w-3.5 rounded-full ring-2 ${isSel(zone) ? "bg-orange-500 ring-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.9)]" : "bg-cyan-400/30 ring-cyan-300/70"}`} />
          </button>
        ))}
      </div>
      {onToggle && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Arıza bölgeleri">
          {FAULT_ZONES.map((zone) => (
            <button
              key={zone}
              type="button"
              onClick={() => onToggle(zone)}
              aria-pressed={isSel(zone)}
              className={`min-h-11 rounded-full border px-3 text-xs font-medium transition-colors ${isSel(zone) ? "border-orange-400 bg-orange-500/20 text-orange-200" : "border-slate-600 text-slate-300 hover:border-cyan-400/60"}`}
            >
              {zone}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
