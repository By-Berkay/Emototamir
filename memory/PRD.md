# PRD — Motosiklet Servis Yönetim Sistemi

## Problem Statement
Türkçe bir motosiklet servis yönetim sistemi. Müşteri, motosiklet, iş emri, parça, işçilik, tahsilat, cari hesap ve raporlama tek platformda.

## User Personas
- Servis Sahibi / Admin: tüm modüllere erişim, kullanıcı yönetimi
- Servis Danışmanı: müşteri/motosiklet/servis oluşturma
- Teknisyen: arıza tespiti, parça/işçilik ekleme
- Muhasebe: cari, tahsilat, raporlar

## Core Requirements
- Türkçe UI, TL, DD.MM.YYYY
- JWT auth, RBAC
- Ilişki: Müşteri → Motosiklet → Servis → Parça/Hizmet/Ödeme → Cari
- Otomatik servis no (SRV-YYYY-#####)
- Motosiklet tipi görselleri + arıza işaretleme diyagramı
- Servis durumu 12 aşamalı

## Implemented (v1)
- JWT login + admin seeding + Rol tabanlı yetki
- Dashboard: 8 KPI, aylık ciro grafiği, servis durumu donut, en çok yapılan işlemler, son servisler
- Müşteri CRUD + detay (motosiklet, servis geçmişi, cari hareket)
- Motosiklet CRUD + tip görsel önizleme + servis geçmişi
- Servis kaydı oluşturma: müşteri/moto seçim, kilometre, yakıt, aksesuar, arıza bölge işaretleme (SVG), parça/hizmet ekleme, işçilik/iskonto, otomatik toplam
- Servis detay: sekmeli görünüm, durum değişimi, tahsilat, ödeme geçmişi
- Parça envanteri (stok, min stok, kritik uyarı, satışta otomatik düşüm)
- Hizmet kataloğu
- Tahsilat kaydı ve listeleme (nakit/kart/havale)
- Cari hesap: müşteri bakiyeleri, transaction ledger
- Raporlar: en çok müşteri/hizmet/parça, kritik stok, CSV export
- Global arama (topbar)
- Demo veri seed'i (10 müşteri, 15 moto, 30 servis, 20 parça, 10 hizmet)

## Backlog (P1)
- Servis kabul/teslim PDF çıktısı
- Fotoğraf yükleme (Faz 4)
- Müşteri onayı workflow (WhatsApp/SMS)
- Bakım hatırlatma sistemi

## Backlog (P2)
- E-fatura, online ödeme, ERP entegrasyonu
