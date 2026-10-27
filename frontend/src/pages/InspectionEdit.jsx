import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Camera, Save, Search, X } from "lucide-react";
import api from "../lib/api";
import { toWhatsAppNumber } from "../lib/phone";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { ItemPhotos, StatusSegment, groupItems, STATUS_OPTIONS } from "../components/InspectionChecklist";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { cn } from "../lib/utils";

const todayIso = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const str = (v) => (v === null || v === undefined ? "" : String(v));

const EMPTY_FORM = {
  customer_id: "",
  motorcycle_id: "",
  owner_name: "",
  customer_phone: "",
  plate: "",
  make_model: "",
  year: "",
  km: "",
  chassis_no: "",
  inspection_date: "",
  technician_name: "",
  receiver_name: "",
  notes: "",
};

const formFromDoc = (d) => ({
  customer_id: str(d.customer_id),
  motorcycle_id: str(d.motorcycle_id),
  owner_name: str(d.owner_name),
  customer_phone: str(d.customer_phone),
  plate: str(d.plate),
  make_model: str(d.make_model),
  year: str(d.year),
  km: str(d.km),
  chassis_no: str(d.chassis_no),
  inspection_date: str(d.inspection_date) || todayIso(),
  technician_name: str(d.technician_name),
  receiver_name: str(d.receiver_name),
  notes: str(d.notes),
});

const itemFromDoc = (it) => ({
  key: it.key,
  label: it.label,
  group: it.group,
  status: it.status ?? null,
  note: str(it.note),
});

