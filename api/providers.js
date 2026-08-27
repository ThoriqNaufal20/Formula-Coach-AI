// api/providers.js
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
