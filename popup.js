// popup.js

const AYRAC_ANAHTARI = 'kopyaAyraci';
let durumZamanlayici = null;

document.addEventListener('DOMContentLoaded', () => {
  ayraciYukle();
  listeyiYukleVeCiz();

  document.getElementById('kopyalaBtn').addEventListener('click', () => bekleyenleriKopyala(false));
  document.getElementById('kenaraAlBtn').addEventListener('click', () => bekleyenleriKopyala(true));
  document.getElementById('ayracSecici').addEventListener('change', (e) => {
    chrome.storage.local.set({ [AYRAC_ANAHTARI]: e.target.value });
  });
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

function durumGoster(mesaj, basarili) {
  const durumEl = document.getElementById('durum-mesaji');
  durumEl.hidden = false;
  durumEl.textContent = mesaj;
  durumEl.className = 'durum-mesaji ' + (basarili ? 'basarili' : 'hata');
  clearTimeout(durumZamanlayici);
  durumZamanlayici = setTimeout(() => { durumEl.hidden = true; }, 3000);
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

    const silBtn = document.createElement('button');
    silBtn.className = 'sil-btn';
    silBtn.textContent = '✕';
    silBtn.addEventListener('click', () => kelimeyiSil(gun, index));

    satir.appendChild(metinSpan);
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
