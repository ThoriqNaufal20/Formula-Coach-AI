// api/explain.js
const { callAI, parseJSONResponse } = require("./_ai");

const SYSTEM_PROMPT = `Kamu adalah asisten instruktur dalam workshop spreadsheet (Google Sheets / Excel).
Tugasmu menjelaskan formula spreadsheet dengan jelas untuk peserta yang sedang belajar,
mulai dari tipe data dasar sampai rumus kompleks (VLOOKUP, INDEX-MATCH, QUERY, array formula, dsb).

Balas HANYA dalam format JSON valid (tanpa markdown, tanpa teks lain di luar JSON), dengan struktur persis berikut:
{
  "ringkasan": "1-2 kalimat inti, apa fungsi formula ini secara umum",
  "bagian": [
    { "kode": "potongan formula", "penjelasan": "apa fungsi potongan ini" }
  ],
  "contoh_kasus": "satu contoh skenario nyata dunia kerja di mana formula ini dipakai",
  "catatan": "tips, jebakan umum, atau fungsi alternatif yang relevan (boleh kosong string jika tidak ada)"
}

Gunakan Bahasa Indonesia yang natural dan mudah dipahami peserta workshop, bukan bahasa teknis yang kaku.
Pecah "bagian" menjadi potongan-potongan logis (misal per argumen fungsi), jangan hanya satu bagian besar.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { formula, context, provider } = req.body || {};

    if (!formula || typeof formula !== "string" || !formula.trim()) {
      res.status(400).json({ error: "Formula tidak boleh kosong." });
      return;
    }

    const userPrompt = `Formula yang perlu dijelaskan:
${formula.trim()}

${context && context.trim() ? `Konteks tambahan dari peserta: ${context.trim()}` : "Tidak ada konteks tambahan."}`;

    const raw = await callAI({ system: SYSTEM_PROMPT, user: userPrompt, maxTokens: 1024, provider });
    const parsed = parseJSONResponse(raw);

    res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Terjadi kesalahan pada server." });
  }
};