function Field({ label, htmlFor, hint, className = "", children }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Kayıtlı müşteriyi arayıp seçen popover. Seçilince ad, telefon ve motosikletler formu doldurur. */
function CustomerPicker({ onPick }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
        const { data } = await api.get(`/customers${query}`);
        if (active) setResults(data.slice(0, 25));
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" data-testid="btn-pick-customer">
          <Search className="h-4 w-4" /> Müşteri ara ve seç
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-0" data-testid="popover-customer">
        <div className="border-b border-slate-100 p-3">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ad, soyad veya telefon"
            className="h-9"
            aria-label="Müşteri ara"
            data-testid="input-customer-search"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto p-1">
          {searching && <li className="px-3 py-3 text-sm text-slate-500">Aranıyor…</li>}
          {!searching && results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-slate-500">Müşteri bulunamadı</li>
          )}
          {!searching &&
            results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(c);
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors duration-150 hover:bg-slate-50"
                  data-testid={`pick-customer-${c.id}`}
                >
                  <span className="min-w-0 truncate text-sm font-medium text-slate-900">
                    {c.first_name} {c.last_name}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-slate-500">{c.phone || "-"}</span>
                </button>
              </li>
            ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Kontrol maddesi satırı: etiket, İYİ/ORTA/BAKIM seçimi, madde notu ve fotoğraf paneli. */
function ChecklistRow({ item, photos, isEdit, photosOpen, onTogglePhotos, onStatus, onNote, onPhotosAdded, onPhotoRemoved, inspectionId }) {
  return (
    <div className="px-4 py-3.5" data-testid={`row-item-${item.key}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="min-w-0 text-sm font-medium text-slate-900 lg:w-1/3">{item.label}</p>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <StatusSegment itemKey={item.key} value={item.status} onChange={(s) => onStatus(item.key, s)} />
          <Button
            type="button"
            variant={photosOpen ? "secondary" : "ghost"}
            size="sm"
            disabled={!isEdit}
            title={isEdit ? undefined : "Fotoğrafları kaydettikten sonra ekleyebilirsiniz"}
            onClick={() => onTogglePhotos(item.key)}
            data-testid={`btn-toggle-photos-${item.key}`}
          >
            <Camera className="h-4 w-4" />
            {photos.length > 0 ? `Fotoğraf (${photos.length})` : "Fotoğraf"}
          </Button>
        </div>
      </div>
      <Input
        value={item.note}
        onChange={(e) => onNote(item.key, e.target.value)}
        placeholder="Madde notu (isteğe bağlı)"
        className="mt-2.5 h-9 text-sm"
        aria-label={`${item.label} notu`}
        data-testid={`input-note-${item.key}`}
      />
      {isEdit && photosOpen && (
        <div className="mt-3">
          <ItemPhotos
            inspectionId={inspectionId}
            itemKey={item.key}
            itemLabel={item.label}
            photos={photos}
            onAdded={onPhotosAdded}
            onRemoved={onPhotoRemoved}
          />
        </div>
      )}
    </div>
  );
}

export default function InspectionEdit() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportNo, setReportNo] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [motos, setMotos] = useState([]);
  const [photosOpen, setPhotosOpen] = useState({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        if (isEdit) {
          const { data } = await api.get(`/inspections/${id}`);
          if (!active) return;
          setReportNo(str(data.report_no));
          setForm(formFromDoc(data));
          setItems((data.items || []).map(itemFromDoc));
          setPhotos(data.photos || []);
          if (data.customer_id) {
            api
              .get(`/motorcycles?customer_id=${data.customer_id}`)
              .then((r) => active && setMotos(r.data))
              .catch(() => active && setMotos([]));
          }
        } else {
          const { data } = await api.get("/inspections/checklist-template");
          if (!active) return;
          setItems(data.map((t) => ({ key: t.key, label: t.label, group: t.group, status: null, note: "" })));
          setForm({ ...EMPTY_FORM, inspection_date: todayIso(), technician_name: user?.name || "" });
          setPhotos([]);
        }
      } catch {
        if (active) toast.error("Ekspertiz bilgileri yüklenemedi");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, isEdit, user?.name]);

  const groups = useMemo(() => groupItems(items), [items]);
  const counts = useMemo(
    () => ({
      good: items.filter((i) => i.status === "good").length,
      medium: items.filter((i) => i.status === "medium").length,
      service: items.filter((i) => i.status === "service").length,
      open: items.filter((i) => !i.status).length,
    }),
    [items]
  );

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const pickCustomer = async (c) => {
    setForm((f) => ({
      ...f,
      customer_id: c.id,
      motorcycle_id: "",
      owner_name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
      customer_phone: c.phone || "",
    }));
    setMotos([]);
    try {
      const { data } = await api.get(`/motorcycles?customer_id=${c.id}`);
      setMotos(data);
    } catch {
      setMotos([]);
    }
  };

  const unlinkCustomer = () => {
    setForm((f) => ({ ...f, customer_id: "", motorcycle_id: "" }));
    setMotos([]);
  };

  const pickMotorcycle = (value) => {
    if (value === "none") {
      setForm((f) => ({ ...f, motorcycle_id: "" }));
      return;
    }
    const m = motos.find((x) => x.id === value);
    if (!m) return;
    setForm((f) => ({
      ...f,
      motorcycle_id: m.id,
      plate: m.plate || f.plate,
      make_model: `${m.brand || ""} ${m.model || ""}`.trim() || f.make_model,
      year: m.year ? String(m.year) : f.year,
      km: m.km ? String(m.km) : f.km,
      chassis_no: m.vin || f.chassis_no,
    }));
  };

  const setStatus = (key, status) =>
    setItems((list) => list.map((it) => (it.key === key ? { ...it, status } : it)));
  const setNote = (key, note) => setItems((list) => list.map((it) => (it.key === key ? { ...it, note } : it)));
  const togglePhotos = (key) =>
    setPhotosOpen((s) => {
      const current = s[key] ?? photos.some((p) => p.item_key === key);
      return { ...s, [key]: !current };
    });

  const save = async () => {
    if (!form.plate.trim()) {
      toast.error("Plaka zorunludur");
      return;
    }
    if (form.customer_phone.trim() && !toWhatsAppNumber(form.customer_phone)) {
      toast.error("Telefon numarası geçersiz (örn. 0555 123 45 67)");
      return;
    }
    const payload = {
      customer_id: form.customer_id || null,
      motorcycle_id: form.motorcycle_id || null,
      owner_name: form.owner_name.trim(),
      customer_phone: form.customer_phone.trim(),
      plate: form.plate.trim(),
      make_model: form.make_model.trim(),
      year: form.year.trim(),
      km: form.km.trim(),
      chassis_no: form.chassis_no.trim(),
      inspection_date: form.inspection_date,
      technician_name: form.technician_name.trim(),
      receiver_name: form.receiver_name.trim(),
      notes: form.notes.trim(),
      items: items.map(({ key, label, group, status, note }) => ({
        key,
        label,
        group,
        status: status || null,
        note: (note || "").trim(),
      })),
    };
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/inspections/${id}`, payload);
        toast.success("Ekspertiz güncellendi");
        navigate(`/inspections/${id}`);
      } else {
        const { data } = await api.post("/inspections", payload);
        toast.success(`Ekspertiz kaydedildi · ${data.report_no}`);
        navigate(`/inspections/${data.id}/edit`, { replace: true });
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Ekspertiz kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const backTo = isEdit ? `/inspections/${id}` : "/inspections";
  const title = isEdit ? `Rapor ${reportNo}` : "Yeni ekspertiz raporu";

  if (loading) {
    return <p className="py-16 text-center text-sm text-slate-500">Yükleniyor…</p>;
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Ekspertiz"
        title={title}
        description={
          isEdit
            ? "Kontrol maddelerini güncelleyin, fotoğraf ekleyin ve kaydedin."
            : "Motosiklet bilgilerini girin, kontrol maddelerini işaretleyin ve raporu kaydedin. Fotoğraflar kayıttan sonra eklenir."
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to={backTo} data-testid="btn-inspection-cancel">Vazgeç</Link>
            </Button>
            <Button onClick={save} disabled={saving} data-testid="btn-inspection-save">
              <Save className="h-4 w-4" /> {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </>
        }
      />

      {/* Müşteri ve motosiklet sahibi */}
      <Card>
        <CardHeader>
          <CardTitle>Müşteri ve motosiklet sahibi</CardTitle>
          <CardDescription>Kayıtlı müşteri seçerseniz ad, telefon ve motosiklet bilgileri otomatik dolar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <CustomerPicker onPick={pickCustomer} />
            {form.customer_id && (
              <Button variant="ghost" size="sm" onClick={unlinkCustomer} data-testid="btn-unlink-customer">
                <X className="h-4 w-4" /> Müşteri bağlantısını kaldır
              </Button>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Araç sahibi" htmlFor="owner_name">
              <Input id="owner_name" value={form.owner_name} onChange={setField("owner_name")} placeholder="Ad Soyad" data-testid="input-owner-name" />
            </Field>
            <Field
              label="Müşteri telefonu"
              htmlFor="customer_phone"
              hint="Rapor bu numaraya WhatsApp ile gönderilir."
            >
              <Input
                id="customer_phone"
                inputMode="tel"
                value={form.customer_phone}
                onChange={setField("customer_phone")}
                placeholder="0555 123 45 67"
                className="font-mono tabular-nums"
                data-testid="input-customer-phone"
              />
            </Field>
            <Field label="Ekspertiz tarihi" htmlFor="inspection_date">
              <Input id="inspection_date" type="date" value={form.inspection_date} onChange={setField("inspection_date")} data-testid="input-inspection-date" />
            </Field>
            <Field label="Teknisyen" htmlFor="technician_name">
              <Input id="technician_name" value={form.technician_name} onChange={setField("technician_name")} placeholder="Ekspertizi yapan" data-testid="input-technician" />
            </Field>
            <Field label="Teslim alan" htmlFor="receiver_name" className="md:col-span-2">
              <Input id="receiver_name" value={form.receiver_name} onChange={setField("receiver_name")} placeholder="Aracı teslim alan kişi" data-testid="input-receiver" />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Motosiklet bilgileri */}
      <Card>
        <CardHeader>
          <CardTitle>Motosiklet bilgileri</CardTitle>
          <CardDescription>Motosiklet kaydı seçilirse plaka, marka-model, yıl, km ve şasi bilgisi kayıttan alınır.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(motos.length > 0 || form.motorcycle_id) && (
            <Field label="Motosiklet kaydı" htmlFor="motorcycle">
              <Select value={form.motorcycle_id || "none"} onValueChange={pickMotorcycle}>
                <SelectTrigger id="motorcycle" className="h-10 w-full md:w-96" data-testid="select-motorcycle">
                  <SelectValue placeholder="Motosiklet seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bağlantı yok</SelectItem>
                  {motos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.brand} {m.model} · {m.plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Plaka" htmlFor="plate">
              <Input
                id="plate"
                value={form.plate}
                onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value.toUpperCase() }))}
                placeholder="34 ABC 123"
                className="font-mono uppercase tabular-nums"
                data-testid="input-plate"
              />
            </Field>
            <Field label="Marka ve model" htmlFor="make_model">
              <Input id="make_model" value={form.make_model} onChange={setField("make_model")} placeholder="Yamaha MT-07" data-testid="input-make-model" />
            </Field>
            <Field label="Model yılı" htmlFor="year">
              <Input id="year" inputMode="numeric" value={form.year} onChange={setField("year")} placeholder="2021" className="tabular-nums" data-testid="input-year" />
            </Field>
            <Field label="Kilometre" htmlFor="km">
              <Input id="km" inputMode="numeric" value={form.km} onChange={setField("km")} placeholder="12450" className="tabular-nums" data-testid="input-km" />
            </Field>
            <Field label="Şasi no" htmlFor="chassis_no" className="md:col-span-2 lg:col-span-2">
              <Input
                id="chassis_no"
                value={form.chassis_no}
                onChange={(e) => setForm((f) => ({ ...f, chassis_no: e.target.value.toUpperCase() }))}
                placeholder="VIN / şasi numarası"
                className="font-mono uppercase"
                data-testid="input-chassis-no"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Kontrol listesi */}
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Kontrol listesi</CardTitle>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-600" data-testid="text-checklist-counts">
              {STATUS_OPTIONS.map((opt) => (
                <span key={opt.value} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", opt.dot)} aria-hidden="true" />
                  {opt.label} {counts[opt.value]}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <span className="h-2 w-2 rounded-full bg-slate-300" aria-hidden="true" />
                Bekleyen {counts.open}
              </span>
            </div>
          </div>
          <CardDescription>Her madde için durumu seçin. Fotoğraf ve not eklemek isteğe bağlıdır.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {groups.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">Kontrol listesi bulunamadı.</p>
          )}
          {groups.map(({ group, items: gItems }) => (
            <section key={group} className="space-y-2" aria-label={group}>
              <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{group}</h3>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {gItems.map((it) => {
                  const itemPhotos = photos.filter((p) => p.item_key === it.key);
                  const open = photosOpen[it.key] ?? itemPhotos.length > 0;
                  return (
                    <ChecklistRow
                      key={it.key}
                      item={it}
                      photos={itemPhotos}
                      isEdit={isEdit}
                      inspectionId={id}
                      photosOpen={open}
                      onTogglePhotos={togglePhotos}
                      onStatus={setStatus}
                      onNote={setNote}
                      onPhotosAdded={(list) => setPhotos((prev) => [...prev, ...list])}
                      onPhotoRemoved={(pid) => setPhotos((prev) => prev.filter((p) => p.id !== pid))}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>

      {/* Genel notlar */}
      <Card>
        <CardHeader>
          <CardTitle>Genel notlar</CardTitle>
          <CardDescription>Müşteriye iletilecek özet, dikkat edilmesi gereken noktalar veya ek açıklamalar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.notes}
            onChange={setField("notes")}
            rows={5}
            placeholder="Genel değerlendirme…"
            data-testid="textarea-notes"
          />
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" asChild>
          <Link to={backTo}>Vazgeç</Link>
        </Button>
        <Button onClick={save} disabled={saving} data-testid="btn-inspection-save-bottom">
          <Save className="h-4 w-4" /> {saving ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </div>
  );
}
