# Formula Coach

Asisten AI untuk workshop spreadsheet: menjelaskan formula, memperbaiki formula error, dan membuat formula dari kebutuhan dalam bahasa natural.
Frontend HTML/CSS/JS murni + backend serverless function (Vercel) yang memanggil API Groq/Gemini/Claude/OpenAI.

## Struktur project

```
spreadsheet-ai-workshop/
├── index.html
├── styles.css
├── app.js
├── favicon.svg
├── api/
│   ├── explain.js
│   ├── fix.js
│   ├── generate.js
│   ├── providers.js
│   └── _ai.js
├── vercel.json
├── package.json
└── .env.example
```

## Cara deploy ke Vercel

### 1. Siapkan API key

**Opsi gratis (rekomendasi, tanpa kartu kredit):**
- **Groq** *(default project ini)*: [console.groq.com/keys](https://console.groq.com/keys)
- **Google Gemini**: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

**Opsi berbayar:**
- **Claude**: [console.anthropic.com](https://console.anthropic.com)
- **OpenAI**: [platform.openai.com](https://platform.openai.com/api-keys)

### 2. Push ke GitHub, lalu import ke Vercel
Framework preset: **Other**. Tidak perlu build command.

### 3. Set Environment Variables di Vercel

| Key | Value |
|---|---|
| `AI_PROVIDER` | `groq` |
| `GROQ_API_KEY` | API key kamu |
| `GEMINI_API_KEY` | (opsional, kalau mau aktifkan pilihan Gemini di dropdown) |

### 4. Coba lokal dulu (opsional)
```bash
npm install -g vercel
cp .env.example .env
vercel dev
```

## Dropdown pilih provider AI

Ada dropdown "Model AI" di pojok kanan atas — peserta bisa pilih Groq/Gemini/Claude/OpenAI langsung dari browser. Titik hijau/merah menandai apakah API key provider itu sudah dikonfigurasi di server. Supaya semua opsi berfungsi, isi API key untuk tiap provider yang ingin diaktifkan di Environment Variables Vercel.

## Toggle dark/light mode

Tombol bulat di pojok kanan bawah. Dark (default) = Graphite Warm (coral + sage), Light = Slate Modern (indigo + teal). Font (Manrope + Inter + IBM Plex Mono) sama di kedua tema. Pilihan tersimpan di localStorage.

## Tab "Buat Formula" — grid fleksibel & multi-sheet

- Grid mulai 5×5, bisa ditambah sampai maksimal **10 baris** dan **10 kolom** per sheet lewat tombol "+ Baris"/"+ Kolom"
- Maksimal **3 sheet**, dengan tab di atas grid (klik "+" untuk sheet baru, double-klik nama untuk rename)
- **Semua sheet** dikirim sebagai konteks ke AI setiap generate, supaya formula lintas-sheet (`NamaSheet!A:A`) bisa akurat
- Riwayat chat maksimal 10 (FIFO), tersimpan di localStorage browser peserta, ikut dikirim sebagai konteks supaya pertanyaan lanjutan tetap nyambung

## Optimasi performa (Speed Insights)

| Metrik | Perbaikan |
|---|---|
| **INP** | Penyimpanan grid ke `localStorage` di-debounce 400ms (`debounce()` di `app.js`), bukan tersimpan di tiap ketukan huruf |
| **FCP / LCP** | Google Fonts dimuat non-blocking (`media="print" onload="this.media='all'"`) |
| **TTFB** | `vercel.json` diberi `headers` caching untuk aset statis + `regions: ["sin1"]` (Singapore) supaya serverless function lebih dekat ke pengguna Asia Tenggara |

Cache aset statis di-set 1 jam (bukan setahun penuh) karena project ini masih aktif dikembangkan — supaya peserta tidak "terjebak" versi lama setelah kamu deploy update.

## Ganti provider AI lewat environment variable

| Provider | `AI_PROVIDER` | Env yang dibutuhkan |
|---|---|---|
| Groq | `groq` | `GROQ_API_KEY`, `GROQ_MODEL` |
| Gemini | `gemini` | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Claude | `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| OpenAI | `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` |

**Catatan model Gemini:** default `GEMINI_MODEL` adalah `gemini-flash-latest` — alias resmi Google yang otomatis menunjuk ke model Flash stabil terbaru. Ini sengaja dipakai (bukan nama model spesifik seperti `gemini-2.5-flash`) supaya project ini tidak tiba-tiba error 404 lagi setiap kali Google mempensiunkan versi model lama.

Setelah ubah environment variable di Vercel, klik **Redeploy** di tab Deployments.

## Kustomisasi

- Prompt sistem ada di `api/explain.js`, `api/fix.js`, `api/generate.js` (variabel `SYSTEM_PROMPT`)
- Warna & tema di `styles.css` bagian `:root` (dark) dan `:root[data-theme="light"]` (light)
