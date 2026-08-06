// api/_ai.js
// Helper bersama untuk memanggil provider AI.
// Provider bisa dipilih dengan dua cara:
//   1. Dropdown di UI (dikirim dari frontend lewat body.provider) -- prioritas utama
//   2. Env var AI_PROVIDER di server -- dipakai kalau frontend tidak mengirim pilihan
// Nilai yang valid: "groq" (gratis) | "gemini" (gratis) | "anthropic" (berbayar) | "openai" (berbayar)

const VALID_PROVIDERS = ["groq", "gemini", "anthropic", "openai"];
const DEFAULT_PROVIDER = (process.env.AI_PROVIDER || "groq").toLowerCase();

// Nama provider yang tampil ke user di pesan error, biar jelas API key mana yang kurang.
const PROVIDER_LABEL = {
  groq: "Groq",
  gemini: "Google Gemini",
  anthropic: "Claude (Anthropic)",
  openai: "OpenAI",
};

async function callAI({ system, user, maxTokens = 1024, provider }) {
  const selected = VALID_PROVIDERS.includes((provider || "").toLowerCase())
    ? provider.toLowerCase()
    : DEFAULT_PROVIDER;

  switch (selected) {
    case "groq":
      return callOpenAICompatible({
        baseUrl: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: process.env.GROQ_API_KEY,
        apiKeyName: "GROQ_API_KEY",
        providerLabel: PROVIDER_LABEL.groq,
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        system,
        user,
        maxTokens,
      });
    case "gemini":
      return callGemini({ system, user, maxTokens });
    case "openai":
      return callOpenAICompatible({
        baseUrl: "https://api.openai.com/v1/chat/completions",
        apiKey: process.env.OPENAI_API_KEY,
        apiKeyName: "OPENAI_API_KEY",
        providerLabel: PROVIDER_LABEL.openai,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        system,
        user,
        maxTokens,
      });
    case "anthropic":
    default:
      return callAnthropic({ system, user, maxTokens });
  }
}

async function callAnthropic({ system, user, maxTokens }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      `Provider "${PROVIDER_LABEL.anthropic}" dipilih, tapi ANTHROPIC_API_KEY belum diset di environment variables server.`
    );
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

// Dipakai untuk OpenAI DAN Groq, karena Groq memakai format endpoint yang sama persis
// (OpenAI-compatible chat completions), hanya beda base URL, API key, dan nama model.
async function callOpenAICompatible({ baseUrl, apiKey, apiKeyName, model, system, user, maxTokens, providerLabel }) {
  if (!apiKey) {
    throw new Error(
      `Provider "${providerLabel}" dipilih, tapi ${apiKeyName} belum diset di environment variables server.`
    );
  }

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callGemini({ system, user, maxTokens }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      `Provider "${PROVIDER_LABEL.gemini}" dipilih, tapi GEMINI_API_KEY belum diset di environment variables server.`
    );
  }

  // "gemini-flash-latest" adalah alias resmi Google yang otomatis menunjuk ke
  // model Flash stabil terbaru -- dipakai sebagai default supaya tidak perlu
  // update manual tiap kali Google pensiunkan versi model lama (seperti yang
  // terjadi pada gemini-2.5-flash).
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("");
}

// Membersihkan output model agar berupa JSON murni (kadang model membungkus dengan ```json ... ```)
function parseJSONResponse(raw) {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

module.exports = { callAI, parseJSONResponse, VALID_PROVIDERS, PROVIDER_LABEL };
