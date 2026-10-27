import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2, Check, ClipboardList, FileText, MessageCircle, Phone, ShieldCheck, Users,
  BellRing, BarChart3, Wrench,
} from "lucide-react";
import api from "../lib/api";
import { MotorcycleSvg } from "../components/DashboardHero";
import MotoMark from "../components/MotoMark";
import { cn } from "../lib/utils";

const ICONS = { ClipboardList, Bike: MotoMark, Users, BellRing, FileText, BarChart3, Building2, ShieldCheck, Wrench };

// Sunucuya ulaşılamazsa gösterilen yedek içerik (sunucudaki varsayılanla aynı).
const FALLBACK = {
  phone: "+44 7378 552959",
  whatsapp: "447378552959",
  hero: {
    badge: "MOTOSİKLET SERVİSLERİ İÇİN",
    title: "Servisinin dijital akıl defteri.",
    description: "Müşteri, motosiklet, iş emri, parça, tahsilat, cari hesap ve otomatik hatırlatmalar tek ekranda. Kağıtsız, hızlı, denetlenebilir.",
  },
  features_heading: { eyebrow: "NELER YAPABİLİRSİNİZ?", title: "Servisin tamamı, tek yerde.", description: "Her modülü gerçek servis ihtiyacına göre — kağıt formlarınızı ve WhatsApp mesajlarınızı akıllı hale getirerek seçebilirsiniz." },
  features: [
    { icon: "ClipboardList", title: "İş Emri ve Kabul Formu", text: "Kabul-Teslim PDF, imzalı, tek tıklamayla WhatsApp'tan oluşur." },
    { icon: "Bike", title: "Motosiklet Kartı", text: "Motosiklet tipi, marka, model, plaka, KM, arıza haritaları ve servis geçmişi bir arada." },
    { icon: "Users", title: "Müşteri Cari", text: "VIP/Borçlu/Sorunlu etiketleri, notlar, tahsilat ve bakiye takibi." },
    { icon: "BellRing", title: "Otomatik Hatırlatma", text: "Her sabah saat 09:00'da vadesi dolan bakımları WhatsApp bağlantısıyla." },
    { icon: "FileText", title: "Fiyat Teklifi", text: "Müşteri linki onaylansın, teklifler otomatik iş emrine dönüşsün." },
    { icon: "BarChart3", title: "Tahsilat ve Rapor", text: "Ciro, alacak, borçlu servis raporları — anlık kontrol paneli." },
    { icon: "Building2", title: "Çok Firmalı SaaS", text: "Süper Admin panelinden tema, PDF şablonu, içerik yönetimi." },
    { icon: "ShieldCheck", title: "Denetim ve Silme", text: "Değişiklik geçmişi ve 30 günlük çöp kutusundan geri yükleme." },
  ],
  pricing_heading: { eyebrow: "FİYATLANDIRMA", title: "Servisiniz için uygun planı seçin.", description: "14 gün ücretsiz deneme, iptal etmeniz kolay — kredi kartı gerektirmez." },
  plans: [
    { id: "deneme", name: "Deneme", price_text: "Ücretsiz", period: "14 gün", highlight: false, features: ["Tüm özellikler", "1 kullanıcı", "50 kayıt"] },
    { id: "temel", name: "Temel", price_text: "₺ 2.499", period: "/ ay", highlight: false, features: ["3 kullanıcı", "Sınırsız müşteri/motosiklet", "PDF + WhatsApp", "Kontrol Paneli"] },
    { id: "profesyonel", name: "Profesyonel", price_text: "₺ 3.999", period: "/ ay", highlight: true, features: ["10 kullanıcı", "Fiyat Teklifi + Onay bağlantısı", "Otomatik bakım hatırlatmaları", "Öncelikli destek"] },
    { id: "kurumsal", name: "Kurumsal", price_text: "Teklif", period: "/ yıllık", highlight: false, features: ["Sınırsız kullanıcı", "Çoklu firma", "SLA + eğitim", "API'ler"] },
  ],
  cta: { title: "Servisinizi bugün dijitalleştirin.", text: "14 gün ücretsiz deneme + kurulum ve eğitim sizin için biz yapıyoruz." },
};

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

const waLink = (wa, text) =>
  wa ? `https://wa.me/${wa}?text=${encodeURIComponent(text)}` : "/login";

