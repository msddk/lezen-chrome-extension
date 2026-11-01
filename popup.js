// popup.js

const AYRAC_ANAHTARI = 'kopyaAyraci';
const AYAR_ANAHTARI = 'lezenAyarlari'; // { webhookUrl, kod } - sadece chrome.storage.local
let durumZamanlayici = null;
let gonderiliyor = false;

document.addEventListener('DOMContentLoaded', () => {
  ayraciYukle();
  listeyiYukleVeCiz();

  document.getElementById('kopyalaBtn').addEventListener('click', () => bekleyenleriKopyala(false));
  document.getElementById('kenaraAlBtn').addEventListener('click', () => bekleyenleriKopyala(true));
  document.getElementById('ayracSecici').addEventListener('change', (e) => {
    chrome.storage.local.set({ [AYRAC_ANAHTARI]: e.target.value });
  });

  document.getElementById('gonderBtn').addEventListener('click', lezeneGonder);
  lezenAyarlariniYukle();
  document.getElementById('kodGosterBtn').addEventListener('click', koduGosterGizle);
  document.getElementById('ayarKaydetBtn').addEventListener('click', lezenAyarlariniKaydet);
});

// --- Yardımcılar ---

function secilenAyrac() {
  return document.getElementById('ayracSecici').value;
}

function ayraciYukle() {
  chrome.storage.local.get({ [AYRAC_ANAHTARI]: 'satir' }, (sonuc) => {
    document.getElementById('ayracSecici').value = sonuc[AYRAC_ANAHTARI];
  });
}

function durumGoster(mesaj, basarili, sure = 3000) {
  const durumEl = document.getElementById('durum-mesaji');
  durumEl.hidden = false;
  durumEl.textContent = mesaj;
  durumEl.className = 'durum-mesaji ' + (basarili ? 'basarili' : 'hata');
  clearTimeout(durumZamanlayici);
  durumZamanlayici = setTimeout(() => { durumEl.hidden = true; }, sure);
}

async function metniPanoyaKopyala(metin) {
  try {
    await navigator.clipboard.writeText(metin);
    return true;
  } catch (e) {
    // Yedek yöntem: gizli textarea + execCommand
    try {
      const alan = document.createElement('textarea');
      alan.value = metin;
      alan.style.position = 'fixed';
      alan.style.opacity = '0';
      document.body.appendChild(alan);
      alan.select();
      const tamam = document.execCommand('copy');
      document.body.removeChild(alan);
      return tamam;
    } catch (e2) {
      return false;
    }
  }
}

// --- Liste çizimi ---

function listeyiYukleVeCiz() {
  chrome.storage.local.get({ kelimeler: {} }, (sonuc) => {
    const tumVeri = sonuc.kelimeler;
    listeyiCiz(bekleyenKelimeleriTopla(tumVeri), tumVeri);
    kenarListesiniCiz(kenarPartileriTopla(tumVeri));
    gonderButonunuGuncelle(tumVeri);
  });
}

function listeyiCiz(bekleyenler, tumVeri) {
  const container = document.getElementById('liste');
  const bosMesaj = document.getElementById('bos-mesaj');
  const sayac = document.getElementById('sayac');

  sayac.textContent = bekleyenler.length;
  container.innerHTML = '';

  if (bekleyenler.length === 0) {
    bosMesaj.hidden = false;
    return;
  }
  bosMesaj.hidden = true;

  bekleyenler.forEach(({ gun, index, kayit }) => {
    const tekrarSayisi = kelimeTekrarSayisi(kayit.metin, tumVeri);

    const satir = document.createElement('div');
    satir.className = 'kelime-satiri';

    const metinSpan = document.createElement('span');
    metinSpan.className = 'metin';
    metinSpan.textContent = kayit.metin;

    const etiketSpan = document.createElement('span');
    etiketSpan.className = `etiket ${kayit.tip}`;
    etiketSpan.textContent = kayit.tip;

    const tekrarSpan = document.createElement('span');
    tekrarSpan.className = 'tekrar';
    tekrarSpan.textContent = tekrarSayisi > 1 ? `${tekrarSayisi}. kez` : '';

    const gonderildiSpan = document.createElement('span');
    gonderildiSpan.className = 'gonderildi';
    if (kayit.sent === true) {
      gonderildiSpan.textContent = '✓';
      gonderildiSpan.title = "Lezen'e gönderildi";
    }

    const silBtn = document.createElement('button');
    silBtn.className = 'sil-btn';
    silBtn.textContent = '✕';
    silBtn.addEventListener('click', () => kelimeyiSil(gun, index));

    satir.appendChild(metinSpan);
    satir.appendChild(gonderildiSpan);
    satir.appendChild(tekrarSpan);
    satir.appendChild(etiketSpan);
    satir.appendChild(silBtn);
    container.appendChild(satir);
  });
}

