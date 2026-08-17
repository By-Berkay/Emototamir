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

### v4 — UX iyileştirmeleri (bu iterasyon)
- Servis emri oluştur: hızlı müşteri/motosiklet ekleme dialogları + duplicate kontrolü
- **Parça/Hizmet dropdown seçim sonrası otomatik reset** (create + edit)
- **Deployment fixes**: CORS güvenli origin, N+1 query optimizasyonları
- **PDF Önizleme (Super Admin)**: PDF şablonu sekmesinde canlı iframe önizleme (Kabul + Teslim), örnek servis verisi ile
- **Firma Klonlama**: parça/hizmet/tema/PDF şablonu/arıza bölgeleri kopyalanır, yeni admin oluşturulur, 30 günlük deneme abonelik verilir
- **Denetim Kayıtları (Audit Log)**: /admin/audit-logs — firma/kullanıcı/işlem/tarih filtreleri, günlere göre gruplama; tenant.create/update/delete/clone/global_apply olayları kaydedilir; regex enjeksiyonu re.escape ile engellendi
- **Firma Abonelik Yönetimi**: plan (trial/basic/pro/enterprise), trial_ends_at, subscription_ends_at, is_active, billing_notes. Login sırasında bitiş tarihi geçmiş firma otomatik pasifleştirilir (HTTP 403)

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
- **Süper Admin**: berkayozturk27@gmail.com / 123
- **Demo Firma Admin**: admin@motocarizma.com / demo123

## Notes / Known limits
- CORS reverse-proxy ingress `*` döndürüyor olabilir (Emergent kontrolünde); FastAPI seviyesinde reflection düzeltildi.
- Mobil audit table yatay scroll ile kaydırılır.
