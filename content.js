// content.js
// Her sayfaya enjekte edilir. Çift tıklamayı yakalar ve
// background.js'ten gelen "görsel geri bildirim göster" mesajını dinler.

document.addEventListener('dblclick', () => {
  const selection = window.getSelection();
  const secilenMetin = selection.toString();

  if (!secilenMetin || secilenMetin.trim().length < 2) return;

  kelimeyiKaydet(secilenMetin, (eklendi) => {
    if (eklendi) {
      gorselGeriBildirimGoster(selection);
    }
  });
});

// background.js, sağ tık (context menu) ile bir kelime kaydedildiğinde
// bu mesajı gönderir, çünkü DOM'a sadece content script erişebilir.
chrome.runtime.onMessage.addListener((mesaj) => {
  if (mesaj.tip === 'GORSEL_GERI_BILDIRIM') {
    const selection = window.getSelection();
    gorselGeriBildirimGoster(selection);
  }
});

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
