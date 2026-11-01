// common.js
// content.js, background.js ve popup.js tarafından ortak kullanılan fonksiyonlar.
// content_scripts içinde common.js, content.js'den önce yüklenir.
// background.js içinde importScripts('common.js'), popup.html içinde <script> ile dahil edilir.

function bugununTarihi() {
  return new Date().toISOString().split('T')[0]; // "2026-10-17"
}

function metniTemizle(metin) {
  return metin.trim().replace(/[.,!?;:()"'«»“”]/g, '');
}

/**
 * Bir kelimeyi/öbeği storage'a kaydeder.
 * Aynı gün içinde, kenara alınmamış aynı metin zaten varsa tekrar eklemez (dedupe).
 * Kenara alınmış kayıtlar dedupe'a dahil değildir: yeni bir partide aynı kelimeyi
 * tekrar biriktirebilmen için.
 * @param {string} metin - kaydedilecek ham metin
 * @param {function} [callback] - (eklendi: boolean, kayit: object|null) şeklinde çağrılır
 */
function kelimeyiKaydet(metin, callback) {
  const temiz = metniTemizle(metin || '');
  if (!temiz || temiz.length < 2) {
    if (callback) callback(false, null);
    return;
  }

  const bugun = bugununTarihi();
  const kelimeSayisi = temiz.split(/\s+/).length;
  const kayit = {
    metin: temiz,
    tip: kelimeSayisi === 1 ? 'kelime' : 'öbek',
    tarih: new Date().toISOString()
  };

  chrome.storage.local.get({ kelimeler: {} }, (sonuc) => {
    const tumVeri = sonuc.kelimeler;
    const gununListesi = tumVeri[bugun] || [];

    const zatenVar = gununListesi.some(
      (k) => !k.kenarda && k.metin.toLowerCase() === temiz.toLowerCase()
    );

    if (zatenVar) {
      if (callback) callback(false, null);
      return;
    }

    gununListesi.push(kayit);
    tumVeri[bugun] = gununListesi;
    chrome.storage.local.set({ kelimeler: tumVeri }, () => {
      if (callback) callback(true, kayit);
    });
  });
}

/**
 * Bir kelimenin geçmiş günler dahil kaç farklı günde eklendiğini sayar.
 * @param {string} kelimeMetni
 * @param {object} tumVeri - { "2026-10-17": [...], ... }
 */
function kelimeTekrarSayisi(kelimeMetni, tumVeri) {
  let sayac = 0;
  for (const gun in tumVeri) {
    const varMi = tumVeri[gun].some(
      (k) => k.metin.toLowerCase() === kelimeMetni.toLowerCase()
    );
    if (varMi) sayac++;
  }
  return sayac;
}

// --- Kopyalama / parti mantığı ---

/**
 * Henüz kenara alınmamış TÜM kelimeleri (gün sınırından bağımsız) kronolojik sırayla döndürür.
 * Dönen her öğe { gun, index, kayit } şeklindedir; kayit, tumVeri içindeki nesnenin kendisidir
 * (üzerinde yapılan değişiklik storage'a geri yazıldığında kalıcı olur).
 */
function bekleyenKelimeleriTopla(tumVeri) {
  const sonuc = [];
  for (const gun of Object.keys(tumVeri).sort()) {
    tumVeri[gun].forEach((kayit, index) => {
      if (!kayit.kenarda) sonuc.push({ gun, index, kayit });
    });
  }
  return sonuc;
}

/**
 * Kenara alınmış kayıtları parti (kenarId) bazında gruplar, en yeni parti başta olacak şekilde döndürür.
 * @returns {Array<{id: string, kayitlar: object[]}>}
 */
function kenarPartileriTopla(tumVeri) {
  const partiler = {};
  for (const gun of Object.keys(tumVeri).sort()) {
    for (const kayit of tumVeri[gun]) {
      if (kayit.kenarda && kayit.kenarId) {
        (partiler[kayit.kenarId] = partiler[kayit.kenarId] || []).push(kayit);
      }
    }
  }
  return Object.keys(partiler)
    .sort()
    .reverse()
    .map((id) => ({ id, kayitlar: partiler[id] }));
}

/** Aynı kelimeyi (büyük/küçük harf fark etmeksizin) bir kez içeren metin listesi. */
function benzersizMetinler(kayitlar) {
  const goruldu = new Set();
  const sonuc = [];
  for (const k of kayitlar) {
    const anahtar = k.metin.toLowerCase();
    if (!goruldu.has(anahtar)) {
      goruldu.add(anahtar);
      sonuc.push(k.metin);
    }
  }
  return sonuc;
}

/**
 * Kopyalanacak metni üretir.
 * @param {object[]} kayitlar
 * @param {'satir'|'virgul'} ayrac - 'satir': her kelime ayrı satırda, 'virgul': "a, b, c"
 */
function kopyaMetniOlustur(kayitlar, ayrac) {
  return benzersizMetinler(kayitlar).join(ayrac === 'virgul' ? ', ' : '\n');
}
