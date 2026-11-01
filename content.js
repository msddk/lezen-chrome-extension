// content.js
// Her sayfaya enjekte edilir. Çift tıklamayı yakalar (kelimeyi geçtiği cümleyle kaydeder) ve
// background.js'ten gelen "cümleyi ver" / "görsel geri bildirim göster" mesajlarını dinler.

document.addEventListener('dblclick', () => {
  const selection = window.getSelection();
  const secilenMetin = selection.toString();

  if (!secilenMetin || secilenMetin.trim().length < 2) return;

  const cumle = cumleyiBul(selection);

  kelimeyiKaydet(secilenMetin, (eklendi) => {
    if (eklendi) {
      gorselGeriBildirimGoster(selection);
    }
  }, cumle);
});

// background.js, sağ tık (context menu) ile bir kelime kaydedildiğinde
// bu mesajları gönderir, çünkü DOM'a sadece content script erişebilir:
// - CUMLE_AL: kaydetmeden önce, seçili kelimenin geçtiği cümleyi ister.
// - GORSEL_GERI_BILDIRIM: kaydettikten sonra vurgu efektini ister.
chrome.runtime.onMessage.addListener((mesaj, gonderen, cevapla) => {
  if (!mesaj) return;
  if (mesaj.tip === 'GORSEL_GERI_BILDIRIM') {
    const selection = window.getSelection();
    gorselGeriBildirimGoster(selection);
  } else if (mesaj.tip === 'CUMLE_AL') {
    cevapla({ cumle: cumleyiBul(window.getSelection()) });
  }
});

// --- Cümle bulma ---

// Paragraf gibi davranan (satır başlatan) öğelerin CSS display değerleri.
const BLOK_GORUNUMLER = ['block', 'list-item', 'table-cell', 'table-caption', 'flex', 'grid', 'flow-root', 'table'];

/** Düğümden yukarı çıkarak en yakın paragraf benzeri öğeyi bulur (en son body). */
function blokAtasiniBul(dugum) {
  let el = dugum && dugum.nodeType === Node.ELEMENT_NODE ? dugum : dugum && dugum.parentElement;
  while (el && el !== document.body && el !== document.documentElement) {
    if (BLOK_GORUNUMLER.includes(getComputedStyle(el).display)) return el;
    el = el.parentElement;
  }
  return el === document.body ? el : null;
}

/**
 * Seçimin geçtiği cümleyi döndürür. Hiçbir durumda hata fırlatmaz:
 * mantıklı bir cümle bulunamazsa '' döner ve kelime yine kaydedilir.
 */
function cumleyiBul(selection) {
  try {
    if (!selection || selection.rangeCount === 0) return '';
    const secilen = selection.toString();
    if (!secilen.trim()) return '';

    const range = selection.getRangeAt(0);
    const blok = blokAtasiniBul(range.commonAncestorContainer);
    if (!blok || !blok.contains(range.startContainer)) return '';

    const tumu = document.createRange();
    tumu.selectNodeContents(blok);
    const metin = tumu.toString();

    const oncesi = document.createRange();
    oncesi.selectNodeContents(blok);
    oncesi.setEnd(range.startContainer, range.startOffset);
    const bas = oncesi.toString().length;
    const son = bas + range.toString().length;

    return cumleyiMetindenBul(metin, bas, son, secilen);
  } catch (e) {
    return '';
  }
}

/**
 * Seçili metnin etrafına geçici bir yeşil vurgulama efekti ekler.
 * Seçim birden fazla elementi kapsıyorsa (örn. iki paragrafa yayılıyorsa)
 * DOM'u bozmamak için efekt sessizce atlanır.
 */
function gorselGeriBildirimGoster(selection) {
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0).cloneRange();
  const span = document.createElement('span');
  span.style.backgroundColor = '#a3e635';
  span.style.borderRadius = '3px';
  span.style.transition = 'background-color 0.6s ease';

  try {
    range.surroundContents(span);

    setTimeout(() => {
      span.style.backgroundColor = 'transparent';
      setTimeout(() => {
        const parent = span.parentNode;
        if (!parent) return;
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
      }, 600);
    }, 400);
  } catch (e) {
    // Seçim birden fazla element sınırını kapsıyorsa surroundContents hata verir.
    // Bu durumda kelime zaten kaydedildi, sadece görsel efekti atlıyoruz.
  }
}
