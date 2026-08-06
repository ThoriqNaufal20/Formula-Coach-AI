// api/fix.js
const { callAIJson } = require("./_ai");

const SYSTEM_PROMPT = `Kamu adalah asisten instruktur dalam workshop spreadsheet (Google Sheets / Excel).
Peserta akan mengirim formula yang error atau tidak menghasilkan output yang diharapkan.
Tugasmu mendiagnosis kesalahan dan memberi formula perbaikan, dengan penjelasan edukatif
(tujuannya peserta belajar, bukan sekadar dapat jawaban jadi).

Balas HANYA dalam format JSON valid (tanpa markdown, tanpa teks lain di luar JSON), dengan struktur persis berikut:
{
  "jenis_kesalahan": "kategori singkat, misal: Syntax Error / Reference Error / Logic Error / Tipe Data Salah",
  "diagnosis": "penjelasan apa yang salah dan kenapa itu terjadi",
  "formula_perbaikan": "formula yang sudah benar, siap dipakai",
  "penjelasan_perbaikan": "apa yang diubah dan mengapa perubahan itu memperbaiki masalah",
  "tips_pencegahan": "tips singkat agar peserta tidak mengulangi kesalahan serupa"
}

Jika formula yang dikirim peserta sebenarnya sudah benar, katakan itu dengan jujur di "diagnosis",
isi "formula_perbaikan" dengan formula yang sama, dan jelaskan kenapa formula itu sudah tepat.
Gunakan Bahasa Indonesia yang natural dan suportif, seperti instruktur yang membimbing, bukan menghakimi.

PENTING soal format JSON: formula spreadsheet sering mengandung tanda kutip ganda di dalamnya
(misal =SUMIF(A:A,"Elektronik",B:B)). Kalau formula seperti ini muncul di value manapun,
tanda kutip di dalamnya WAJIB di-escape jadi \\" supaya JSON tetap valid, contoh:
"formula_perbaikan": "=SUMIF(A:A,\\"Elektronik\\",B:B)"`;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { formula, errorMessage, context, provider } = req.body || {};

    if (!formula || typeof formula !== "string" || !formula.trim()) {
      res.status(400).json({ error: "Formula tidak boleh kosong." });
      return;
    }

    const userPrompt = `Formula bermasalah dari peserta:
${formula.trim()}

${errorMessage && errorMessage.trim() ? `Pesan error / hasil yang muncul: ${errorMessage.trim()}` : "Tidak ada pesan error spesifik yang dilaporkan."}
${context && context.trim() ? `Konteks tambahan (tujuan formula ini): ${context.trim()}` : ""}`;

    const parsed = await callAIJson({ system: SYSTEM_PROMPT, user: userPrompt, maxTokens: 1200, provider });

    res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Terjadi kesalahan pada server." });
  }
};
