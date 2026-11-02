import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bike, Building2, Check, ClipboardList, FileText, MessageCircle, Phone, ShieldCheck, Users,
  BellRing, BarChart3, Wrench, Search, Truck, ChevronDown,
} from "lucide-react";
import api from "../lib/api";
import { cn } from "../lib/utils";
import Tilt3D from "../components/Tilt3D";
import HoloMotorcycle from "../components/HoloMotorcycle";

const ICONS = { ClipboardList, Bike, Users, BellRing, FileText, BarChart3, Building2, ShieldCheck, Wrench };

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
    { icon: "Bike", title: "Mürettebat Kartı", text: "Marka, model, plaka, KM, arıza haritaları, servis geçmişi hepsi bir arada." },
    { icon: "Users", title: "Müşteri Cari", text: "VIP/Borçlu/Sorunlu etiketleri, notlar, tahsilat ve bakiye takibi." },
    { icon: "BellRing", title: "Otomatik Hatırlatma", text: "Her sabah saat 09:00'da vadesi dolan bakımları WhatsApp bağlantısıyla." },
    { icon: "FileText", title: "Fiyat Teklifi", text: "Müşteri linki onaylansın, teklifler otomatik iş emrine dönüşsün." },
    { icon: "BarChart3", title: "Tahsilat ve Rapor", text: "Ciro, alacak, borçlu servis raporları — anlık kontrol paneli." },
    { icon: "Building2", title: "Çok Firmalı SaaS", text: "Süper Admin panelinden tema, PDF şablonu, içerik yönetimi." },
    { icon: "ShieldCheck", title: "Denetim ve Silme", text: "Kim ne zaman değiştirilmez + 30 gün çöp kutusu geri yükleme." },
  ],
  pricing_heading: { eyebrow: "FİYATLANDIRMA", title: "Servisiniz için uygun planı seçin.", description: "14 gün ücretsiz deneme, iptal etmeniz kolay — kredi kartı gerektirmez." },
  plans: [
    { id: "deneme", name: "Deneme", price_text: "Ücretsiz", period: "14 gün", highlight: false, features: ["Tüm özellikler", "1 kullanıcı", "50 kayıt"] },
    { id: "temel", name: "Temel", price_text: "₺ 2.499", period: "/ ay", highlight: false, features: ["3 kullanıcı", "Sınırsız müşteri/motosiklet", "PDF + WhatsApp", "Kontrol Paneli"] },
    { id: "profesyonel", name: "Profesyonel", price_text: "₺ 3.999", period: "/ ay", highlight: true, features: ["10 kullanıcı", "Fiyat Teklifi + Onay bağlantısı", "Cronotou", "Öncelikli destek"] },
    { id: "kurumsal", name: "Kurumsal", price_text: "Teklif", period: "/ yıllık", highlight: false, features: ["Sınırsız kullanıcı", "Çoklu firma", "SLA + eğitim", "API'ler"] },
  ],
  cta: { title: "Servisinizi bugün dijitalleştirin.", text: "14 gün ücretsiz deneme + kurulum ve eğitim sizin için biz yapıyoruz." },
};

const waLink = (wa, text) =>
  wa ? `https://wa.me/${wa}?text=${encodeURIComponent(text)}` : "/login";

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && (
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
          <span aria-hidden="true" className="h-px w-6 bg-cyan-300/70" />{eyebrow}<span aria-hidden="true" className="h-px w-6 bg-cyan-300/70" />
        </p>
      )}
      <h2 className="font-heading mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-slate-400">{description}</p>}
    </div>
  );
}

const WORKFLOW = [
  { icon: ClipboardList, title: "Kabul", text: "Motosiklet, plaka ve müşteri kaydı açılır." },
  { icon: Search, title: "Arıza Tespiti", text: "Arıza bölgeleri ve kontrol listesi işaretlenir." },
  { icon: FileText, title: "Fiyat Teklifi", text: "Parça ve işçilik teklifi KDV dahil ya da hariç hazırlanır." },
  { icon: ShieldCheck, title: "Onay", text: "Müşteri teklifi WhatsApp bağlantısından onaylar." },
  { icon: Wrench, title: "Tamir", text: "İş emri ilerler, parça ve işçilik kayda geçer." },
  { icon: Truck, title: "Teslimat", text: "Tahsilat alınır, bakım hatırlatması otomatik planlanır." },
];

