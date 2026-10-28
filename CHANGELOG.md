# Değişiklik Geçmişi

Sürüm kuralı: büyük değişiklik → `2.0`, `3.0` …; küçük düzeltme → `2.01`, `2.02` …
Her sürüm git etiketi (`vX.Y`) ile saklanır; eski kodu `git checkout vX.Y` ile geri alabilirsiniz.

## v2.01 — Açık / koyu tema
- Uygulama genelinde açık ve koyu tema; üst çubuktaki düğmeyle değiştirilir.
- Seçim tarayıcıda saklanır; seçim yoksa işletim sisteminin tercihi kullanılır.
- Tüm sayfalar iki temada da kontrol edildi (masaüstü ve 390px mobil); yatay taşma yok.
- Emergent'a ait kalan test kimlikleri ve yorumlar temizlendi.

## v2.0 — Tasarım yenilemesi ve yeni modüller
- Ana sayfa (`/landing`) ve giriş (`/login`) koyu tema, 3D kartlar, motosiklet görselleri ile yenilendi.
- Profil sayfası: kişisel bilgiler, profil fotoğrafı (yükleme/kaldırma), firma bilgileriyle bağlantı.
- Gelir & Gider modülü (`/finance`): gelir/gider kayıtları, aylık özet, kategori dağılımı.
- Personel & Maaş modülü (`/finance/staff`): personel kartları, avans ve kısmi maaş ödemeleri, kalan bakiye takibi. Ödenen maaşlar gider olarak Gelir & Gider'e yansır.
- Sürüm bilgisi giriş ekranında gösterilir.

## v1.0 — İlk sürüm
- Müşteri, motosiklet ve servis emri yönetimi.
- Teklif, tahsilat, cari hesap ve raporlar.
- Periyodik bakım ve ekspertiz kayıtları.
- Çöp kutusu, hatırlatmalar, rol tabanlı yetkilendirme.
