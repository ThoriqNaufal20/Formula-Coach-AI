// api/providers.js
// Endpoint ringan untuk memberi tahu frontend provider mana saja yang API key-nya
// sudah dikonfigurasi di server, supaya dropdown bisa menandai status "siap" vs "belum diatur".
// Tidak pernah mengembalikan isi API key, hanya boolean status.

module.exports = async (req, res) => {
  const status = {
    groq: Boolean(process.env.GROQ_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
  };

  const defaultProvider = (process.env.AI_PROVIDER || "groq").toLowerCase();

  res.status(200).json({ status, defaultProvider });
};
