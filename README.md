# Hollandaca Kelime Yakalayıcı

Web'de okuduğun Hollandaca metinlerden kelime/deyim yakalayan kişisel Chrome eklentisi. Kelimeleri geçtikleri cümleyle listeler, toplu kopyalamanı ve **Lezen** uygulamana göndermeni sağlar. Her şey tarayıcında (`chrome.storage.local`) kalır; sadece **📤 Lezen'e gönder** butonuna bastığında, sadece senin girdiğin webhook adresine veri gönderilir.

## Kurulum (Geliştirici Modu)

1. Chrome'da `chrome://extensions` adresine git.
2. Sağ üstten **Geliştirici modu**nu aç.
3. **Paketlenmemiş öğe yükle** ile bu klasörü seç. (Güncellemede eklenti kartındaki 🔄 ikonuna bas.)

## Kullanım

- **Çift tıkla:** Bir kelimeye çift tıkla, listeye eklenir (kısa yeşil vurgu ile onaylanır). Kelimenin geçtiği cümle de saklanır (sağ tıkta da).
- **Sağ tık:** Bir veya birden fazla kelime seçip sağ tıkla → "'...' kelimesini listeye ekle". Tek kelime `kelime`, çok kelime `öbek` olarak etiketlenir.
- **Popup:** Eklenti ikonuna tıkla; biriken kelimeleri gör, yanlış olanı ✕ ile sil.

### Toplu kopyalama

Popup'ın üstünde iki buton ve bir **Ayraç** seçici (Satır satır / Virgülle; seçimin hatırlanır):

| Buton | Ne yapar |
|---|---|
| 📋 **Kopyala** | Biriken tüm kelimeleri panoya kopyalar. Liste değişmez. |
| 📌 **Kenara al + kopyala** | Biriken tüm kelimeleri kopyalar ve bir **parti** olarak kenara alır. Ana liste sıfırlanır, bir sonraki parti boş listeyle başlar. |

- Liste **güne bağlı değildir**: kenara alınmamış tüm kelimeler (hangi gün eklenmiş olursa olsun) kopyalanır.
- Aynı kelime birden fazla kez birikmişse kopyada **bir kez** yer alır.
- Kenara alınan partiler popup'ın altındaki **Kenardaki partiler** bölümünde durur; istediğin zaman tekrar **Kopyala** diyebilirsin. Partiyi ✕ ile silebilirsin (onay sorar).

### Lezen'e gönderme

Lezen uygulaması özel bir ağda çalıştığı için eklenti ona doğrudan ulaşamaz. Kelimeler bir n8n webhook'una (posta kutusu) gönderilir; Lezen'de **Words** sayfasındaki butonla oradan alınır.

1. **Ayarlar:** Popup'ın altındaki **⚙️ Lezen ayarları** bölümünü aç. **Webhook adresi** (`https://` ile başlamalı) ve **Kişisel kod**u (Lezen'de *Settings > Your data > Extension*; 20-64 karakter, harf, rakam, `_`, `-`) yapıştır, **Kaydet**'e bas. Chrome bir kez o site için izin sorar; izin ver. Kodu **Göster/Gizle** ile görebilirsin.
2. **Gönder:** **📤 Lezen'e gönder (N)** butonu ana listedeki henüz gönderilmemiş N kelimeyi gösterir. Her basışta en fazla **50** kelime gönderilir; kalan varsa mesaj söyler, tekrar bas.
3. Gönderilen kelimelerin yanında **✓** çıkar. Kelimeler listede kalır, kopyalama butonları aynı şekilde çalışır.
4. Hata olursa (ayar yok, internet yok, kod kabul edilmedi, başka hata) kısa bir mesaj çıkar ve hiçbir kelime gönderildi olarak işaretlenmez.

Notlar:
- Sadece ana listedeki kelimeler gönderilir; **kenardaki partiler gönderilmez**.
- Aynı kelime listede birden fazla kez varsa bir kez gönderilir.
- Cümle, kelimenin geçtiği paragraftan bulunur (önceki `.` `!` `?` veya paragraf başından bir sonrakine kadar, en fazla 400 karakter). Bulunamazsa boş kalır; kelime yine kaydedilir. Eski kelimeler boş cümleyle gönderilir. Aynı kelimeyi o gün tekrar yakalarsan ve eski kaydın cümlesi boşsa, cümle eklenir.
- Webhook adresi ve kod sadece bu tarayıcıda (`chrome.storage.local`) saklanır, senkronize edilmez, hiçbir yere yazılmaz.
