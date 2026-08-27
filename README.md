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
│   └── _ai.js             # Helper pemanggilan Groq/Gemini/Claude/OpenAI + retry + parsing JSON tangguh
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

Setelah ubah environment variable, klik **Redeploy** di tab Deployments.

### 4. Coba lokal dulu (opsional, lewat `vercel dev`)
```bash
npm install -g vercel
cd spreadsheet-ai-workshop
vercel dev
```

**Troubleshooting `vercel dev`:**
- `'vercel' is not recognized` → CLI belum ter-install atau terminal perlu dibuka ulang setelah install (`npm install -g vercel`, tutup & buka lagi terminal). Alternatif tanpa install: `npx vercel dev`
- `missing build property` → project ini murni statis, tidak butuh proses build. `package.json` cukup punya `"scripts": {}` kosong
- `must not recursively invoke itself` → jangan taruh `"dev": "vercel dev"` di `package.json`
- `No Output Directory named "public"` → pastikan `vercel.json` punya `"outputDirectory": "."`, DAN cek Project Settings di dashboard Vercel (Build & Development Settings) — matikan override Build Command/Output Directory kalau ada tersimpan dari setup awal

## Provider AI

### Dropdown pilih provider (di UI)
Dropdown "Model AI" di pojok kanan atas — peserta bisa pilih Groq/Gemini/Claude/OpenAI, tersimpan di localStorage. Titik hijau/merah menandai status konfigurasi API key di server (endpoint `api/providers.js`, tidak membocorkan isi key).

### Ganti default lewat environment variable

