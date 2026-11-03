import React, { useEffect, useRef, useState } from "react";
import api, { API } from "../lib/api";
import PageHeader from "../components/PageHeader";
import PageVisual from "../components/PageVisual";
import { ImagePlus, Trash2, Upload, ImageOff } from "lucide-react";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { invalidateSiteAssets } from "../lib/siteAssets";

const ACCEPT = "image/png,image/jpeg,image/webp";

/** Süper Admin: vitrin, banner ve logo görsellerini yükler / değiştirir / kaldırır. */
export default function AdminSiteAssets() {
  const [items, setItems] = useState(null);

  const load = () =>
    api
      .get("/admin/site-assets")
      .then(({ data }) => setItems(data))
      .catch(() => toast.error("Görseller yüklenemedi"));

  useEffect(() => {
    load();
  }, []);

  const changed = () => {
    invalidateSiteAssets();
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        visual={<PageVisual icon={ImagePlus} />}
        title="Görsel Yönetimi"
        description="Giriş, vitrin, panel ve liste sayfalarındaki banner görsellerini ve logoyu buradan değiştirin. PNG, JPG veya WEBP; en fazla 8 MB. Yüklenmeyen alanlarda varsayılan görsel kullanılır."
      />

      {!items ? (
        <div className="text-slate-400">Yükleniyor…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="site-assets-grid">
          {items.map((it) => (
            <AssetCard key={it.slot} item={it} onChanged={changed} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssetCard({ item, onChanged }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const src = item.has_image ? `${API}/public/site-assets/${item.slot}?v=${encodeURIComponent(item.updated_at || "")}` : null;

  const upload = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    try {
      await api.post(`/admin/site-assets/${item.slot}`, form, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${item.label} güncellendi`);
      onChanged();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Yüklenemedi");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!window.confirm(`${item.label} görseli kaldırılsın mı? Varsayılan görsel kullanılacak.`)) return;
    setBusy(true);
    try {
      await api.delete(`/admin/site-assets/${item.slot}`);
      toast.success("Görsel kaldırıldı");
      onChanged();
    } catch {
      toast.error("Kaldırılamadı");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70" data-testid={`site-asset-${item.slot}`}>
      <div className="flex h-40 items-center justify-center bg-slate-950/80 p-3">
        {src ? (
          <img src={src} alt={item.label} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <ImageOff className="h-7 w-7" />
            <span className="text-xs">Görsel yüklenmedi</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-sm font-semibold text-white">{item.label}</h3>
          <p className="mt-0.5 text-xs text-slate-400">{item.hint}</p>
          {item.updated_at && (
            <p className="mt-1 text-[11px] text-slate-400">Son güncelleme: {new Date(item.updated_at).toLocaleString("tr-TR")}</p>
          )}
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => upload(e.target.files?.[0])}
            data-testid={`site-asset-input-${item.slot}`}
          />
          <Button size="sm" disabled={busy} onClick={() => inputRef.current?.click()} data-testid={`site-asset-upload-${item.slot}`}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> {item.has_image ? "Değiştir" : "Yükle"}
          </Button>
          {item.has_image && (
            <Button size="sm" variant="outline" disabled={busy} onClick={remove}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Kaldır
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