/** Fareyle 3D eğilen kart. Azaltılmış hareket tercihinde devre dışı. */
function Tilt({ children, className = "" }) {
  const ref = useRef(null);
  const onMove = (e) => {
    if (!ref.current || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `perspective(900px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg) translateY(-4px)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = ""; };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
         className={cn("transition-transform duration-300 will-change-transform", className)}>
      {children}
    </div>
  );
}

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
      <div className="pointer-events-none absolute -bottom-3 -left-2 z-10 h-32 w-48 drop-shadow-[0_18px_22px_rgba(15,23,42,0.25)] sm:-left-5 sm:h-40 sm:w-60">
        <MotorcycleSvg />
      </div>
    </div>
  );
}


function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>}
      <h2 className="font-heading mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base text-slate-500">{description}</p>}
    </div>
  );
}

function PlanCard({ plan, wa }) {
  const hl = plan.highlight;
  return (
    <Tilt className={cn("relative h-full", hl && "lg:-mt-4 lg:mb-4")}>
      <div className={cn(
        "flex h-full flex-col rounded-2xl border p-6 shadow-card",
        hl ? "border-brand-400 bg-gradient-to-b from-brand-50 to-white ring-2 ring-brand-400/40" : "border-slate-200 bg-white",
      )}>
        {hl && (
          <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow">
            En popüler
          </span>
        )}
        <p className="text-sm font-semibold text-slate-700">{plan.name}</p>
        <p className="mt-3 flex items-baseline gap-1.5">
          <span className="font-heading text-3xl font-bold tracking-tight text-slate-900">{plan.price_text}</span>
          {plan.period && <span className="text-xs text-slate-500">{plan.period}</span>}
        </p>
        <ul className="mt-6 flex-1 space-y-2.5">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <a
          href={waLink(wa, `Merhaba, ${plan.name} planı hakkında bilgi almak istiyorum.`)}
          target="_blank" rel="noreferrer"
          className={cn(
            "mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors",
            hl ? "bg-brand-600 text-white hover:bg-brand-700" : "bg-slate-900 text-white hover:bg-slate-800",
          )}
        >
          İletişime Geç <span aria-hidden>›</span>
        </a>
      </div>
    </Tilt>
  );
}

export default function Landing() {
  const [c, setC] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get("/public/landing")
      .then(({ data }) => { if (!cancelled) setC(data); })
      .catch(() => { if (!cancelled) setC(FALLBACK); });
    return () => { cancelled = true; };
  }, []);

  if (!c) return <div className="min-h-screen flex items-center justify-center text-slate-500">Yükleniyor…</div>;

  const wa = c.whatsapp;
  const demo = waLink(wa, "Merhaba, E-Moto Tamir demo talep ediyorum.");
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <style>{FLOAT_CSS}</style>

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Wrench className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="font-heading block text-sm font-bold leading-tight">E-MOTO TAMİR</span>
              <span className="block truncate text-[10px] uppercase tracking-wider text-slate-500">Motosiklet servis yönetimi</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-4">
            <a href="#features" className="hidden rounded-md px-2 py-1.5 text-slate-600 hover:text-slate-900 sm:inline">Özellikler</a>
            <a href="#pricing" className="hidden rounded-md px-2 py-1.5 text-slate-600 hover:text-slate-900 sm:inline">Fiyat</a>
            <a href={demo} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-slate-600 hover:text-slate-900 md:inline-flex">
              <MessageCircle className="h-4 w-4" /> İletişim
            </a>
            <Link to="/login" className="rounded-lg border border-slate-300 px-3.5 py-1.5 font-medium text-slate-800 hover:bg-slate-50">
              Giriş Yap
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            {c.hero.badge && (
              <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700">
                {c.hero.badge}
              </span>
            )}
            <h1 className="font-heading mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl">
              {c.hero.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">{c.hero.description}</p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
              <MotoMark className="h-4 w-4" /> Yalnızca motosiklet, scooter ve iki tekerlekli servisler için
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={demo} target="_blank" rel="noreferrer"
                 className="inline-flex h-12 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700">
                <MessageCircle className="h-4 w-4" /> WhatsApp ile Demo İste
              </a>
              <Link to="/login" className="inline-flex h-12 items-center rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Zaten Hesabım Var
              </Link>
            </div>
            {c.phone && (
              <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
                <Phone className="h-4 w-4" /> {c.phone}
              </p>
            )}
          </div>
          <HeroStage />
        </div>
      </section>

      <section id="features" className="scroll-mt-20 border-t border-slate-200 bg-slate-50/70 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading {...c.features_heading} />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {c.features.map((f) => {
              const Icon = ICONS[f.icon] || Wrench;
              return (
                <Tilt key={f.title} className="h-full">
                  <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-heading mt-5 text-base font-semibold text-slate-900">{f.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.text}</p>
                  </div>
                </Tilt>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading {...c.pricing_heading} />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {c.plans.map((p) => <PlanCard key={p.id} plan={p} wa={wa} />)}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-slate-900 py-20 text-center">
        <div className="absolute inset-0 opacity-40" aria-hidden="true"
             style={{ background: "radial-gradient(circle at 50% 0%, rgba(249,115,22,0.35), transparent 60%)" }} />
        <div className="relative mx-auto max-w-2xl px-4">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">{c.cta.title}</h2>
          <p className="mt-4 text-slate-300">{c.cta.text}</p>
          <a href={demo} target="_blank" rel="noreferrer"
             className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-500">
            <MessageCircle className="h-4 w-4" /> WhatsApp ile Demo İste
          </a>
          {c.phone && <p className="mt-6 text-xs tracking-wider text-slate-400">{c.phone}</p>}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>©{year} E-Moto Tamir · Tüm hakları saklıdır.</p>
          <div className="flex gap-5">
            <a href={demo} target="_blank" rel="noreferrer" className="hover:text-slate-900">İletişim</a>
            <Link to="/login" className="hover:text-slate-900">Giriş Yap</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
