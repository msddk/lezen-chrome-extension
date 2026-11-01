// options.js

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({ ayarlar: {} }, (sonuc) => {
    const ayarlar = sonuc.ayarlar;
    if (ayarlar.webhookUrl) document.getElementById('webhookUrl').value = ayarlar.webhookUrl;
    if (ayarlar.otomatikSaat) document.getElementById('otomatikSaat').value = ayarlar.otomatikSaat;
    document.getElementById('otomatikAktif').checked = !!ayarlar.otomatikAktif;
  });

  document.getElementById('kaydetBtn').addEventListener('click', ayarlariKaydet);
});

function ayarlariKaydet() {
  const ayarlar = {
    webhookUrl: document.getElementById('webhookUrl').value.trim(),
    otomatikSaat: document.getElementById('otomatikSaat').value,
    otomatikAktif: document.getElementById('otomatikAktif').checked
  };

  chrome.storage.local.set({ ayarlar }, () => {
    // background.js'teki alarmı yeni ayarlara göre yeniden kurdur
    chrome.runtime.sendMessage({ tip: 'ALARMI_GUNCELLE' }, () => {
      const durumEl = document.getElementById('durum-mesaji');
      durumEl.hidden = false;
      durumEl.textContent = 'Ayarlar kaydedildi.';
      setTimeout(() => { durumEl.hidden = true; }, 2500);
    });
  });
}