function WorkflowSection() {
  return (
    <section id="workflow" className="scroll-mt-20 border-t border-white/10 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="İŞ AKIŞI" title="Bir motosiklet, altı adımda." description="Atölyenizdeki her servis aynı akışla izlenir; hiçbir aşama kaybolmaz." />
        <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {WORKFLOW.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="relative">
                <Tilt3D max={6} lift={5} className="emt-glass-dark h-full rounded-2xl p-5">
                  <span className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300/20 to-cyan-500/10 text-cyan-200 ring-1 ring-cyan-300/30">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-heading text-xs font-semibold text-slate-500">0{i + 1}</span>
                  </span>
                  <h3 className="font-heading mt-4 text-sm font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{step.text}</p>
                </Tilt3D>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

const FAQ = [
  { q: "Deneme süresi ne kadar ve kredi kartı gerekiyor mu?", a: "14 gün ücretsiz deneme sunuyoruz. Kredi kartı gerekmez." },
  { q: "Müşteriler fiyat teklifini nasıl onaylar?", a: "Teklif, müşterinize bir bağlantı olarak gönderilir. Müşteri bağlantıdan onaylar ya da reddeder; karar kayda geçer." },
  { q: "KDV hesabı nasıl yapılıyor?", a: "Her kalem için KDV dahil ya da hariç seçimi yapılır. Oran değişirse toplu KDV güncellemesi tek adımda uygulanır." },
  { q: "Verilerim diğer firmalarla karışır mı?", a: "Hayır. Her firmanın verisi ayrı tutulur. Önemli işlemler denetim kaydında izlenir ve silinen kayıtlar 30 gün çöp kutusunda kalır." },
  { q: "Kurulum ve eğitim var mı?", a: "Evet. Kurulum ve kullanım eğitimini ekibimiz sizin için yapar." },
];

function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading eyebrow="SSS" title="Merak edilenler" />
        <div className="mt-12 space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="emt-glass-dark group rounded-xl px-5 py-4 open:border-cyan-300/30">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-semibold text-white">
                {item.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-cyan-300 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ f }) {
  const Icon = ICONS[f.icon] || Wrench;
  return (
    <Tilt3D max={8} lift={6} className="emt-glass-dark group h-full rounded-2xl p-6 transition-shadow duration-300 hover:shadow-[0_0_40px_-10px_rgba(34,211,238,0.45)]">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-600/30">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="font-heading mt-5 text-base font-semibold text-white">{f.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.text}</p>
    </Tilt3D>
  );
}

function PlanCard({ plan, wa }) {
  const hl = plan.highlight;
  return (
    <Tilt3D max={6} lift={6} className={cn("relative h-full", hl && "lg:-mt-4 lg:mb-4")}>
      <div className={cn(
        "flex h-full flex-col rounded-2xl p-6",
        hl ? "emt-holo !overflow-visible border-cyan-300/50" : "emt-glass-dark",
      )}>
        {hl && (
          <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-orange-600/40">
            En popüler
          </span>
        )}
        <p className="text-sm font-semibold text-slate-300">{plan.name}</p>
        <p className="mt-3 flex items-baseline gap-1.5">
          <span className="font-heading text-3xl font-bold tracking-tight text-white">{plan.price_text}</span>
          {plan.period && <span className="text-xs text-slate-400">{plan.period}</span>}
        </p>
        <ul className="mt-6 flex-1 space-y-2.5">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <a
          href={waLink(wa, `Merhaba, ${plan.name} planı hakkında bilgi almak istiyorum.`)}
          target="_blank" rel="noreferrer"
          className={cn(
            "mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all duration-200",
            hl
              ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-600/30 hover:brightness-110"
              : "border border-white/15 bg-white/5 text-white hover:border-cyan-300/50 hover:bg-white/10",
          )}
        >
          İletişime Geç <span aria-hidden>›</span>
        </a>
      </div>
    </Tilt3D>
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

  if (!c) return <div className="emt-night flex min-h-screen items-center justify-center text-slate-400">Yükleniyor…</div>;

  const wa = c.whatsapp;
  const demo = waLink(wa, "Merhaba, E-Moto Tamir demo talep ediyorum.");
  const year = new Date().getFullYear();

  return (
    <div className="emt-night min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05070c]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-600/30">
              <Wrench className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="font-heading block text-sm font-bold leading-tight text-white">E-MOTO TAMİR</span>
              <span className="block truncate text-[10px] uppercase tracking-[0.18em] text-slate-400">Servis yönetim sistemi</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-4">
            <a href="#features" className="hidden rounded-md px-2 py-1.5 text-slate-300 hover:text-white sm:inline">Özellikler</a>
            <a href="#workflow" className="hidden rounded-md px-2 py-1.5 text-slate-300 hover:text-white lg:inline">İş akışı</a>
            <a href="#pricing" className="hidden rounded-md px-2 py-1.5 text-slate-300 hover:text-white sm:inline">Fiyat</a>
            <a href={demo} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-slate-300 hover:text-white md:inline-flex">
              <MessageCircle className="h-4 w-4" /> İletişim
            </a>
            <Link to="/login" className="rounded-lg border border-white/15 bg-white/5 px-3.5 py-1.5 font-medium text-white transition-colors hover:border-cyan-300/50 hover:bg-white/10">
              Giriş Yap
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:py-24">
          <div>
            {c.hero.badge && (
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-200">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
                {c.hero.badge}
              </span>
            )}
            <h1 className="font-heading mt-6 text-4xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-6xl">
              {c.hero.title}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">{c.hero.description}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href={demo} target="_blank" rel="noreferrer"
                 className="inline-flex h-12 items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-6 text-sm font-semibold text-white shadow-lg shadow-orange-600/35 transition-all hover:brightness-110">
                <MessageCircle className="h-4 w-4" /> WhatsApp ile Demo İste
              </a>
              <Link to="/login" className="inline-flex h-12 items-center rounded-lg border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white transition-colors hover:border-cyan-300/50 hover:bg-white/10">
                Zaten Hesabım Var
              </Link>
            </div>
            {c.phone && (
              <p className="mt-7 flex items-center gap-2 text-sm text-slate-400">
                <Phone className="h-4 w-4 text-cyan-300" /> {c.phone}
              </p>
            )}
          </div>
          <HoloMotorcycle />
        </div>
      </section>

      <section id="features" className="scroll-mt-20 border-t border-white/10 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading {...c.features_heading} />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {c.features.map((f) => <FeatureCard key={f.title} f={f} />)}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="emt-glass-dark relative overflow-hidden rounded-3xl">
            <img
              src="/visuals/moto-systems.jpg"
              alt="Motosiklet sistemleri: motor, şasi, fren, şanzıman ve elektrik bölgeleri"
              width="1179"
              height="468"
              decoding="async"
              className="block h-auto w-full object-cover"
            />
            <div className="px-6 pb-8 sm:px-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">EKSPERTİZ VE ARIZA BÖLGELERİ</p>
              <p className="font-heading mt-2 max-w-xl text-xl font-bold text-white sm:text-3xl">Her arıza bölgesi, kayıtlı motosikletin üzerinde işaretlenir.</p>
            </div>
          </div>
        </div>
      </section>

      <WorkflowSection />

      <section id="pricing" className="scroll-mt-20 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading {...c.pricing_heading} />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {c.plans.map((p) => <PlanCard key={p.id} plan={p} wa={wa} />)}
          </div>
        </div>
      </section>

      <FaqSection />

      <section className="relative overflow-hidden py-24">
        <div className="emt-glass-dark relative mx-auto max-w-3xl rounded-3xl px-6 py-14 text-center sm:px-12">
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[80%] -translate-x-1/2 rounded-full bg-orange-500/30 blur-3xl" />
          <h2 className="font-heading relative text-3xl font-bold tracking-tight text-white sm:text-4xl">{c.cta.title}</h2>
          <p className="relative mt-4 text-slate-300">{c.cta.text}</p>
          <a href={demo} target="_blank" rel="noreferrer"
             className="relative mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-7 text-sm font-semibold text-white shadow-lg shadow-orange-600/35 transition-all hover:brightness-110">
            <MessageCircle className="h-4 w-4" /> WhatsApp ile Demo İste
          </a>
          {c.phone && <p className="relative mt-6 text-xs tracking-wider text-slate-400">{c.phone}</p>}
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>©{year} E-Moto Tamir · Tüm hakları saklıdır.</p>
          <div className="flex gap-5">
            <a href={demo} target="_blank" rel="noreferrer" className="hover:text-white">İletişim</a>
            <Link to="/login" className="hover:text-white">Giriş Yap</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
