# Tutorial Menyambungkan Google Sheet ke Website (Testimoni)

## Langkah 1: Siapkan Google Sheet
1. Buka [Google Sheets](https://sheets.google.com).
2. Buat Spreadsheet baru.
3. Pada **Baris 1**, buat judul kolom:
   - Sel **A1**: `ImageURL`
   - Sel **B1**: `Caption`
4. Masukkan data testimoni mulai dari baris ke-2:
   - Kolom A: Copy link gambar (klik kanan gambar di Discord > Copy Link). Pastikan link berakhiran .jpg, .png, atau .webp.
   - Kolom B: Tulis kata-kata testimoninya (Contoh: "Trusted!", "Mantap bang").

## Langkah 2: Membuat Google Apps Script
1. Di Google Sheet tersebut, klik menu **Extensions (Ekstensi)** > **Apps Script**.
2. Hapus semua kode yang ada di file `Code.gs`, lalu copy-paste kode di bawah ini:

```javascript
function doGet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1'); // Pastikan nama sheet sesuai (biasanya Sheet1)
  var data = sheet.getDataRange().getValues();
  var result = [];

  // Mulai dari baris ke-1 (melewati header baris 0)
  for (var i = 1; i < data.length; i++) {
    // Cek jika kolom ImageURL tidak kosong
    if (data[i][0] !== "") {
      result.push({
        image: data[i][0],
        caption: data[i][1]
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Tekan `Ctrl + S` untuk menyimpan. Beri nama proyek bebas (misal: "API Testimoni").

## Langkah 3: Deploy sebagai Web App
1. Klik tombol **Deploy** (biru di kanan atas) > **New deployment**.
2. Klik icon roda gigi (Select type) > pilih **Web app**.
3. Isi konfigurasi berikut:
   - **Description**: API Testimoni
   - **Execute as**: `Me` (email kamu)
   - **Who has access**: `Anyone` (Siapa saja) -> **PENTING!** Jangan pilih "Only me".
4. Klik **Deploy**.
5. Google akan meminta izin akses (Authorize access).
   - Pilih akun Google kamu.
   - Jika muncul peringatan "Google hasn't verified this app", klik **Advanced** > **Go to ... (unsafe)**.
   - Klik **Allow**.
6. Salin **Web App URL** yang muncul (link panjang berawalan `https://script.google.com/...`).

## Langkah 4: Pasang di HTML
1. Buka file `testimoni.html`.
2. Cari bagian `<script>` di paling bawah body.
3. Paste URL tadi ke dalam variabel `const scriptURL = 'PASTE_DISINI';`.