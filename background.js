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

  kelimeyiKaydet(info.selectionText, (eklendi) => {
    if (eklendi && tab && tab.id) {
      // DOM'a sadece content script erişebildiği için görsel efekti tetiklemek üzere mesaj gönderiyoruz.
      chrome.tabs.sendMessage(tab.id, { tip: 'GORSEL_GERI_BILDIRIM' }).catch(() => {
        // Sayfa content script'i yüklenmemiş olabilir (örn. chrome:// sayfaları) - sessizce geç.
      });
    }
  });
});
