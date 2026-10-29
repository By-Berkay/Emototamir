# Yeniden Tasarım — Aşama 1 Denetim Raporu

Dal: `design/motorcycle-ai-3d-redesign` (main @ `6f7c568` üzerinden açıldı)
Kapsam: yalnızca inceleme. Bu aşamada UI/iş mantığı değişmedi.

## 1. Yığın (gerçek kaynak: `frontend/package.json`)

- React 19, react-router-dom 7, CRA + CRACO, Tailwind (`darkMode: ["class"]`)
- Radix/shadcn tarzı tam `components/ui` seti (dialog, sheet, drawer, select, table, tabs, skeleton, toast, vb.)
- Animasyon: `framer-motion` 11.18. Grafik: `recharts`. Veri: axios (`lib/api.js`), `@tanstack/react-query` ve `swr` paketleri listede ama kullanım kontrol edilmeli.
- **3D kütüphanesi yok** (`three`, `@react-three/*`, lottie yok).
- Backend: FastAPI + MongoDB (`backend/server.py`), GridFS dosyalar, pillow-heif.

## 2. Mevcut 3D / görsel altyapı

- `components/Tilt3D.jsx`, `StatCard.jsx`: CSS perspektif kartları.
- `components/DashboardHero.jsx`, `HoloMotorcycle.jsx`: mevcut hologram hero (CSS/SVG tabanlı).
- `components/MotorcycleIllustration.jsx`, `FaultDiagram.jsx`: SVG motosiklet ve arıza bölgeleri. Kullanıldığı yerler: `MotorcycleDetail`, `Motorcycles`, `ServiceOrderCreate`, `ServiceOrderEdit`.
- `frontend/public/visuals/moto-hud.jpg`, `moto-systems.jpg`: statik poster/fallback olarak kullanılıyor.

**Karar (3D stratejisi):** Yeni WebGL/three.js bağımlılığı eklenmeyecek. Gerekçe: lisanslı 3D motosiklet modeli yok, brifte "uydurma model kullanma" yasağı var, mevcut CSS/SVG hologram yapısı genişletilebilir. Hero ve ikon ögeleri 2.5D SVG + CSS perspektif + `framer-motion` ile yapılacak; `prefers-reduced-motion` ve düşük performans için statik poster fallback. Three.js gerekirse ayrı bir karar olarak sonra değerlendirilir.

## 3. Route → sayfa → API envanteri

Kaynak: `frontend/src/App.js`. API sayısı, sayfa başına `api.*` çağrısı sayısıdır (yaklaşık, sayfa içindeki çağrı satırları).

