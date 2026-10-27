import React, { useRef } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Fare ile 3B eğilen yüzey. İmlecin üstünde parlama (glare) izi bırakır.
 * Erişilebilirlik: hareket azaltma tercihi açıkken eğilme devre dışı kalır.
 */
export default function Tilt3D({ children, className = "", max = 7, lift = 4, as: Tag = "div", ...rest }) {
  const ref = useRef(null);

  const onMove = (e) => {
    const el = ref.current;
    if (!el || reduced()) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.transform =
      `perspective(900px) rotateX(${((0.5 - py) * max).toFixed(2)}deg) ` +
      `rotateY(${((px - 0.5) * max * 1.2).toFixed(2)}deg) translateY(-${lift}px)`;
    el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
  };

  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <Tag
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`emt-tilt relative transition-transform duration-300 ease-out will-change-transform ${className}`}
      {...rest}
    >
      {children}
      <span aria-hidden="true" className="emt-glare" />
    </Tag>
  );
}
