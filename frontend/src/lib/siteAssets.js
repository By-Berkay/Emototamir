import { useEffect, useState } from "react";
import api, { API } from "./api";

// Süper admin'in yüklediği tasarım görselleri (vitrin/banner/logo). Oturum boyunca önbelleklenir.
let cache = null;
let inflight = null;

function loadMap() {
  if (!inflight) {
    inflight = api
      .get("/public/site-assets")
      .then((r) => {
        cache = r.data || {};
        return cache;
      })
      .catch(() => {
        cache = {};
        return cache;
      });
  }
  return inflight;
}

/** Süper admin görsel yükleyince çağrılır; bir sonraki okumada yeniden alınır. */
export function invalidateSiteAssets() {
  cache = null;
  inflight = null;
}

export function useSiteAssetMap() {
  const [map, setMap] = useState(cache || {});
  useEffect(() => {
    let alive = true;
    loadMap().then((m) => alive && setMap(m));
    return () => {
      alive = false;
    };
  }, []);
  return map;
}

// Yüklenmemiş slotlar için paketten gelen varsayılan görseller.
export const SITE_DEFAULTS = {
  logo: "/visuals/emoto-logo.png",
  login_hero: "/visuals/site/bike-orange-naked.webp",
  landing_hero: "/visuals/site/bike-orange-naked.webp",
  dashboard_hero: "/visuals/site/bike-blue-naked.webp",
  customers_hero: "/visuals/site/bike-red-roadster.webp",
  motorcycles_hero: "/visuals/site/bike-green-sport.webp",
  motorcycle_detail: "/visuals/site/bike-blue-naked.webp",
  services_hero: "/visuals/site/bike-orange-naked.webp",
  service_detail_hero: "/visuals/site/bike-blue-naked.webp",
  inspection_hero: "/visuals/site/bike-orange-naked.webp",
  accounts_hero: "/visuals/site/bike-red-roadster.webp",
  reports_hero: "/visuals/site/bike-blue-naked.webp",
};

/** Arka plan atölye görseli (tüm banner'lar için ortak). */
export const SITE_BACKGROUND = "/visuals/site/bg-atelier-empty.webp";

/** Slot için görsel adresi; yüklenmemişse fallback, o da yoksa paket varsayılanı döner. */
export function useSiteAsset(slot, fallback = null) {
  const map = useSiteAssetMap();
  const meta = map[slot];
  if (!meta) return fallback ?? SITE_DEFAULTS[slot] ?? null;
  return `${API}/public/site-assets/${slot}?v=${encodeURIComponent(meta.updated_at || "")}`;
}
