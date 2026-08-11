# Formula Coach

Asisten AI untuk workshop spreadsheet dengan tiga mode:
- **Jelaskan Formula** — tempel formula, dapat penjelasan per-bagian + contoh kasus
- **Perbaiki Formula** — tempel formula error, dapat diagnosis + versi yang sudah diperbaiki
- **Buat Formula** — isi contoh data (grid multi-sheet), jelaskan kebutuhan dalam bahasa natural, dapat formula siap pakai lewat percakapan chat

Frontend HTML/CSS/JS murni (tanpa framework) + backend serverless function (Vercel) yang memanggil API Groq/Gemini/Claude/OpenAI. API key tersimpan aman di server, tidak pernah terekspos ke browser.

## Struktur project

```
spreadsheet-ai-workshop/
├── index.html
├── styles.css
├── app.js
├── favicon.svg
├── api/
│   ├── explain.js       # Endpoint: jelaskan formula
│   ├── fix.js            # Endpoint: perbaiki formula
│   ├── generate.js      # Endpoint: buat formula dari kebutuhan + workbook multi-sheet
│   ├── providers.js      # Endpoint: cek provider mana yang API key-nya sudah diset
│   └── _ai.js             # Helper pemanggilan Groq/Gemini/Claude/OpenAI + parsing JSON yang tangguh
├── vercel.json
├── package.json
└── .env.example
```

## Cara deploy ke Vercel

### 1. Siapkan API key

