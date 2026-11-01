# Hollandaca Kelime Yakalayıcı

Web'de okuduğun Hollandaca metinlerden kelime/deyim yakalayan kişisel Chrome eklentisi. Kelimeleri listeler ve toplu kopyalamanı sağlar. Hiçbir dış servise veri göndermez; her şey tarayıcında (`chrome.storage.local`) kalır.

## Kurulum (Geliştirici Modu)

1. Chrome'da `chrome://extensions` adresine git.
2. Sağ üstten **Geliştirici modu**nu aç.
3. **Paketlenmemiş öğe yükle** ile bu klasörü seç. (Güncellemede eklenti kartındaki 🔄 ikonuna bas.)

## Kullanım

- **Çift tıkla:** Bir kelimeye çift tıkla, listeye eklenir (kısa yeşil vurgu ile onaylanır).
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
