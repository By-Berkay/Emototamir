# PRD — Motosiklet Servis Yönetim Sistemi (SaaS)

## Problem Statement
Türkçe multi-tenant motosiklet servis yönetim SaaS. Süper Admin firmaları yönetir; her firmanın kullanıcıları müşteri/motosiklet/iş emri/parça/işçilik/tahsilat/cari hesap/raporlama modüllerini kullanır.

## User Personas
- **Süper Admin**: firma (tenant) yönetimi, tema/PDF şablonu, abonelik, denetim kayıtları
- **Firma Admin**: firma içinde tüm modüller, kullanıcı yönetimi
- **Servis Danışmanı**: müşteri/motosiklet/servis oluşturma
- **Teknisyen**: arıza tespiti, parça/işçilik ekleme
- **Muhasebe**: cari, tahsilat, raporlar

## Core Requirements
- Türkçe UI, TL, DD.MM.YYYY
- JWT auth, RBAC, multi-tenant izolasyon (tenant_id her kayıtta)
- Ilişki: Müşteri → Motosiklet → Servis → Parça/Hizmet/Ödeme → Cari
- Otomatik servis no (SRV-YYYY-#####)
- Motosiklet tipi görselleri + arıza işaretleme diyagramı
- Servis durumu 12 aşamalı
- Fotoğraf yükleme (Emergent Object Storage)
- PDF (Kabul/Teslim) — firma logosu, adres, IBAN, imza

## Implemented
### v1 — Temel modüller
- JWT login + admin seeding + Rol tabanlı yetki
- Dashboard KPI/grafik
- Müşteri/Motosiklet/Servis/Parça/Hizmet/Tahsilat/Cari CRUD ve raporlar
- Global arama, demo seed

### v2 — Multi-tenant SaaS
- Süper Admin panel: /admin/tenants (liste, oluştur, sil)
- Tenant edit sayfası: Firma bilgileri, tema (renkler, logo), PDF şablon override, arıza bölgeleri, kullanıcı yönetimi + şifre sıfırlama
- Multi-tenant izolasyon her koleksiyon için tenant_id filtresi

### v3 — PDF & Fotoğraf & Onay
- ReportLab PDF (kabul/teslim), firma logosu ve renklerinin uygulanması
- Fotoğraf yükleme (Object Storage), servis fotoğrafları
- İmza tuvali (react-signature-canvas)
- WhatsApp onay linki

### v4 — UX iyileştirmeleri ve genişletmeler
- Servis emri oluştur: hızlı müşteri/motosiklet ekleme dialogları + duplicate kontrolü
- **Parça/Hizmet dropdown seçim sonrası otomatik reset** (create + edit + quote)
- **Deployment fixes**: CORS güvenli origin, N+1 query optimizasyonları
- **PDF Önizleme (Super Admin)**: PDF şablonu sekmesinde canlı iframe önizleme (Kabul + Teslim), örnek servis verisi ile
- **Firma Klonlama**: parça/hizmet/tema/PDF şablonu/arıza bölgeleri kopyalanır, yeni admin oluşturulur, 30 günlük deneme aboneliği verilir
- **Denetim Kayıtları (Audit Log)**: /admin/audit-logs — filtreler, gruplama, satıra tıklayınca old→new diff paneli
- **Firma Abonelik Yönetimi**: plan/trial/subs_ends/is_active, süre dolunca login blocklaması
- **Müşteri Notları (Zaman Damgalı)**: Notlar sekmesi, yazar+admin+super_admin yetkisi, düzenle/sil
- **Toplu Hatırlatma**: firma bazlı politika (km, ay, VE/VEYA), /reminders sayfası, CSV export, WhatsApp toplu link üretimi
- **Fiyat Teklifi (Quote)**: /quotes CRUD, paylaşım linki, /q/:token müşteri onayı (Ad-Soyad + Kabul/Reddet), iş emrine tek-tık dönüşüm
- **Rebrand → "E-Moto Tamir"**: sidebar, login, tarayıcı sekmesi, PDF alt bilgi

### v5 — Otomasyon ve Etiketleme
- **Hatırlatma Otomasyonu (Cron)**: Her sabah 09:00 (İstanbul) `/api/cron/reminders-digest` — WhatsApp linkleri `reminder_digests`'e yazılır
- **Dashboard Widget**: "Bugünkü Bakım Hatırlatmaları" + Yenile + "Tümünü Aç"
- **Not Etiketleri**: VIP / Borçlu / Sorunlu — CustomerDetail'de etiket, Customers listesinde rozet

### v6 — Silme Ekosistemi (bu iterasyon)
- **Toplu Silme**: Müşteriler tablosuna checkbox + "Seçileni Sil (N)" bar
- **Yumuşak Silme (Trash)**: Silinen müşteri/motosiklet cascade snapshot'ı ile `deleted_records` koleksiyonuna 30 gün alınır; `/trash` sayfası — filtre, geri yükle, kalıcı sil
- **Silme Sebebi (Zorunlu)**: Delete dialog textarea; audit_logs'ta hem `new_value` hem `changes: [{field:"reason"}]`
- **Cron Purge**: Günlük 09:00 cron'una `_run_trash_purge` eklendi — 30 gün geçen snapshot'lar otomatik silinir
## Backlog
### P1
- Müşteri Notları ve Admin düzenleme yetenekleri (kısmen — genişletilecek)
- Bakım hatırlatma sistemi + CSV export tabanlı toplu SMS
- server.py refactor (~1900 satır → routers klasörü)
- Bulk Notifications (WhatsApp/SMS) via CSV

### P2
- E-fatura, online ödeme (Stripe), ERP entegrasyonu
- SMS/Email provider (Twilio/SendGrid/Resend)

## Credentials
- Kimlik bilgileri bu dosyada tutulmaz. Süper Admin: `ADMIN_EMAIL` / `ADMIN_PASSWORD` ortam değişkenleri (hesap yoksa ilk açılışta oluşturulur, mevcut şifre sıfırlanmaz).
- Demo firma verisi: `SEED_DEMO_DATA=true` ile yüklenir; demo yönetici için `DEMO_ADMIN_PASSWORD` tanımlanmalıdır.
- Test kimlikleri: `memory/test_credentials.md` (git'e eklenmez, `.gitignore`'da).

## Notes / Known limits
- CORS reverse-proxy ingress `*` döndürüyor olabilir (Emergent kontrolünde); FastAPI seviyesinde reflection düzeltildi.
- Mobil audit table yatay scroll ile kaydırılır.
