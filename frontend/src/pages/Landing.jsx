import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, Bike, Check, FileText, RefreshCw, Search, ShieldCheck, Wrench } from "lucide-react";
import api, { fmtDateShort, fmtMoney } from "../lib/api";
import { Button, buttonVariants } from "../components/ui/button";
import { Input } from "../components/ui/input";
import EmptyState from "../components/EmptyState";
import { cn } from "../lib/utils";

const HIGHLIGHTS = [
  { icon: Wrench, title: "Servis emri takibi", text: "Arıza tespitinden teslime kadar her aşamayı izleyin." },
  { icon: ShieldCheck, title: "Dijital onay", text: "Müşteri onayını bağlantı üzerinden, kağıt kullanmadan alın." },
  { icon: FileText, title: "Teklif ve muayene", text: "Fiyat teklifleri ve muayene formları tek yerde." },
];

const FLOAT_CSS = `
@keyframes emt-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
.emt-float { animation: emt-float 6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .emt-float { animation: none; }
}
`;

/** CSS 3D sahne: eğik katmanlı, derinlikli kartlar (kütüphane yok). */
function HeroStage() {
  const card = "absolute left-1/2 top-1/2 h-44 w-56 rounded-2xl p-5 sm:h-48 sm:w-64";
  return (
    <div aria-hidden="true" className="relative mx-auto h-72 w-full max-w-md sm:h-96" style={{ perspective: "1100px" }}>
      <div className="absolute inset-0" style={{ transform: "rotateX(14deg) rotateY(-18deg)", transformStyle: "preserve-3d" }}>
        <div className="emt-float absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
          {/* Arka kart: karanlık, bildirim */}
          <div
            className={cn(card, "bg-gradient-to-br from-slate-700 to-slate-900 shadow-2xl ring-1 ring-white/10")}
            style={{ transform: "translate(-50%, -50%) translate3d(-70px, -70px, -120px)" }}
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Hatırlatma</p>
            <p className="mt-2 font-heading text-base font-semibold text-white">Periyodik bakım zamanı</p>
            <div className="mt-8 h-2 rounded-full bg-white/10">
              <div className="h-2 w-2/3 rounded-full bg-brand-400" />
            </div>
          </div>

          {/* Orta kart: beyaz, grafik */}
          <div
            className={cn(card, "border border-slate-200 bg-white shadow-2xl")}
            style={{ transform: "translate(-50%, -50%) translate3d(0px, 10px, -30px)" }}
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Bu hafta</p>
            <p className="mt-2 font-heading text-base font-semibold text-slate-900">Servis yoğunluğu</p>
            <div className="mt-6 flex h-20 items-end gap-2">
              {[40, 65, 50, 85, 60, 95, 75].map((h, i) => (
                <div
                  key={i}
                  className={cn("flex-1 rounded-t-md", i === 5 ? "bg-brand-500" : "bg-slate-200")}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* Ön kart: marka rengi, servis emri */}
          <div
            className={cn(card, "bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-2xl shadow-brand-600/40")}
            style={{ transform: "translate(-50%, -50%) translate3d(70px, 80px, 70px)" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/80">Servis emri</p>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium">Tamirde</span>
            </div>
            <p className="mt-2 font-heading text-2xl font-bold tracking-tight">#1042</p>
            <p className="text-sm text-white/85">Motosiklet kaydı açık</p>
            <div className="mt-6 flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < 3 ? "bg-white" : "bg-white/35")} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
      <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {description && <p className="mt-3 text-base text-slate-500">{description}</p>}
    </div>
  );
}

function LoadError({ onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-6 py-10 text-center">
      <AlertCircle className="h-8 w-8 text-amber-500" />
      <p className="font-heading text-base font-semibold text-slate-900">Fiyat bilgileri şu anda yüklenemedi</p>
      <p className="max-w-sm text-sm text-slate-600">Bağlantınızı kontrol edip tekrar deneyebilirsiniz.</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
        <RefreshCw /> Tekrar dene
      </Button>
    </div>
  );
}

function PackageCard({ pkg }) {
  const features = Array.isArray(pkg.features) ? pkg.features.filter(Boolean) : [];
  const highlight = Boolean(pkg.highlight);
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-6 transition duration-300",
        highlight
          ? "border-brand-500 bg-gradient-to-b from-white to-brand-50/70 shadow-xl shadow-brand-500/15 ring-2 ring-brand-500/30 md:-translate-y-3"
          : "border-slate-200/80 bg-white shadow-sm shadow-slate-900/5 hover:-translate-y-1 hover:shadow-lg"
      )}
    >
      {highlight && (
        <span className="absolute -top-3 left-6 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white shadow-md shadow-brand-500/30">
          En popüler
        </span>
      )}
      <h3 className="font-heading text-lg font-semibold text-slate-900">{pkg.name}</h3>
      <div className="mt-4">
        <p className="font-heading text-4xl font-bold tracking-tight text-slate-900">{fmtMoney(pkg.price)}</p>
        {pkg.unit && <p className="mt-1 text-sm text-slate-500">{pkg.unit}</p>}
      </div>
      {features.length > 0 && (
        <ul className="mt-6 space-y-3 border-t border-slate-100 pt-6">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span className="min-w-0 break-words">{f}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Landing() {
  const [pricing, setPricing] = useState({ packages: [], items: [], updated_at: null });
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [query, setQuery] = useState("");

  const loadPricing = useCallback(async () => {
    setStatus("loading");
    try {
      const { data } = await api.get("/public/pricing");
      setPricing({
        packages: Array.isArray(data?.packages) ? data.packages : [],
        items: Array.isArray(data?.items) ? data.items : [],
        updated_at: data?.updated_at || null,
      });
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    loadPricing();
  }, [loadPricing]);

  const needle = query.trim().toLocaleLowerCase("tr-TR");
  const visibleItems = useMemo(() => {
    if (!needle) return pricing.items;
    return pricing.items.filter((it) =>
      `${it.name || ""} ${it.description || ""}`.toLocaleLowerCase("tr-TR").includes(needle)
    );
  }, [pricing.items, needle]);

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <style>{FLOAT_CSS}</style>

      {/* Üst bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-500/30">
              <Bike className="h-5 w-5 text-white" />
            </span>
            <span className="truncate font-heading text-base font-bold tracking-tight">E-Moto Tamir</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-6">
            <a href="#paketler" className="hidden text-sm text-slate-300 transition hover:text-white sm:inline">
              Paketler
            </a>
            <a href="#fiyatlar" className="hidden text-sm text-slate-300 transition hover:text-white sm:inline">
              Fiyat Listesi
            </a>
            <Button asChild size="sm">
              <Link to="/login">Giriş Yap</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-2 lg:gap-8 lg:pb-28 lg:pt-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              Yetkili servis yönetim sistemi
            </span>
            <h1 className="mt-5 font-heading text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Motosiklet servisinizi{" "}
              <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">her detayıyla</span>{" "}
              yönetin
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Müşteri ve motosiklet kayıtları, servis emirleri, teklifler, muayene formları, ödemeler ve hatırlatmalar
              tek panelde. Sahada ve ofiste aynı anda.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to="/login">
                  Giriş Yap <ArrowRight />
                </Link>
              </Button>
              <a
                href="#fiyatlar"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white sm:w-auto"
                )}
              >
                Fiyat Listesi
              </a>
            </div>

            <ul className="mt-12 grid gap-4 sm:grid-cols-3">
              {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{text}</p>
                </li>
              ))}
            </ul>
          </div>

          <HeroStage />
        </div>
      </section>

      {/* Paketler */}
      <section id="paketler" className="scroll-mt-24 mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading
          eyebrow="Paketler"
          title="İhtiyacınıza uygun paket"
          description="Servisinizin büyüklüğüne göre hazır paketlerden birini seçin."
        />
        <div className="mt-12">
          {status === "loading" && (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              ))}
            </div>
          )}
          {status === "error" && <LoadError onRetry={loadPricing} />}
          {status === "ready" && pricing.packages.length === 0 && (
            <EmptyState icon={FileText} title="Paket bilgisi henüz eklenmedi" description="Lütfen daha sonra tekrar kontrol edin." />
          )}
          {status === "ready" && pricing.packages.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {pricing.packages.map((pkg, i) => (
                <PackageCard key={pkg.id ?? `${pkg.name}-${i}`} pkg={pkg} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Fiyat listesi */}
      <section id="fiyatlar" className="scroll-mt-24 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHeading
            eyebrow="Fiyat Listesi"
            title="Hizmet ve parça fiyatları"
            description="Aradığınız kalemi adıyla ya da açıklamasıyla hızlıca bulun."
          />

          <div className="mt-12">
            {status === "loading" && (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            )}

            {status === "error" && <LoadError onRetry={loadPricing} />}

            {status === "ready" && pricing.items.length === 0 && (
              <EmptyState icon={FileText} title="Fiyat listesi henüz eklenmedi" description="Lütfen daha sonra tekrar kontrol edin." />
            )}

            {status === "ready" && pricing.items.length > 0 && (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Kalem adı veya açıklama ara…"
                    aria-label="Fiyat listesinde ara"
                    className="h-11 rounded-xl pl-9"
                  />
                </div>

                {visibleItems.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50">
                    <EmptyState icon={Search} title="Sonuç bulunamadı" description={`"${query.trim()}" ile eşleşen kalem yok.`} />
                  </div>
                ) : (
                  <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    {visibleItems.map((it, i) => (
                      <li key={`${it.name}-${i}`} className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6">
                        <div className="min-w-0">
                          <p className="break-words font-medium text-slate-900">{it.name}</p>
                          {it.description && <p className="mt-0.5 break-words text-sm text-slate-500">{it.description}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="whitespace-nowrap font-semibold tabular-nums text-slate-900">{fmtMoney(it.price)}</p>
                          {it.unit && <p className="text-xs text-slate-500">{it.unit}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    {visibleItems.length} / {pricing.items.length} kalem gösteriliyor
                  </span>
                  {pricing.updated_at && <span>Son güncelleme: {fmtDateShort(pricing.updated_at)}</span>}
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-950 text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm sm:flex-row sm:px-6">
          <span>
            © E-Moto Tamir · {year}
          </span>
          <Link to="/login" className="font-medium text-slate-200 transition hover:text-brand-300">
            Giriş Yap
          </Link>
        </div>
      </footer>
    </div>
  );
}
