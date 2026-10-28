import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Trash2, Upload } from "lucide-react";
import api from "../lib/api";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

// Ekspertiz kontrol listesi: durum seçenekleri ve gösterim kuralları tek yerde tutulur.
export const STATUS_OPTIONS = [
  { value: "good", label: "İYİ", active: "border-emerald-500 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  { value: "medium", label: "ORTA", active: "border-amber-500 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  { value: "service", label: "BAKIM", active: "border-red-500 bg-red-50 text-red-700", dot: "bg-red-500" },
];

export const STATUS_BADGE = {
  good: { label: "İYİ", variant: "success" },
  medium: { label: "ORTA", variant: "warning" },
  service: { label: "BAKIM", variant: "destructive" },
};

/** Maddeleri grup adına göre sıralı (ilk görünme sırasına göre) gruplar. */
export function groupItems(items = []) {
  const order = [];
  const map = {};
  items.forEach((it) => {
    const g = it.group || "Diğer";
    if (!map[g]) {
      map[g] = [];
      order.push(g);
    }
    map[g].push(it);
  });
  return order.map((group) => ({ group, items: map[group] }));
}

/** İYİ / ORTA / BAKIM segmentli seçim. Aktif öğeye tekrar tıklanırsa seçim kaldırılır. */
export function StatusSegment({ itemKey, value, onChange }) {
  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
      data-testid={`select-status-${itemKey}`}
    >
      {STATUS_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : opt.value)}
            className={cn(
              "flex min-w-[68px] items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors duration-150",
              active ? opt.active : "border-transparent text-slate-500 hover:bg-white hover:text-slate-800"
            )}
            data-testid={`btn-status-${itemKey}-${opt.value}`}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", active ? opt.dot : "bg-slate-300")} aria-hidden="true" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Yetkili olarak çekilen fotoğraf küçük resmi (Authorization başlığı API istemcisinde eklenir). */
export function InspectionPhotoThumb({ inspectionId, photo, onDelete }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    api
      .get(`/inspections/${inspectionId}/photos/${photo.id}`, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [inspectionId, photo.id]);

  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100" data-testid={`photo-${photo.id}`}>
      <div className="aspect-[4/3] w-full">
        {url ? (
          <img src={url} alt={photo.filename || "Ekspertiz fotoğrafı"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-slate-500">
            {failed ? "Fotoğraf yüklenemedi" : "Yükleniyor…"}
          </div>
        )}
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(photo.id)}
          aria-label="Fotoğrafı sil"
          className="absolute right-1.5 top-1.5 rounded-md bg-white/95 p-1.5 text-red-600 shadow-sm transition-colors duration-150 hover:bg-red-600 hover:text-white md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          data-testid={`btn-delete-photo-${photo.id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Bir kontrol maddesinin fotoğraf paneli. Fotoğraflar madde anahtarıyla (item_key) bağlanır.
 * onAdded / onRemoved üst bileşende fonksiyonel güncelleme ile işlenir.
 */
export function ItemPhotos({ inspectionId, itemKey, itemLabel, photos, onAdded, onRemoved }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const upload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    const added = [];
    try {
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        form.append("item_key", itemKey);
        // Content-Type elle verilmez: tarayıcı sınır (boundary) değeriyle birlikte multipart ayarlar.
        const { data } = await api.post(`/inspections/${inspectionId}/photos`, form);
        added.push(data);
      }
      onAdded(added);
      toast.success(`${added.length} fotoğraf eklendi`);
    } catch (err) {
      if (added.length) onAdded(added);
      toast.error(err.response?.data?.detail || "Fotoğraf yüklenemedi");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (photoId) => {
    if (!window.confirm("Bu fotoğraf silinsin mi?")) return;
    try {
      await api.delete(`/inspections/${inspectionId}/photos/${photoId}`);
      onRemoved(photoId);
      toast.success("Fotoğraf silindi");
    } catch {
      toast.error("Fotoğraf silinemedi");
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-600">
          {itemLabel} · {photos.length} fotoğraf
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          data-testid={`btn-upload-item-photo-${itemKey}`}
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Yükleniyor…" : "Fotoğraf ekle"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={upload}
          className="hidden"
          data-testid={`input-item-photo-${itemKey}`}
        />
      </div>
      {photos.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Camera className="h-3.5 w-3.5" /> Henüz fotoğraf yok.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => (
            <InspectionPhotoThumb key={p.id} inspectionId={inspectionId} photo={p} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Okuma modunda durum rozeti. */
export function StatusBadgeInspection({ status }) {
  const meta = STATUS_BADGE[status];
  if (!meta) return <Badge variant="outline">Değerlendirilmedi</Badge>;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
