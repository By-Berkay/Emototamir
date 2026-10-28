# Değişiklik Geçmişi

Sürüm kuralı: büyük değişiklik → `2.0`, `3.0` …; küçük düzeltme → `2.01`, `2.02` …
Her sürüm git etiketi (`vX.Y`) ile saklanır; eski kodu `git checkout vX.Y` ile geri alabilirsiniz.

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
