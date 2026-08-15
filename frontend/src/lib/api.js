import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

export const fmtMoney = (v) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(
    Number(v || 0)
  );

export const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
};

export const fmtDateShort = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR");
};

export const STATUS_META = {
  new: { label: "Yeni", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  diagnosed: { label: "Arıza Tespiti Yapıldı", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  pricing: { label: "Fiyatlandırma Bekliyor", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  awaiting_approval: { label: "Onay Bekliyor", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  approved: { label: "Onaylandı", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  in_repair: { label: "Tamirde", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  parts_waiting: { label: "Parça Bekleniyor", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  completed: { label: "Tamamlandı", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  awaiting_delivery: { label: "Teslim Bekliyor", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  delivered: { label: "Teslim Edildi", cls: "bg-green-100 text-green-800 border-green-300" },
  cancelled: { label: "İptal", cls: "bg-red-50 text-red-700 border-red-200" },
};

export const STATUS_LIST = Object.keys(STATUS_META);

export const MOTO_TYPES = [
  "Scooter", "Maxi Scooter", "Naked", "Sport", "Touring",
  "Adventure", "Enduro", "Cross", "Chopper", "Cruiser",
  "Cafe Racer", "Elektrikli", "Diğer",
];
