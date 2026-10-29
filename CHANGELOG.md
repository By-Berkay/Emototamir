# Değişiklik Geçmişi

Sürüm kuralı: büyük değişiklik → `2.0`, `3.0` …; küçük düzeltme → `2.01`, `2.02` …
Her sürüm git etiketi (`vX.Y`) ile saklanır; eski kodu `git checkout vX.Y` ile geri alabilirsiniz.

## v2.06 — Animasyonlu SVG motosiklet görünümleri
- Tüm motosiklet görselleri E-Moto animasyonlu SVG setiyle değişti: Naked, Supersport, Touring, Adventure, Cruiser, Chopper, Scooter, Maxi Scooter, Cafe Racer, Motocross.
- Servis kaydında arıza bölgeleri SVG üzerinde tıklanarak seçilir; listedeki düğmeler aynı seçimi yapar.
- Tip görseli yüklenmiş firmalarda o görsel kullanılmaya devam eder.
- 3D (three.js) görünümü kaldırıldı; paket boyutu küçüldü.
- Yedek: önceki sürüm `backup/v2.05` dalında.

## v2.05 — Fiyat listesi sadeleştirildi
- Ayarlar'daki "Fiyat Listesi" sekmesi ve Yönetim menüsündeki "Fiyat Listesi" sayfası kaldırıldı. Vitrin planları "Vitrin & Planlar" sayfasında yönetilir ve ana sayfada gösterilir.
- Toplu KDV değiştirme düğmesi Ürünler sayfasına taşındı.
- Ürün ve hizmet formlarına KDV oranı ve fiyat tipi (KDV dahil/hariç) seçimi eklendi.
- Ayarlar'daki ürün/hizmet kodu kaldırıldı; katalog işlemleri Ürünler ve Hizmetler sayfalarında.
- Yedek: önceki sürüm `backup/v2.04` dalında.

## v2.04 — 3D motosiklet, rota düzeltmeleri, tasarım tokenları
- Servis kaydı ve motosiklet detayında 3D motosiklet (hologram): tip ve renk bilgisine göre üretilir, boş kayıtta varsayılan hologram motor gösterilir.
- Servis kaydında arıza bölgeleri 3D modelin üzerinde tıklanarak seçilir; altındaki liste aynı seçimi yapar.
- WebGL yoksa veya hareket azaltma açıksa eski SVG görünümü kullanılır.
- `/products` ve `/services` artık kendi sayfalarını açıyor (önceden Ayarlar'a yönleniyordu).
- Açık/koyu tema için marka renk tokenları ve cam kart bileşeni (`GlassCard`).
- Yedek: önceki sürüm `backup/v2.03` dalında saklı.

## v2.03 — Ekspertiz fotoğrafları
- iPhone'dan gelen HEIC/HEIF fotoğraflar artık yüklenebiliyor; sunucuda JPEG'e çevrilir.
- Ekspertiz fotoğraf galerisi ve plaka uyarısı düzeltmeleri (önceki çalışma).

## v2.02 — Fiyat listesi girişi
- Süper admin `/admin/pricing` sayfası eski fiyat listesi düzenine döndü: paketler (ad, fiyat, birim, öne çıkar, özellikler) ve kalem tablosu, arama, fiyat doğrulama, son güncelleme bilgisi.
- Vitrin metinleri, SaaS planları ve iletişim bilgileri ayrı sayfada: `/admin/landing` ("Vitrin İçeriği").

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