| Route | Sayfa | API çağrısı | Not |
|---|---|---|---|
| `/` | RootGate → Landing (misafir) / dashboard'a yönlendirme | — | |
| `/landing` | Landing | 1 | |
| `/login` | Login | 0 | AuthContext üzerinden |
| `/onay/:token` | PublicApproval | 0 | Doğrudan `api.` yok; yöntem kontrol edilecek |
| `/q/:token` | QuotePublic | 0 | Aynı; token akışı korunacak |
| `/dashboard` | Dashboard (super_admin → /admin/tenants) | 3 | |
| `/customers` | Customers | 7 | |
| `/customers/:id` | CustomerDetail | 4 | |
| `/motorcycles` | Motorcycles | 6 | SVG kullanıyor |
| `/motorcycles/:id` | MotorcycleDetail | 1 | SVG kullanıyor |
| `/service-orders` | ServiceOrders | 1 | |
| `/service-orders/new` | ServiceOrderCreate | 10 | SVG kullanıyor |
| `/service-orders/:id` | ServiceOrderDetail | 6 | |
| `/service-orders/:id/edit` | ServiceOrderEdit | 5 | SVG kullanıyor |
| `/quotes` | Quotes | 4 | |
| `/quotes/new`, `/quotes/:id` | QuoteEdit | 7 | |
| `/trash` | Trash | 3 | |
| `/products`, `/services` | **Settings** (route'larda) | — | `Products.jsx` ve `Services.jsx` dosyaları var ama hiçbir route'a bağlı değil (ölü kod). Silmeden önce karar gerekir |
| `/current-accounts` | CurrentAccounts | 1 | |
| `/payments` | Payments | 6 | |
| `/reports` | Reports | 1 | |
| `/reminders` | Reminders | 2 | |
| `/settings` | Settings | 20 | |
| `/account/password` | ChangePassword | 1 | |
| `/profil` | Profile | 4 | |
| `/finance` | Finance | 6 | admin/accountant |
| `/finance/staff` | Staff | 7 | admin/accountant |
| `/inspections` | Inspections | 1 | |
| `/inspections/new`, `/inspections/:id/edit` | InspectionEdit | 6 | |
| `/inspections/:id` | InspectionDetail | 3 | |
| `/admin/tenants` | AdminTenants | 4 | super_admin |
| `/admin/tenants/:id` | AdminTenantEdit | 9 | super_admin |
| `/admin/audit-logs` | AdminAuditLogs | 2 | |
| `/admin/pricing` | AdminPricing | 2 | |
| `/admin/landing` | AdminLanding | 2 | |
| `/admin/report` | AdminReport3D | 1 | |

Brifteki 25 madde bu tabloyu kapsıyor. Brifte olmayan ama repoda bulunan ek ekran: `/finance/staff` zaten 24-25 maddelerinde yok, bu yüzden madde 25 kapsamında ele alınacak. `Products.jsx`/`Services.jsx` için madde 19 "gerçek mimariye uygun davran" koşulu uyarınca karar bekleniyor.

## 4. Kabul edilmiş tasarım referansı ↔ sayfa eşlemesi

Kullanılan görsel: tek bir 11 ekranlık referans ızgarası (00–10). Ayrıca 1386×665 hologram referansı ve brifin kendisi. Zip içindeki `00_Referans_Rehberi.md` ekte yok.

| Referans | Sayfa |
|---|---|
| 00 Dashboard | `/dashboard` |
| 01 Landing / Giriş | `/`, `/landing`, `/login` |
| 02 Müşteriler | `/customers` |
| 03 Müşteri detay | `/customers/:id` |
| 04 Motosikletler | `/motorcycles` |
| 05 Motosiklet detay | `/motorcycles/:id` |
| 06 Servis kayıtları | `/service-orders` |
| 07 İş emri detay | `/service-orders/:id` (ve new/edit) |
| 08 Ekspertiz / teklif | `/inspections/*`, `/quotes/*` |
| 09 Cari hesaplar / tahsilat | `/current-accounts`, `/payments` |
| 10 Raporlar | `/reports`, `/admin/report` |

Referansta olup repoda karşılığı olmayan öğeler (örnek: "AI sağlık skoru", "ECU normal", "ABS %68", memnuniyet oranı, Google ile giriş) **uygulanmayacak**.

## 5. Mevcut teknik borç doğrulaması (brif 1–9)

- `test_reports/` main'de **yok**. `iteration_1/2/5.json` dosyaları doğrulanamadı. Bu nedenle bu raporlardaki bulgular açık kabul edilmeyecek, kod üzerinden tek tek doğrulanacak.
- `tests/` dizininde yalnızca `__init__.py` var.
- Doğrulama gerektiren backend maddeleri (Aşama 4): servis emri yetkisi/tenant sınırı, tahsilat validasyonu, stok atomikliği, CORS, onay token süresi, Europe/Istanbul digest, müşteri notu, PDF/erişilebilirlik.

## 6. Mevcut diğer dallar — dokunulmadı

- `origin/design/ai-dimensional-ui-20261027`: main'den **15 commit** ileride, **114 dosya** farklı. Bu dal `frontend/src/pages`, `components`, `constants`, `public/visuals`, `plugins/health-check` ve `test_reports/ui_iteration6_theme` (ekran görüntüleri) içeriyor. Bu çalışma **main'den** açıldı; o dalın içeriği korunuyor ama bu PR'a dahil değil. Hangi tabanın kullanılacağı kullanıcı kararı.
- Yerel dallar (`feature/*`, `fix/*`, `wip/*`, `landing-*`, `ui-migration-and-authed-files`) main'e merge edilmiş veya eski; bu aşamada değiştirilmedi.

## 7. Açık kararlar

1. **Motosiklet tip görselleri:** Yalnızca bir hologram referansı var (5a4e4f33). Sport/naked/touring/scooter/enduro/cruiser/elektrikli için 7 ayrı görsel yok. Öneri: tek hologram temel alınır, tip bazında silüet/oran farkı SVG ile üretilir; gerçek tip görselleri gelirse değiştirilir.
2. **Taban dal:** main mi, yoksa `design/ai-dimensional-ui-20261027` mı?
3. **Ölü sayfalar:** `Products.jsx`, `Services.jsx` silinsin mi, yoksa route'a mı bağlansın?
4. **Telefon ekran görüntüsü (1179×2556):** içeriği netleştirilmedi.
5. **Merge ve üretim dağıtımı:** brife göre onay gerekiyor.

## 8. Sonraki adım (Aşama 2)

Tasarım tokenları (`index.css` `.dark` ve açık tema değişkenleri), AppShell/Sidebar/Topbar/PageHero/GlassCard/KpiCard/StatusBadge/EmptyState/ErrorState/Skeleton/ConfirmDialog/Money bileşenlerinin mevcut `components/` yapısı üzerinde genişletilmesi.
