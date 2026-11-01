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

const CUMLE_EN_FAZLA = 400;

/** Cümleyi temizler: boşlukları teke indirir, kırpar, en fazla 400 karakter. Geçersizse ''. */
function cumleyiTemizle(cumle) {
  if (typeof cumle !== 'string') return '';
  return cumle.replace(/\s+/g, ' ').trim().slice(0, CUMLE_EN_FAZLA).trim();
}

/**
 * Bir kelimeyi/öbeği storage'a kaydeder.
 * Aynı gün içinde, kenara alınmamış aynı metin zaten varsa tekrar eklemez (dedupe).
 * Kenara alınmış kayıtlar dedupe'a dahil değildir: yeni bir partide aynı kelimeyi
 * tekrar biriktirebilmen için.
 * Zaten var olan kaydın cümlesi boşsa ve yeni yakalamada cümle varsa, cümle eklenir.
 * Yeni kayıtlarda `sentence` (kelimenin geçtiği cümle) ve `sent` (Lezen'e gönderildi mi) alanları olur.
 * Eski kayıtlarda bu alanlar yoktur; boş cümle ve "gönderilmedi" sayılırlar.
 * @param {string} metin - kaydedilecek ham metin
 * @param {function} [callback] - (eklendi: boolean, kayit: object|null) şeklinde çağrılır
 * @param {string} [cumle] - kelimenin geçtiği cümle (bulunamadıysa boş)
 */