function kelimeyiSil(gun, index) {
  chrome.storage.local.get({ kelimeler: {} }, (sonuc) => {
    const tumVeri = sonuc.kelimeler;
    if (!tumVeri[gun]) return;
    tumVeri[gun].splice(index, 1);
    chrome.storage.local.set({ kelimeler: tumVeri }, listeyiYukleVeCiz);
  });
}

// --- Kopyalama ---

/**
 * Biriken (kenara alınmamış) tüm kelimeleri, gün sınırından bağımsız, panoya kopyalar.
 * @param {boolean} kenaraAl - true ise kopyalanan kelimeler bir partiye ayrılır ve liste sıfırlanır.
 */
async function bekleyenleriKopyala(kenaraAl) {
  const { kelimeler = {} } = await chrome.storage.local.get('kelimeler');
  const bekleyenler = bekleyenKelimeleriTopla(kelimeler);

  if (bekleyenler.length === 0) {
    durumGoster('Kopyalanacak kelime yok.', false);
    return;
  }

  const kayitlar = bekleyenler.map((b) => b.kayit);
  const metin = kopyaMetniOlustur(kayitlar, secilenAyrac());
  const sayi = benzersizMetinler(kayitlar).length;

  const kopyalandi = await metniPanoyaKopyala(metin);
  if (!kopyalandi) {
    durumGoster('Panoya kopyalanamadı.', false);
    return;
  }

  if (!kenaraAl) {
    durumGoster(`${sayi} kelime kopyalandı.`, true);
    return;
  }

  // Aynı parti kimliği (kenarId) ile işaretle; kayıtlar silinmez, böylece geçmiş
  // tekrar sayıları korunur.
  const kenarId = new Date().toISOString();
  kayitlar.forEach((k) => {
    k.kenarda = true;
    k.kenarId = kenarId;
  });
  await chrome.storage.local.set({ kelimeler });

  durumGoster(`${sayi} kelime kopyalandı ve kenara alındı.`, true);
  listeyiYukleVeCiz();
}

// --- Kenardaki partiler ---