**Opsi gratis (rekomendasi, tanpa kartu kredit):**
- **Groq** *(default project ini)*: [console.groq.com/keys](https://console.groq.com/keys) — cepat, model open-source
- **Google Gemini**: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — kualitas reasoning lebih tinggi

**Opsi berbayar:**
- **Claude**: [console.anthropic.com](https://console.anthropic.com)
- **OpenAI**: [platform.openai.com](https://platform.openai.com/api-keys)

### 2. Push ke GitHub, lalu import ke Vercel
Framework preset: **Other**.

### 3. Set Environment Variables di Vercel

| Key | Value |
|---|---|
| `AI_PROVIDER` | `groq` |
| `GROQ_API_KEY` | API key kamu |
| `GEMINI_API_KEY` | (opsional, kalau mau aktifkan pilihan Gemini di dropdown) |

Setelah ubah environment variable, klik **Redeploy** di tab Deployments — perubahan env var tidak otomatis kepakai tanpa redeploy.

### 4. Coba lokal dulu (opsional, lewat `vercel dev`)
```bash
npm install -g vercel
cd spreadsheet-ai-workshop
vercel dev
```
Ikuti proses login & link project saat diminta. Setelah itu buka `http://localhost:3000`.

**Kalau `vercel dev` error:**
- `'vercel' is not recognized` → CLI belum ter-install atau terminal perlu dibuka ulang setelah install (`npm install -g vercel`, tutup & buka lagi terminal)
- `missing build property` → pastikan `package.json` tidak wajib punya script `"build"`; project ini murni statis, tidak butuh proses build sama sekali
- `must not recursively invoke itself` → jangan taruh `"dev": "vercel dev"` di `package.json`, cukup ketik `vercel dev` langsung di terminal
- `No Output Directory named "public"` → cek Project Settings di dashboard Vercel (Build & Development Settings), pastikan tidak ada override Build Command/Output Directory yang tersimpan dari setup awal; matikan toggle-nya kalau ada

## Provider AI

### Dropdown pilih provider (di UI)
Ada dropdown "Model AI" di pojok kanan atas — peserta bisa pilih Groq/Gemini/Claude/OpenAI langsung dari browser, tersimpan di localStorage. Titik hijau/merah menandai apakah API key provider itu sudah dikonfigurasi di server (endpoint `api/providers.js`, tidak pernah membocorkan isi key). Supaya semua opsi berfungsi, isi API key untuk tiap provider yang ingin diaktifkan.

### Ganti default lewat environment variable

| Provider | `AI_PROVIDER` | Env yang dibutuhkan |
|---|---|---|
| Groq | `groq` | `GROQ_API_KEY`, `GROQ_MODEL` |
| Gemini | `gemini` | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Claude | `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| OpenAI | `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` |

**Catatan model Gemini:** default `GEMINI_MODEL` adalah `gemini-flash-latest` — alias resmi Google yang otomatis menunjuk ke model Flash stabil terbaru, supaya project ini tidak tiba-tiba error 404 lagi setiap kali Google mempensiunkan versi model lama (seperti yang terjadi pada `gemini-2.5-flash`). `thinkingConfig` sengaja **tidak** diset secara eksplisit di `api/_ai.js` karena nama & nilai parameternya beda-beda antar generasi model dan gampang berubah — sebagai gantinya jatah token dibuat lebih besar (`maxOutputTokens: maxTokens * 3`) supaya tetap cukup walau sebagian terpakai untuk proses "thinking" internal model.

### Ketangguhan parsing JSON
AI kadang mengembalikan JSON yang sedikit rusak (tanda kutip di dalam formula tidak di-escape, newline mentah di tengah teks, atau respons kepotong). `api/_ai.js` menangani ini lewat:
- `sanitizeJSONControlChars()` — otomatis meng-escape newline/tab mentah yang ada di dalam string JSON
- `callAIJson()` — kalau parse tetap gagal di percobaan pertama, otomatis coba ulang sekali dengan instruksi lebih tegas ke AI sebelum benar-benar menyerah dengan pesan error yang jelas ke peserta

## Tab "Buat Formula" — grid fleksibel & multi-sheet

- Grid mulai 5×5, bisa ditambah sampai maksimal **10 baris** dan **10 kolom** per sheet lewat tombol "+ Baris"/"+ Kolom", bisa dihapus lewat ikon "×" saat hover ke header baris/kolom
- Maksimal **3 sheet**, dengan tab di atas grid (klik "+" untuk sheet baru, double-klik nama untuk rename)
- **Semua sheet** dikirim sebagai konteks ke AI setiap generate (bukan cuma yang sedang dilihat), supaya formula lintas-sheet (`NamaSheet!A:A`) bisa akurat
- Riwayat chat maksimal 10 (FIFO), tersimpan di `localStorage` browser peserta, ikut dikirim sebagai konteks ke AI supaya pertanyaan lanjutan ("ubah formula tadi supaya...") tetap nyambung
- Tombol salin ada di tiap jawaban AI di history, bukan cuma yang terakhir

## Toggle dark/light mode

Tombol bulat di pojok kanan bawah, ikon bulan/matahari dengan animasi rotate+crossfade saat berganti. Dark (default) = Graphite Warm (coral + sage), Light = Slate Modern (indigo + teal). Font (Manrope + Inter + IBM Plex Mono) sama di kedua tema, cuma warna yang berubah. Pilihan tersimpan di `localStorage`.

## Animasi

Diterapkan di seluruh komponen, semuanya menghormati pengaturan `prefers-reduced-motion` (otomatis nonaktif untuk pengguna yang sensitif terhadap gerakan):

| Bagian | Animasi |
|---|---|
| Tab navigasi | Indikator garis bawah meluncur antar tab |
| Perpindahan panel | Geser naik + fade masuk, replay tiap ganti tab |
| Semua tombol | Efek "tekan" (scale) saat diklik |
| Tombol submit | Spinner menggantikan panah/teks saat menunggu respons AI |
| Hasil Jelaskan/Perbaiki | Blok hasil muncul bertahap (staggered), bukan barengan |
| Grid | Sel baru fade-in halus; baris/kolom yang baru ditambahkan kena highlight kilat sebentar |
| Chat | Bubble pesan geser+fade masuk; indikator "AI sedang mikir" berupa titik-titik berkedip |
| Toast notifikasi | Progress bar tipis yang mengecil sesuai durasi tampil |
| Tombol Salin | Berubah sebentar jadi "✓ Tersalin" setelah diklik |

## Optimasi performa (Speed Insights)

| Metrik | Perbaikan |
|---|---|
| **INP** | Penyimpanan grid ke `localStorage` di-debounce 400ms; event listener grid pakai delegasi (1 listener, bukan ratusan) + `DocumentFragment` untuk batch render |
| **FCP / LCP** | Google Fonts dimuat non-blocking (`media="print" onload="this.media='all'"`) |
| **TTFB** | `vercel.json` diberi `headers` caching untuk aset statis + `regions: ["sin1"]` (Singapore) supaya serverless function lebih dekat ke pengguna Asia Tenggara |

Cache aset statis di-set 1 jam (`max-age=3600, stale-while-revalidate=86400`), bukan setahun penuh, karena project ini aktif dikembangkan.

**Cache-busting versi file:** `styles.css` dan `app.js` di-load dengan query param versi (`styles.css?v=4`, `app.js?v=4`) di `index.html`. **Setiap kali salah satu file ini diubah, naikkan angka versinya** supaya perubahan langsung kepakai di browser peserta tanpa perlu clear cache manual.

## Web Analytics & Speed Insights

Diaktifkan lewat script tag vanilla (bukan React component `<Analytics/>`/`<SpeedInsights/>` dari npm, karena project ini tidak pakai React/Next.js):
- Analytics: script di `<head>`, load `/_vercel/insights/script.js`
- Speed Insights: script sebelum `</body>`, load `/_vercel/speed-insights/script.js`

Aktifkan juga di dashboard Vercel (tab Analytics / Speed Insights → Enable). Data baru muncul setelah ada trafik nyata, biasanya butuh beberapa hari untuk stabil.

## Keamanan & ketahanan

- Semua akses `localStorage` dibungkus `safeStorageGet`/`safeStorageSet` (try/catch) — kalau browser memblokir storage (mis. dibuka via `file://`, mode private ketat), aplikasi tetap jalan normal, cuma tanpa fitur "ingat pilihan terakhir"
- `escapeHTML()` meng-escape tanda kutip ganda & tunggal juga (bukan cuma `&`, `<`, `>`), penting karena dipakai membangun atribut HTML (`data-formula="..."`) dan formula spreadsheet (terutama `QUERY`) sering mengandung tanda kutip

## Kustomisasi

- Prompt sistem AI ada di `api/explain.js`, `api/fix.js`, `api/generate.js` (variabel `SYSTEM_PROMPT`)
- Warna & tema di `styles.css` bagian `:root` (dark) dan `:root[data-theme="light"]` (light)
- Batas grid (`MAX_ROWS`, `MAX_COLS`, `MAX_SHEETS`) dan riwayat chat (`MAX_HISTORY`) ada di bagian atas `app.js`