function kelimeyiKaydet(metin, callback, cumle) {
  const temiz = metniTemizle(metin || '');
  if (!temiz || temiz.length < 2) {
    if (callback) callback(false, null);
    return;
  }

  const temizCumle = cumleyiTemizle(cumle);
  const bugun = bugununTarihi();
  const kelimeSayisi = temiz.split(/\s+/).length;
  const kayit = {
    metin: temiz,
    tip: kelimeSayisi === 1 ? 'kelime' : 'öbek',
    tarih: new Date().toISOString(),
    sentence: temizCumle,
    sent: false
  };

  chrome.storage.local.get({ kelimeler: {} }, (sonuc) => {
    const tumVeri = sonuc.kelimeler;
    const gununListesi = tumVeri[bugun] || [];

    const mevcut = gununListesi.find(
      (k) => !k.kenarda && k.metin.toLowerCase() === temiz.toLowerCase()
    );

    if (mevcut) {
      if (temizCumle && !mevcut.sentence) {
        // Kelime zaten listede ama cümlesi yoktu: cümleyi ekle.
        mevcut.sentence = temizCumle;
        chrome.storage.local.set({ kelimeler: tumVeri }, () => {
          if (callback) callback(false, null);
        });
      } else if (callback) {
        callback(false, null);
      }
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
 * Bir metin bloğunda, seçimin geçtiği cümleyi bulur (DOM'dan bağımsız, saf metin işlemi).
 * Cümle sonu: . ! ? (art arda olabilir), ardından isteğe bağlı kapanış tırnağı/parantez,
 * sonra boşluk veya metnin sonu. Böylece "3.5" veya "site.nl" cümle sonu sayılmaz.
 * @param {string} metin - bloğun tüm metni
 * @param {number} bas - seçimin metindeki başlangıç konumu
 * @param {number} son - seçimin metindeki bitiş konumu
 * @param {string} secilen - seçilen metin (kontrol için)
 * @returns {string} cümle; mantıklı bir sonuç yoksa ''
 */
function cumleyiMetindenBul(metin, bas, son, secilen) {
  if (typeof metin !== 'string' || typeof secilen !== 'string') return '';
  if (!(bas >= 0) || !(son > bas) || son > metin.length) return '';

  const normal = (m) => m.replace(/\s+/g, ' ').trim();

  // Seçim konumu metinle uyuşmuyorsa (garip sayfa yapısı) cümle kaydetme.
  const secimMetni = normal(metin.slice(bas, son));
  if (!secimMetni || secimMetni.toLowerCase() !== normal(secilen).toLowerCase()) return '';

  // Çok uzun bloklarda (örn. tüm sayfa) sadece seçimin çevresine bak.
  const PENCERE = 1000;
  const pBas = Math.max(0, bas - PENCERE);
  const parca = metin.slice(pBas, Math.min(metin.length, son + PENCERE));
  const b = bas - pBas;
  const e = son - pBas;

  const sinir = /[.!?]+["'”’»)\]]*(?=\s|$)/g;
  let cumleBas = 0;
  let cumleSon = parca.length;
  let m;
  while ((m = sinir.exec(parca)) !== null) {
    const bitis = m.index + m[0].length;
    if (bitis <= b) {
      cumleBas = bitis;
    } else if (bitis >= e) {
      cumleSon = bitis;
      break;
    }
    // Seçimin içinde kalan cümle sonları (çok cümleli seçim) yok sayılır.
  }

  let cumle = normal(parca.slice(cumleBas, cumleSon));
  const konum = cumle.toLowerCase().indexOf(secimMetni.toLowerCase());
  if (konum === -1) return '';

  if (cumle.length > CUMLE_EN_FAZLA) {
    // Kelime kesilmesin diye, kelimeyi ortalayan 400 karakterlik bir pencere al.
    const orta = konum + Math.floor(secimMetni.length / 2);
    const pencereBas = Math.max(0, Math.min(orta - CUMLE_EN_FAZLA / 2, cumle.length - CUMLE_EN_FAZLA));
    cumle = cumle.slice(pencereBas, pencereBas + CUMLE_EN_FAZLA).trim();
  }
  return cumle;
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

// --- Lezen'e gönderme ---

const GONDERIM_LIMITI = 50;
const KELIME_EN_FAZLA = 80;
const KOD_DESENI = /^[A-Za-z0-9_-]{20,64}$/;

/** Bir kaydın kimliği: gün + eklenme zamanı + metin. Gönderilenleri tam olarak işaretlemek için. */
function kayitKimligi(gun, kayit) {
  return `${gun}|${kayit.tarih || ''}|${kayit.metin}`;
}

/**
 * Ana listedeki (kenara alınmamış) henüz gönderilmemiş kelimelerden en fazla `limit`
 * farklı kelimeyi, eskiden yeniye seçer. Aynı kelime birden fazla kayıtta varsa bir kez
 * gönderilir (cümlesi olan kayıt tercih edilir) ve hepsinin kimliği işaretleme için döner.
 * @returns {{words: {word: string, sentence: string}[], kimlikler: string[], kalanSayisi: number}}
 */
function gonderilecekleriSec(tumVeri, limit) {
  const gruplar = new Map();
  for (const { gun, kayit } of bekleyenKelimeleriTopla(tumVeri)) {
    if (kayit.sent === true) continue;
    const kelime = typeof kayit.metin === 'string' ? kayit.metin.trim() : '';
    if (!kelime) continue;
    const anahtar = kelime.toLowerCase();
    let grup = gruplar.get(anahtar);
    if (!grup) {
      grup = { word: kelime, sentence: '', kimlikler: [] };
      gruplar.set(anahtar, grup);
    }
    if (!grup.sentence && typeof kayit.sentence === 'string' && kayit.sentence) {
      grup.sentence = kayit.sentence;
    }
    grup.kimlikler.push(kayitKimligi(gun, kayit));
  }

  const hepsi = Array.from(gruplar.values());
  const parti = hepsi.slice(0, limit);
  return {
    words: parti.map((g) => ({
      word: g.word.slice(0, KELIME_EN_FAZLA),
      sentence: g.sentence.slice(0, CUMLE_EN_FAZLA)
    })),
    kimlikler: parti.flatMap((g) => g.kimlikler),
    kalanSayisi: hepsi.length - parti.length
  };
}

/** Ana listede henüz gönderilmemiş farklı kelime sayısı. */
function gonderilmemisSayisi(tumVeri) {
  return gonderilecekleriSec(tumVeri, 0).kalanSayisi;
}

/**
 * Lezen ayarlarını kontrol eder. Hata mesajı gizli bilgiyi (adres, kod) asla içermez.
 * @returns {string|null} sorun varsa kısa Türkçe mesaj, yoksa null
 */
function ayarlariDogrula(webhookUrl, kod) {
  if (typeof webhookUrl !== 'string' || !/^https:\/\//i.test(webhookUrl)) {
    return 'Webhook adresi https:// ile başlamalı.';
  }
  try {
    const adres = new URL(webhookUrl);
    if (adres.protocol !== 'https:' || !adres.hostname) throw new Error();
  } catch (e) {
    return 'Webhook adresi geçerli bir adres değil.';
  }
  if (typeof kod !== 'string' || !KOD_DESENI.test(kod)) {
    return 'Kod 20-64 karakter olmalı; sadece harf (A-Z, a-z), rakam, _ ve - kullanılabilir.';
  }
  return null;
}
