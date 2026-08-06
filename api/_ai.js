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
      // Model Gemini terbaru (2.5+/3.x) mengaktifkan "thinking" secara default,
      // dan token untuk berpikir itu dipotong dari jatah maxOutputTokens yang sama.
      // Untuk tugas terstruktur sederhana seperti ini, thinking dimatikan (budget 0)
      // supaya seluruh jatah token dipakai penuh untuk jawaban JSON -- bukan
      // habis duluan buat proses berpikir internal lalu jawabannya kepotong.
      generationConfig: {
        maxOutputTokens: maxTokens,
        thinkingConfig: { thinkingBudget: 0 },
      },
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
  return JSON.parse(sanitizeJSONControlChars(cleaned));
}

// AI kadang menaruh baris baru/tab ASLI di dalam value string (bukan \n ter-escape),
// misal di teks penjelasan yang panjang. JSON tidak mengizinkan itu dan bikin error
// "Unterminated string". Fungsi ini menelusuri karakter satu per satu, dan HANYA
// meng-escape newline/tab kalau posisinya ada di DALAM string JSON (di luar string,
// whitespace aman diabaikan oleh JSON.parse jadi tidak disentuh).
function sanitizeJSONControlChars(str) {
  let result = "";
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escapeNext) {
      result += ch;
      escapeNext = false;
      continue;
    }
    if (ch === "\\") {
      result += ch;
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString && ch === "\n") { result += "\\n"; continue; }
    if (inString && ch === "\r") { result += "\\r"; continue; }
    if (inString && ch === "\t") { result += "\\t"; continue; }

    result += ch;
  }

  return result;
}

// Wrapper yang meminta AI menjawab dalam JSON dan otomatis mem-parsenya.
// Kalau parse gagal (paling sering karena tanda kutip di dalam formula, mis.
// =SUMIF(A:A,"Elektronik",B:B), tidak di-escape dengan benar oleh model, atau
// respons terpotong), coba SEKALI LAGI dengan instruksi yang lebih tegas
// sebelum benar-benar menyerah.
async function callAIJson({ system, user, maxTokens = 1024, provider }) {
  const raw = await callAI({ system, user, maxTokens, provider });

  try {
    return parseJSONResponse(raw);
  } catch (firstError) {
    const retryUser = `${user}

PENTING: jawaban sebelumnya bukan JSON yang valid dan gagal di-parse (${firstError.message}).
Balas ULANG hanya dengan satu objek JSON yang valid, tanpa markdown, tanpa teks lain di luar JSON.
Kalau ada tanda kutip ganda di dalam value string (misalnya di dalam formula seperti
=SUMIF(A:A,"Elektronik",B:B)), WAJIB di-escape jadi \\" supaya struktur JSON tidak rusak.`;

    const retryRaw = await callAI({ system, user: retryUser, maxTokens, provider });

    try {
      return parseJSONResponse(retryRaw);
    } catch (secondError) {
      throw new Error(
        `AI mengembalikan format yang tidak valid setelah 2 percobaan (${secondError.message}). Coba ulangi permintaan, atau ganti provider AI di dropdown.`
      );
    }
  }
}

module.exports = { callAI, callAIJson, parseJSONResponse, VALID_PROVIDERS, PROVIDER_LABEL };