function partiTarihiYaz(kenarId) {
  return new Date(kenarId).toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function kenarListesiniCiz(partiler) {
  const bolum = document.getElementById('kenar-bolumu');
  const kutu = document.getElementById('kenar-listesi');
  kutu.innerHTML = '';

  if (partiler.length === 0) {
    bolum.hidden = true;
    return;
  }
  bolum.hidden = false;

  partiler.forEach((parti) => {
    const metinler = benzersizMetinler(parti.kayitlar);

    const kart = document.createElement('div');
    kart.className = 'parti';

    const ust = document.createElement('div');
    ust.className = 'parti-ust';

    const baslik = document.createElement('span');
    baslik.className = 'parti-baslik';
    baslik.textContent = `${partiTarihiYaz(parti.id)} · ${metinler.length} kelime`;

    const kopyaBtn = document.createElement('button');
    kopyaBtn.className = 'parti-btn';
    kopyaBtn.textContent = '📋 Kopyala';
    kopyaBtn.addEventListener('click', async () => {
      const tamam = await metniPanoyaKopyala(kopyaMetniOlustur(parti.kayitlar, secilenAyrac()));
      durumGoster(tamam ? `${metinler.length} kelime kopyalandı.` : 'Panoya kopyalanamadı.', tamam);
    });

    const silBtn = document.createElement('button');
    silBtn.className = 'sil-btn';
    silBtn.textContent = '✕';
    silBtn.title = 'Bu partiyi sil';
    silBtn.addEventListener('click', () => {
      if (confirm(`${metinler.length} kelimelik bu parti silinsin mi?`)) {
        partiyiSil(parti.id);
      }
    });

    const onizleme = document.createElement('div');
    onizleme.className = 'parti-onizleme';
    onizleme.textContent = metinler.join(', ');

    ust.appendChild(baslik);
    ust.appendChild(kopyaBtn);
    ust.appendChild(silBtn);
    kart.appendChild(ust);
    kart.appendChild(onizleme);
    kutu.appendChild(kart);
  });
}

function partiyiSil(kenarId) {
  chrome.storage.local.get({ kelimeler: {} }, (sonuc) => {
    const tumVeri = sonuc.kelimeler;
    for (const gun in tumVeri) {
      tumVeri[gun] = tumVeri[gun].filter((k) => k.kenarId !== kenarId);
    }
    chrome.storage.local.set({ kelimeler: tumVeri }, listeyiYukleVeCiz);
  });
}

// --- Lezen'e gönderme ---
// Asıl gönderim background.js'te yapılır (popup kapansa bile tamamlanır).

function gonderButonunuGuncelle(tumVeri) {
  if (gonderiliyor) return;
  const btn = document.getElementById('gonderBtn');
  const sayi = gonderilmemisSayisi(tumVeri);
  btn.textContent = sayi > 0 ? `📤 Lezen'e gönder (${sayi})` : "📤 Lezen'e gönder";
}

async function lezeneGonder() {
  if (gonderiliyor) return;
  const btn = document.getElementById('gonderBtn');
  gonderiliyor = true;
  btn.disabled = true;
  btn.textContent = '⏳ Gönderiliyor…';

  let cevap = null;
  try {
    cevap = await chrome.runtime.sendMessage({ tip: 'LEZENE_GONDER' });
  } catch (e) {
    cevap = null;
  }

  gonderiliyor = false;
  btn.disabled = false;
  gonderimSonucunuGoster(cevap);
  listeyiYukleVeCiz();
}

/** Sabit Türkçe mesajlar; adres, kod veya sunucu metni asla gösterilmez. */
function gonderimSonucunuGoster(cevap) {
  if (cevap && cevap.ok) {
    if (!cevap.gonderilen) {
      durumGoster('Gönderilecek yeni kelime yok.', true);
    } else if (cevap.kalan > 0) {
      durumGoster(`${cevap.gonderilen} kelime gönderildi · ${cevap.kalan} kelime kaldı, tekrar bas.`, true, 6000);
    } else {
      durumGoster(`${cevap.gonderilen} kelime gönderildi.`, true);
    }
    return;
  }

  const hata = cevap && cevap.hata;
  if (hata === 'ayar') {
    document.getElementById('lezen-ayarlari').open = true;
    durumGoster('Önce aşağıdaki "Lezen ayarları" bölümünde adresi ve kodu gir ve kaydet.', false, 6000);
  } else if (hata === 'ag') {
    durumGoster('Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.', false, 6000);
  } else if (hata === 'kod') {
    durumGoster('Kod kabul edilmedi. Kodu Lezen uygulamasında Settings > Your data > Extension bölümünden kontrol et.', false, 8000);
  } else if (hata === 'suruyor') {
    durumGoster('Gönderim zaten sürüyor, biraz bekle.', false);
  } else if (cevap && typeof cevap.durum === 'number') {
    durumGoster(`Gönderilemedi (hata kodu ${cevap.durum}). Sonra tekrar dene.`, false, 6000);
  } else {
    durumGoster('Gönderilemedi. Sonra tekrar dene.', false, 6000);
  }
}

// --- Lezen ayarları ---

function lezenAyarlariniYukle() {
  chrome.storage.local.get({ [AYAR_ANAHTARI]: {} }, (sonuc) => {
    const ayar = sonuc[AYAR_ANAHTARI] || {};
    if (typeof ayar.webhookUrl === 'string') document.getElementById('webhookUrl').value = ayar.webhookUrl;
    if (typeof ayar.kod === 'string') document.getElementById('kisiselKod').value = ayar.kod;
  });
}

function koduGosterGizle() {
  const alan = document.getElementById('kisiselKod');
  const btn = document.getElementById('kodGosterBtn');
  const gizli = alan.type === 'password';
  alan.type = gizli ? 'text' : 'password';
  btn.textContent = gizli ? 'Gizle' : 'Göster';
}

function lezenAyarlariniKaydet() {
  const webhookUrl = document.getElementById('webhookUrl').value.trim();
  const kod = document.getElementById('kisiselKod').value.trim();

  const hata = ayarlariDogrula(webhookUrl, kod);
  if (hata) {
    durumGoster(hata, false, 6000);
    return;
  }

  // İzin isteği tıklamanın içinde hemen yapılmalı (Chrome kuralı). Sadece bu adresin
  // sitesi için izin istenir. Ayarlar aynı anda kaydedilir: izin penceresi açılınca
  // popup kapanırsa ayarlar yine de kaybolmaz.
  const izin = { origins: [`https://${new URL(webhookUrl).hostname}/*`] };
  const izinSonucu = chrome.permissions.request(izin).catch(() => false);
  const kayit = chrome.storage.local.set({ [AYAR_ANAHTARI]: { webhookUrl, kod } });

  Promise.all([izinSonucu, kayit]).then(
    ([izinVerildi]) => {
      if (izinVerildi) {
        durumGoster('Ayarlar kaydedildi.', true);
      } else {
        durumGoster("Ayarlar kaydedildi ama Chrome izni verilmedi. Gönderim yine de çalışabilir; sorun olursa Kaydet'e tekrar basıp izin ver.", false, 8000);
      }
    },
    () => durumGoster('Ayarlar kaydedilemedi. Tekrar dene.', false, 6000)
  );
}
