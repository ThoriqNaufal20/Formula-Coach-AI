// api/generate.js
const { callAI, parseJSONResponse } = require("./_ai");

const SYSTEM_PROMPT = `Kamu adalah asisten instruktur dalam workshop spreadsheet (Google Sheets / Excel).
Peserta memberi contoh struktur data (bisa lebih dari satu sheet, masing-masing dengan header kolom + beberapa baris data)
dan menjelaskan dalam bahasa natural apa yang ingin mereka hitung atau cari. Tugasmu membuat formula spreadsheet
yang tepat, yang mengacu ke referensi sel/kolom sesuai struktur data yang diberikan.

Kalau data yang relevan ada di lebih dari satu sheet, buat formula yang merujuk ke sheet lain dengan format
"NamaSheet!A:A" (gunakan nama sheet persis seperti yang diberikan). Kalau cukup satu sheet saja, tidak perlu
pakai referensi lintas-sheet.

Kalau ada riwayat percakapan sebelumnya, anggap pertanyaan baru bisa jadi lanjutan/modifikasi
dari formula sebelumnya (misal "ubah supaya juga exclude yang stok-nya 0") -- gunakan konteks itu.

Balas HANYA dalam format JSON valid (tanpa markdown, tanpa teks lain di luar JSON), dengan struktur persis berikut:
{
  "formula": "formula spreadsheet yang siap dipakai, mengacu ke referensi sel/sheet dari struktur data yang diberikan",
  "penjelasan": "1-3 kalimat menjelaskan cara kerja formula ini dan kenapa itu menjawab kebutuhan peserta"
}

Gunakan Bahasa Indonesia yang natural. Kalau permintaan peserta ambigu atau data yang diberikan
tidak cukup untuk membuat formula yang tepat, tetap buat asumsi masuk akal yang paling umum,
dan sebutkan asumsi itu secara singkat di "penjelasan".`;

function formatWorkbook(workbook) {
  if (!workbook || !Array.isArray(workbook.sheets) || workbook.sheets.length === 0) {
    return "Tidak ada data struktur yang diberikan.";
  }

  return workbook.sheets
    .map((sheet) => {
      const headerLine = (sheet.headers || [])
        .map((h, i) => `Kolom ${colLetter(i)}: ${h && h.trim() ? h.trim() : "(kosong)"}`)
        .join(" | ");

      const rowLines = (sheet.rows || [])
        .map((row, i) => `Baris ${i + 2}: ` + row.map((cell) => (cell && cell.trim() ? cell.trim() : "-")).join(" | "))
        .join("\n");

      return `Sheet "${sheet.name}":\n${headerLine}\n${rowLines}`;
    })
    .join("\n\n");
}

function colLetter(index) {
  return String.fromCharCode(65 + index);
}

function formatHistory(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return "Tidak ada riwayat percakapan sebelumnya.";
  }
  return history
    .slice(-9) // jaga-jaga, batasi konteks yang dikirim ke AI
    .map((h, i) => `${i + 1}. Peserta bertanya: "${h.question}" -> Formula yang diberikan: ${h.formula}`)
    .join("\n");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { workbook, question, history, provider } = req.body || {};

    if (!question || typeof question !== "string" || !question.trim()) {
      res.status(400).json({ error: "Pertanyaan tidak boleh kosong." });
      return;
    }

    const userPrompt = `Struktur data (contoh sheet):
${formatWorkbook(workbook)}

Riwayat percakapan sebelumnya di sesi ini:
${formatHistory(history)}

Permintaan peserta saat ini:
${question.trim()}`;

    const raw = await callAI({ system: SYSTEM_PROMPT, user: userPrompt, maxTokens: 700, provider });
    const parsed = parseJSONResponse(raw);

    res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Terjadi kesalahan pada server." });
  }
};
