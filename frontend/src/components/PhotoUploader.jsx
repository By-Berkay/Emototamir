import React, { useEffect, useRef, useState } from "react";
import api, { API } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Upload, X, Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";

function AuthImage({ path, caption }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let revoked = false;
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await api.get(`/files/${path}`, { responseType: "blob", headers: { Authorization: `Bearer ${token}` } });
        if (!revoked) setUrl(URL.createObjectURL(res.data));
      } catch {}
    })();
    return () => { revoked = true; if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line
  }, [path]);
  return (
    <div className="relative group">
      {url ? <img src={url} alt={caption} className="w-full h-32 object-cover rounded-md border border-slate-200" /> :
        <div className="w-full h-32 bg-slate-100 rounded-md flex items-center justify-center text-slate-400 text-xs">Yükleniyor…</div>}
      {caption && <div className="text-xs text-slate-600 mt-1 truncate">{caption}</div>}
    </div>
  );
}

export default function PhotoUploader({ serviceOrderId, photos = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const fileRef = useRef(null);

  const upload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        form.append("caption", caption);
        const res = await api.post(`/service-orders/${serviceOrderId}/photos`, form, { headers: { "Content-Type": "multipart/form-data" } });
        uploaded.push(res.data);
      }
      toast.success(`${uploaded.length} fotoğraf yüklendi`);
      setCaption("");
      onChange?.([...photos, ...uploaded]);
    } catch (err) {
      toast.error("Yükleme başarısız");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (pid) => {
    if (!window.confirm("Bu fotoğrafı silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/service-orders/${serviceOrderId}/photos/${pid}`);
      onChange?.(photos.filter((p) => p.id !== pid));
      toast.success("Fotoğraf silindi");
    } catch { toast.error("Silme başarısız"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Açıklama (opsiyonel) — örn. sol yan hasar" value={caption} onChange={(e)=>setCaption(e.target.value)} className="flex-1" data-testid="photo-caption" />
        <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" onChange={upload} className="hidden" data-testid="photo-file-input" />
        <Button onClick={()=>fileRef.current?.click()} disabled={uploading} className="bg-slate-900 hover:bg-slate-800" data-testid="btn-upload-photo">
          <Upload className="h-4 w-4 mr-2" />{uploading ? "Yükleniyor…" : "Fotoğraf Yükle"}
        </Button>
      </div>
      {photos.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-md p-8 text-center text-slate-500 text-sm">
          <Camera className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Henüz fotoğraf eklenmedi. Hasar, arıza veya değiştirilen parça fotoğraflarını yükleyin.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              <AuthImage path={p.path} caption={p.caption} />
              <button onClick={()=>remove(p.id)}
                className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`del-photo-${p.id}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
