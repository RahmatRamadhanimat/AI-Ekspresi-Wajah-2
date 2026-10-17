# 🎭 Face Expression Detector (Real-Time AI)

Aplikasi web modern, interaktif, dan responsif untuk mendeteksi ekspresi wajah manusia secara real-time melalui kamera webcam menggunakan model machine learning dari **Google Teachable Machine** dan dijalankan langsung di browser dengan **TensorFlow.js**.

---

## 🌟 Fitur Utama

1. **Klasifikasi 3 Kategori Ekspresi Wajah:**
   - 😊 **Senang (Happy):** Mendeteksi ekspresi tersenyum atau gembira.
   - 😢 **Sedih (Sad):** Mendeteksi ekspresi wajah sedih atau murung.
   - 😐 **Netral (Neutral):** Mendeteksi ekspresi wajah tenang/relatif datar.
2. **Webcam Real-Time (60 FPS):** Menggunakan HTML5 API `navigator.mediaDevices.getUserMedia()` dengan tampilan video langsung, animasi frame pemindaian (*scan overlay*), dan tombol balik cermin (*mirror mode*).
3. **Indikator Probabilitas Dinamis:** Tiga bilah kemajuan (*progress bar*) dengan warna tema berbeda yang menampilkan persentase distribusi prediksi untuk setiap ekspresi.
4. **Kartu Hasil Deteksi Interaktif:** Menampilkan emoji beranimasi, label dominan, persentase kepercayaan (*confidence rate*), serta deskripsi kontekstual.
5. **Keamanan & Privasi 100% Client-Side:** Seluruh pemrosesan video dilakukan secara lokal di browser Anda menggunakan akselerasi WebGL. Tidak ada rekaman gambar atau video yang dikirim atau disimpan ke server mana pun.
6. **Fleksibilitas Model Kustom:** Dilengkapi tombol **"Pengaturan Model"** di UI untuk mengganti URL model Teachable Machine Anda secara langsung tanpa perlu menyunting kode.

---

## 📂 Struktur File

```
face-expression-detector/
├── index.html       # Struktur website, header, layout kartu, & modal konfigurasi
├── style.css        # Desain modern (biru, putih, ungu muda), animasi, & responsif
├── script.js        # Logika init(), startCamera(), predict(), stopCamera(), & Teachable Machine
└── README.md        # Panduan penggunaan & dokumentasi lengkap
```

---

## 🚀 Cara Menjalankan Website

> **PENTING TENTANG AKSES WEBCAM:**  
> Standar keamanan browser modern (Chrome, Edge, Firefox, Safari) **mewajibkan** akses kamera webcam dijalankan melalui protokol **`http://localhost`** atau **`https://`**. Membuka file langsung via `file:///` akan memblokir akses webcam oleh browser.

Pilih salah satu cara mudah berikut untuk menjalankannya:

### Opsi 1: Menggunakan Python (Sangat Mudah & Bawaan)
Buka terminal / PowerShell di dalam folder proyek ini, lalu jalankan:
```bash
python -m http.server 8080
```
Buka browser dan kunjungi: **`http://localhost:8080`**

### Opsi 2: Menggunakan Node.js / npx
Jika Anda memiliki Node.js:
```bash
npx serve .
```
atau
```bash
npx http-server -p 8080
```

### Opsi 3: Menggunakan VS Code Live Server
1. Buka folder ini di Visual Studio Code.
2. Pasang ekstensi **Live Server**.
3. Klik kanan pada file `index.html` dan pilih **"Open with Live Server"**.

---

## ⚙️ Cara Mengganti URL Model Teachable Machine

Aplikasi ini sudah dilengkapi dengan model Teachable Machine default yang aktif. Anda dapat menggantinya dengan model buatan Anda sendiri menggunakan salah satu dari 2 cara:

### Cara 1: Langsung Melalui Antarmuka Website (Tanpa Edit Kode)
1. Buka website di browser.
2. Klik tombol **"Pengaturan Model"** di pojok kanan atas navbar (atau tombol di strip status model).
3. Masukkan URL model Teachable Machine Anda, contoh:
   ```
   https://teachablemachine.withgoogle.com/models/ID_MODEL_ANDA/
   ```
4. Klik **"Terapkan Model"**. Model akan langsung dimuat dan disimpan di browser Anda!

### Cara 2: Mengubah Variabel di `script.js`
Buka file `script.js`, pada baris ke-24 ubah nilai konstanta `DEFAULT_MODEL_URL`:
```javascript
const DEFAULT_MODEL_URL = "https://teachablemachine.withgoogle.com/models/ID_MODEL_ANDA/";
```
*Pastikan menyertakan garis miring (`/`) di akhir URL.*

---

## 🧠 Panduan Melatih Model Sendiri di Google Teachable Machine

Jika Anda ingin melatih model ekspresi wajah sendiri dari nol:

1. Kunjungi website resmi: [Google Teachable Machine](https://teachablemachine.withgoogle.com/).
2. Klik **Get Started** lalu pilih **Image Project** -> **Standard image model**.
3. Buat 3 kelas dengan nama:
   - Kelas 1: `Senang` (atau `Happy`)
   - Kelas 2: `Sedih` (atau `Sad`)
   - Kelas 3: `Netral` (atau `Neutral`)
4. Klik tombol **Webcam** pada masing-masing kelas:
   - **Senang:** Berposelah tersenyum lebar dengan beberapa variasi sudut kepala, rekam sekitar 100-150 gambar.
   - **Sedih:** Tunjukkan ekspresi wajah sedih/murung, rekam sekitar 100-150 gambar.
   - **Netral:** Ekspresi rileks dan datar seperti biasa, rekam sekitar 100-150 gambar.
5. Klik tombol **Train Model** dan tunggu beberapa detik sampai pelatihan selesai.
6. Coba uji langsung di panel *Preview* sebelah kanan.
7. Klik tombol **Export Model**:
   - Pilih tab **TensorFlow.js**.
   - Pilih opsi **Upload (shareable link)**.
   - Klik **Upload my model**.
8. Salin link URL yang diberikan (contoh: `https://teachablemachine.withgoogle.com/models/xxxxxxx/`) dan tempelkan ke aplikasi website ini!

---

## 🛠️ Ringkasan Fungsi Utama (`script.js`)

- `init(url)`: Mengunduh `model.json` dan `metadata.json`, memuat neural network ke TensorFlow.js, membaca label kelas, dan mengaktifkan tombol mulai.
- `startCamera()`: Meminta izin akses webcam melalui `navigator.mediaDevices.getUserMedia()`, mengalirkan video ke elemen `<video>`, dan memulai siklus perulangan `loop()`.
- `predict()`: Mengambil frame video saat ini, mengeksekusi inferensi AI secara instan (`model.predict(video)`), menghitung persentase probabilitas, menggerakkan progress bar, dan menentukan ekspresi pemenang.
- `stopCamera()`: Menghentikan perulangan `requestAnimationFrame`, mematikan semua hardware stream webcam, dan mereset antarmuka ke mode siaga.

---

## 🎨 Palet Desain
- **Warna Biru:** `#2563eb`, `#1d4ed8`, `#3b82f6` (Profesional, modern, & tepercaya)
- **Warna Ungu Muda / Lilac:** `#8b5cf6`, `#a78bfa`, `#ddd6fe`, `#f5f3ff` (Aksen AI & futuristik)
- **Warna Putih & Netral:** `#ffffff`, `#f8fafc`, `#e2e8f0` (Bersih, rapi, & elegan)
- **Tipografi:** Google Fonts *Poppins* (Heading tebal modern) & *Inter* (Teks isi yang sangat mudah dibaca)