| Provider | `AI_PROVIDER` | Env yang dibutuhkan |
|---|---|---|
| Groq | `groq` | `GROQ_API_KEY`, `GROQ_MODEL` |
| Gemini | `gemini` | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Claude | `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| OpenAI | `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` |

**Catatan model Groq:** default `GROQ_MODEL` adalah `openai/gpt-oss-120b`. Groq mempensiunkan `llama-3.3-70b-versatile` (17 Juni 2026) — kalau kamu masih set model itu manual di env var, ganti ke `openai/gpt-oss-120b` atau `qwen/qwen3.6-27b`. Cek [console.groq.com/docs/models](https://console.groq.com/docs/models) untuk daftar terbaru.

**Catatan model Gemini:** default `GEMINI_MODEL` adalah `gemini-flash-latest` — alias resmi Google yang otomatis menunjuk ke model Flash stabil terbaru, supaya tidak error 404 lagi tiap kali Google mempensiunkan versi lama. Jatah token (`maxOutputTokens`) sengaja dibatasi maksimal 2048 (bukan dikali tanpa batas) di `api/_ai.js` — model Gemini terbaru pakai sebagian token untuk "thinking" internal, dan kalau jatahnya terlalu besar, generasi bisa makan waktu lama sampai memicu timeout 504 dari Vercel.

### Ketangguhan terhadap error sementara
`api/_ai.js` punya dua lapis penanganan error transient:
- **`fetchWithRetry()`** — kalau provider merespons 429 (rate limit) atau 5xx (server sibuk, mis. Gemini "high demand"/503), otomatis coba ulang sekali setelah jeda ~1.2 detik sebelum melempar error ke peserta
- **`callAIJson()`** — kalau AI mengembalikan JSON yang rusak (tanda kutip di formula tidak di-escape, newline mentah di tengah teks, atau respons kepotong), otomatis coba ulang sekali dengan instruksi lebih tegas. `sanitizeJSONControlChars()` juga otomatis memperbaiki newline/tab mentah di dalam string JSON sebelum di-parse

## Tab "Buat Formula" — grid fleksibel & multi-sheet

- Grid mulai 5×5, bisa ditambah sampai maksimal **10 baris** dan **10 kolom** per sheet, bisa dihapus lewat ikon "×" saat hover ke header baris/kolom
- Maksimal **3 sheet**, tab di atas grid (klik "+" untuk sheet baru, double-klik nama untuk rename)
- **Semua sheet** dikirim sebagai konteks ke AI setiap generate, supaya formula lintas-sheet (`NamaSheet!A:A`) bisa akurat
- Riwayat chat maksimal 10 (FIFO), tersimpan di `localStorage`, ikut dikirim sebagai konteks ke AI supaya pertanyaan lanjutan tetap nyambung
- **Scroll internal**: area hasil (Jelaskan/Perbaiki) dan thread chat (Buat Formula) punya tinggi maksimal dengan scroll sendiri — input di atas (formula bar, grid data) selalu tetap terlihat, tidak perlu bolak-balik scroll halaman

## Toggle dark/light mode

Tombol bulat di pojok kanan bawah, ikon bulan/matahari dengan animasi rotate+crossfade. Dark (default) = Graphite Warm (coral + sage), Light = Slate Modern (indigo + teal). Font (Manrope + Inter + IBM Plex Mono) sama di kedua tema. Pilihan tersimpan di `localStorage`.

## Animasi

Semuanya menghormati `prefers-reduced-motion` (otomatis nonaktif untuk pengguna sensitif gerakan):

| Bagian | Animasi |
|---|---|
| Tab navigasi | Indikator garis bawah meluncur antar tab |
| Perpindahan panel | Geser naik + fade, replay tiap ganti tab |
| Semua tombol | Efek "tekan" (scale) saat diklik |
| Tombol submit | Spinner menggantikan panah/teks saat menunggu AI |
| Hasil Jelaskan/Perbaiki | Blok hasil muncul bertahap (staggered) |
| Grid | Sel baru fade-in; baris/kolom baru kena highlight kilat sebentar |
| Chat | Bubble geser+fade masuk; indikator "AI sedang mikir" berupa titik berkedip |
| Toast | Progress bar tipis yang mengecil sesuai durasi tampil |
| Tombol Salin | Berubah sebentar jadi "✓ Tersalin" |

## Optimasi performa (Speed Insights)

| Metrik | Perbaikan |
|---|---|
| **INP** | `localStorage` grid di-debounce 400ms; event grid pakai delegasi (1 listener) + `DocumentFragment` |
| **FCP / LCP** | Google Fonts dimuat non-blocking |
| **TTFB** | `vercel.json`: caching headers untuk aset statis + `regions: ["sin1"]` (Singapore) |

**Cache-busting versi:** `styles.css`/`app.js` di-load dengan query param versi (`?v=5`) di `index.html`. **Naikkan angka versinya tiap file ini diubah**, supaya perubahan langsung kepakai tanpa perlu clear cache manual.

## Web Analytics & Speed Insights

Pakai script tag vanilla (bukan React component, karena project ini tidak pakai React/Next.js): Analytics di `<head>`, Speed Insights sebelum `</body>`. Aktifkan juga di dashboard Vercel (tab Analytics / Speed Insights → Enable).

## Keamanan & ketahanan

- `localStorage` dibungkus `safeStorageGet`/`safeStorageSet` (try/catch) — kalau diblokir browser (mis. dibuka via `file://`), aplikasi tetap jalan normal
- `escapeHTML()` meng-escape tanda kutip ganda & tunggal juga (bukan cuma `&`, `<`, `>`) — penting karena dipakai membangun atribut HTML (`data-formula="..."`) dan formula (terutama `QUERY`) sering mengandung tanda kutip
- `.part-code`, `.formula-result-code` dan elemen sejenis pakai `overflow-wrap: anywhere` + `min-width: 0` supaya formula panjang membungkus rapi di dalam card, tidak meluber keluar

## Kustomisasi

- Prompt sistem AI: `api/explain.js`, `api/fix.js`, `api/generate.js` (variabel `SYSTEM_PROMPT`)
- Warna & tema: `styles.css` bagian `:root` (dark) dan `:root[data-theme="light"]` (light)
- Batas grid (`MAX_ROWS`, `MAX_COLS`, `MAX_SHEETS`) dan riwayat chat (`MAX_HISTORY`): bagian atas `app.js`
