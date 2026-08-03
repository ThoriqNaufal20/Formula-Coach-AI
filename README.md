# Formula Coach

Asisten AI untuk workshop spreadsheet: menjelaskan formula dan memperbaiki formula yang error.
Frontend HTML/CSS/JS murni + backend serverless function (Vercel) yang memanggil API Claude (atau OpenAI).

## Struktur project

```
spreadsheet-ai-workshop/
├── index.html         # Halaman utama
├── styles.css          # Styling
├── app.js               # Logika interaktif frontend
├── api/
│   ├── explain.js      # Endpoint: menjelaskan formula
│   ├── fix.js            # Endpoint: memperbaiki formula
│   └── _ai.js            # Helper pemanggilan Claude/OpenAI API
├── vercel.json
├── package.json
└── .env.example
```

Backend memakai model AI sungguhan (bukan simulasi) — API key kamu aman karena hanya dipakai
di server (serverless function), tidak pernah terekspos ke browser peserta.

## Cara deploy ke Vercel

### 1. Siapkan API key

**Opsi gratis (rekomendasi untuk workshop, tanpa kartu kredit):**
- **Groq** *(default project ini)*: daftar & buat key di [console.groq.com/keys](https://console.groq.com/keys). Sangat cepat, cocok untuk sesi live di kelas. Model open-source (Llama, Qwen, DeepSeek).
- **Google Gemini**: daftar & buat key di [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Kualitas reasoning lebih tinggi, kuota 1.500 request/hari.

**Opsi berbayar (kualitas lebih konsisten untuk penggunaan produksi/jangka panjang):**
- **Claude**: buat API key di [console.anthropic.com](https://console.anthropic.com) → *Settings → API Keys*.
- **OpenAI**: buat API key di [platform.openai.com](https://platform.openai.com/api-keys).

> Catatan: layanan gratis biasanya memakai data prompt kamu untuk melatih model mereka (kecuali diatur lain di kebijakan privasi masing-masing), dan punya rate limit harian. Untuk latihan workshop, ini biasanya lebih dari cukup — cek kuota terbaru di dashboard masing-masing provider karena angkanya bisa berubah.

### 2. Push project ke GitHub
```bash
cd spreadsheet-ai-workshop
git init
git add .
git commit -m "Formula Coach - initial commit"
git remote add origin <url-repo-kamu>
git push -u origin main
```

### 3. Import ke Vercel
1. Buka [vercel.com](https://vercel.com) → **Add New Project** → pilih repo GitHub kamu.
2. Framework preset: pilih **Other** (tidak perlu build step, project ini statis + serverless function).
3. Sebelum deploy, buka tab **Environment Variables** dan tambahkan:

   | Key | Value |
   |---|---|
   | `AI_PROVIDER` | `groq` |
   | `GROQ_API_KEY` | API key kamu dari console.groq.com/keys |
   | `GROQ_MODEL` | `llama-3.3-70b-versatile` (opsional, ini defaultnya) |

   Kalau mau pakai Gemini, Claude, atau OpenAI sebagai gantinya, lihat tabel provider di bagian bawah README ini.

4. Klik **Deploy**. Setelah selesai, kamu dapat URL seperti `formula-coach.vercel.app`.

### 4. Coba jalankan lokal dulu (opsional, sebelum deploy)
```bash
npm install -g vercel
cp .env.example .env
# isi ANTHROPIC_API_KEY di file .env
vercel dev
```
Buka `http://localhost:3000`.

## Fitur baru: Buat Formula (tab 03) — grid fleksibel & multi-sheet

Tab ketiga untuk peserta yang belum tahu formulanya sama sekali — mereka isi contoh data di grid (baris pertama = header kolom), lalu tulis kebutuhan mereka dalam bahasa natural di kotak chat. AI menyusun formula yang mengacu ke struktur data itu.

**Grid fleksibel:**
- Mulai dari 5×5, tapi bisa ditambah lewat tombol **"+ Baris"** dan **"+ Kolom"** — maksimal **10 baris** dan **10 kolom** per sheet
- Hapus baris/kolom dengan hover ke header baris/kolom lalu klik ikon "×" kecil yang muncul
- Batas ini sengaja dijaga supaya payload yang dikirim ke AI tidak membengkak (memengaruhi kecepatan respons dan penggunaan kuota provider)

**Multi-sheet:**
- Tab sheet di atas grid (mirip Excel/Google Sheets) — klik "+" untuk sheet baru, maksimal **3 sheet**
- Double-klik nama tab untuk rename
- **Semua sheet** (bukan cuma yang sedang dilihat) dikirim sebagai konteks ke AI setiap kali generate, supaya formula lintas-sheet bisa dibuat akurat — misalnya kalau ada sheet "Data" dan "Referensi", AI bisa hasilkan formula yang merujuk `Referensi!B:B`

**Riwayat percakapan (tetap seperti sebelumnya):**
- Maksimal 10, disimpan di `localStorage` browser peserta, FIFO begitu masuk pertanyaan ke-11
- Riwayat (maks 9 sebelumnya) ikut dikirim sebagai konteks ke AI, jadi peserta bisa nanya lanjutan
- Tombol salin di tiap jawaban AI di history

Backend: `api/generate.js` — format data yang dikirim ke AI sekarang per-sheet dengan label nama sheet, contoh:
```
Sheet "Data":
Kolom A: Nama | Kolom B: Kategori | Kolom C: Harga
Baris 2: Kabel USB | Elektronik | 45000

Sheet "Referensi":
Kolom A: Kategori | Kolom B: Diskon
Baris 2: Elektronik | 10%
```



## Fitur baru: Toggle dark/light mode

Tombol bulat mengambang di pojok kanan bawah (ikon bulan/matahari). Dua tema:

| | Dark (default) | Light |
|---|---|---|
| Nama tema | Graphite Warm | Slate Modern |
| Latar | Graphite `#1a1a1e` | Off-white `#f6f6f4` |
| Aksen utama | Coral `#e8735a` | Indigo `#5b5fef` |
| Aksen sekunder | Sage `#8fbc8f` | Teal `#0f9d78` |

Font (Manrope + Inter + IBM Plex Mono) tetap sama di kedua tema — cuma warna yang berubah. Pilihan tema tersimpan di `localStorage`, jadi tetap sama di kunjungan berikutnya. Semua variabel warna ada di `styles.css` bagian `:root` (dark) dan `:root[data-theme="light"]` (light) — untuk ubah palet, cukup edit di situ.



Sekarang ada dropdown **"Model AI"** di pojok kanan atas halaman. Peserta atau kamu bisa pilih provider langsung dari browser, tanpa perlu redeploy:

- Pilihan tersimpan otomatis di browser peserta (lewat `localStorage`), jadi tetap sama di kunjungan berikutnya.
- Titik kecil di samping dropdown menandai status: **hijau/teal** = API key provider itu sudah dikonfigurasi di server dan siap dipakai, **merah/koral** = belum ada key untuk provider itu di server (kalau tetap dipilih, akan muncul pesan error yang jelas saat dipakai).
- Opsi yang belum dikonfigurasi otomatis diberi label "(belum dikonfigurasi)" di dropdown.

**Penting:** dropdown ini hanya *memilih* provider mana yang dipakai — API key tetap disimpan aman di environment variable server (`api/_ai.js`), tidak pernah dikirim atau terlihat di browser. Supaya semua pilihan di dropdown benar-benar berfungsi, kamu perlu set API key untuk **setiap** provider yang ingin diaktifkan di Vercel Environment Variables (lihat tabel di bawah). Provider yang key-nya belum diset tetap muncul di dropdown tapi akan menampilkan error kalau dipilih.

Kalau workshop kamu cuma pakai satu provider (misalnya Groq saja), kamu bisa hapus opsi lain langsung di `<select id="providerSelect">` pada `index.html` supaya dropdown lebih sederhana.

## Ganti provider AI lewat environment variable (default, tanpa dropdown)

Kalau tidak ingin memberi pilihan ke peserta, cukup ubah environment variable di Vercel (Settings → Environment Variables) — ini jadi default kalau peserta belum pernah memilih apa pun di dropdown:

| Provider | `AI_PROVIDER` | Env yang dibutuhkan | Biaya |
|---|---|---|---|
| Groq | `groq` | `GROQ_API_KEY`, `GROQ_MODEL` | Gratis |
| Google Gemini | `gemini` | `GEMINI_API_KEY`, `GEMINI_MODEL` | Gratis |
| Claude (Anthropic) | `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Berbayar |
| OpenAI | `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` | Berbayar |

Setelah mengubah environment variable di dashboard Vercel, klik **Redeploy** (di tab Deployments) supaya perubahan terpakai — Vercel tidak otomatis redeploy hanya karena env variable berubah.

**Model yang disarankan per provider (per Juli 2026, cek dashboard masing-masing untuk update terbaru):**
- Groq: `llama-3.3-70b-versatile` (seimbang) atau model Qwen/DeepSeek yang tersedia di [console.groq.com](https://console.groq.com) untuk hasil yang lebih detail
- Gemini: `gemini-2.5-flash`
- Claude: `claude-sonnet-5`
- OpenAI: `gpt-4o-mini`

## Kustomisasi untuk workshop kamu
- **Prompt sistem** ada di `api/explain.js` dan `api/fix.js` (variabel `SYSTEM_PROMPT`) — ubah gaya bahasa,
  tingkat kedalaman penjelasan, atau tambahkan konteks spesifik (misalnya kalau workshop kamu fokus ke Google Sheets QUERY function).
- **Tampilan**: warna dan tipografi diatur lewat CSS variables di bagian atas `styles.css` (`:root`).
- **Batas panjang jawaban**: parameter `maxTokens` di pemanggilan `callAI(...)` pada `api/explain.js` / `api/fix.js`.

## Langkah lanjutan (fitur #3 dan #4 dari rencana workshop kamu)
Struktur `api/_ai.js` ini bisa dipakai ulang untuk endpoint baru:
- `api/generate-exercise.js` — generate soal latihan otomatis berdasarkan level & topik
- `api/evaluate.js` — evaluasi jawaban peserta (mulai dari cek hasil, baru cek pendekatan formula)

Pola yang sama (system prompt → format JSON terstruktur → render ke UI) bisa langsung dipakai ulang.
