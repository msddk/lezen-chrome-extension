// background.js (service worker)
importScripts('common.js');

// --- Context Menu (sağ tık ile ekleme) ---

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'kelimeyi-listeye-ekle',
    title: "'%s' kelimesini listeye ekle",
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'kelimeyi-listeye-ekle') return;
  if (!info.selectionText) return;

  cumleyiSayfadanAl(tab, info.frameId).then((cumle) => {
    kelimeyiKaydet(info.selectionText, (eklendi) => {
      if (eklendi && tab && tab.id) {
        // DOM'a sadece content script erişebildiği için görsel efekti tetiklemek üzere mesaj gönderiyoruz.
        chrome.tabs.sendMessage(tab.id, { tip: 'GORSEL_GERI_BILDIRIM' }).catch(() => {
          // Sayfa content script'i yüklenmemiş olabilir (örn. chrome:// sayfaları) - sessizce geç.
        });
      }
    }, cumle);
  });
});

/**
 * Sağ tıklanan sayfadan (ve çerçeveden) seçili kelimenin cümlesini ister.
 * Content script yoksa (chrome:// sayfaları, iframe'ler) veya cevap gelmezse '' döner;
 * kelime her durumda kaydedilir.
 */
async function cumleyiSayfadanAl(tab, frameId) {
  if (!tab || typeof tab.id !== 'number' || tab.id < 0) return '';
  try {
    const istek = chrome.tabs.sendMessage(tab.id, { tip: 'CUMLE_AL' }, { frameId: frameId || 0 });
    const zamanAsimi = new Promise((coz) => setTimeout(() => coz(null), 1500));
    const cevap = await Promise.race([istek, zamanAsimi]);
    return cevap && typeof cevap.cumle === 'string' ? cevap.cumle : '';
  } catch (e) {
    return '';
  }
}

// --- Lezen'e gönderme ---
// Gönderim popup yerine burada yapılır: popup gönderim sırasında kapansa bile
// cevap beklenir ve gönderilen kelimeler doğru işaretlenir.
// Güvenlik: webhook adresi ve kod hiçbir yerde loglanmaz ve hiçbir mesaja yazılmaz.

const ZAMAN_ASIMI_MS = 20000;
let gonderimSuruyor = false;

chrome.runtime.onMessage.addListener((mesaj, gonderen, cevapla) => {
  if (!mesaj || mesaj.tip !== 'LEZENE_GONDER') return;
  // Sadece eklentinin kendi popup'ından kabul et (sekmelerdeki content script'lerden değil).
  if (gonderen.id !== chrome.runtime.id || gonderen.tab) return;

  lezeneGonder().then(cevapla, () => cevapla({ ok: false, hata: 'diger' }));
  return true; // cevap asenkron gelecek
});

async function lezeneGonder() {
  if (gonderimSuruyor) return { ok: false, hata: 'suruyor' };
  gonderimSuruyor = true;
  try {
    return await partiyiGonder();
  } finally {
    gonderimSuruyor = false;
  }
}

async function partiyiGonder() {
  const { lezenAyarlari } = await chrome.storage.local.get('lezenAyarlari');
  const ayar = lezenAyarlari || {};
  if (ayarlariDogrula(ayar.webhookUrl, ayar.kod)) return { ok: false, hata: 'ayar' };

  const { kelimeler = {} } = await chrome.storage.local.get('kelimeler');
  const parti = gonderilecekleriSec(kelimeler, GONDERIM_LIMITI);
  if (parti.words.length === 0) return { ok: true, gonderilen: 0, kalan: 0 };

  const iptal = new AbortController();
  const zamanlayici = setTimeout(() => iptal.abort(), ZAMAN_ASIMI_MS);
  let yanit;
  let govde = null;
  try {
    try {
      yanit = await fetch(ayar.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: ayar.kod, words: parti.words }),
        credentials: 'omit',
        cache: 'no-store',
        signal: iptal.signal
      });
    } catch (e) {
      // İnternet yok, adres erişilemiyor veya zaman aşımı.
      return { ok: false, hata: 'ag' };
    }

    if (yanit.status === 400) return { ok: false, hata: 'kod' };
    if (!yanit.ok) return { ok: false, hata: 'diger', durum: yanit.status };

    try {
      govde = await yanit.json();
    } catch (e) {
      govde = null;
    }
  } finally {
    clearTimeout(zamanlayici);
  }

  // Sadece açık bir {"ok": true} cevabında işaretle; aksi halde hiçbir şey işaretlenmez.
  if (!govde || govde.ok !== true) return { ok: false, hata: 'diger', durum: yanit.status };

  const kalan = await gonderilenleriIsaretle(parti.kimlikler);
  return { ok: true, gonderilen: parti.words.length, kalan };
}

/**
 * Storage'ı yeniden okuyup (gönderim sırasında eklenen kelimeler kaybolmasın diye)
 * sadece gönderilen kayıtları sent: true yapar. Kalan gönderilmemiş kelime sayısını döner.
 */
async function gonderilenleriIsaretle(kimlikler) {
  const isaretlenecek = new Set(kimlikler);
  const { kelimeler = {} } = await chrome.storage.local.get('kelimeler');
  for (const gun of Object.keys(kelimeler)) {
    for (const kayit of kelimeler[gun]) {
      if (isaretlenecek.has(kayitKimligi(gun, kayit))) kayit.sent = true;
    }
  }
  await chrome.storage.local.set({ kelimeler });
  return gonderilmemisSayisi(kelimeler);
}
