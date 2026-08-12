// api/_ai.js
// Helper bersama untuk memanggil provider AI.
// Provider bisa dipilih dengan dua cara:
//   1. Dropdown di UI (dikirim dari frontend lewat body.provider) -- prioritas utama
//   2. Env var AI_PROVIDER di server -- dipakai kalau frontend tidak mengirim pilihan
// Nilai yang valid: "groq" (gratis) | "gemini" (gratis) | "anthropic" (berbayar) | "openai" (berbayar)

const VALID_PROVIDERS = ["groq", "gemini", "anthropic", "openai"];
const DEFAULT_PROVIDER = (process.env.AI_PROVIDER || "groq").toLowerCase();

// Provider AI kadang sedang sibuk sesaat (mis. Gemini "high demand" / 503,
// atau rate limit 429) -- ini bersifat sementara, bukan error kode. Wrapper
// ini otomatis coba ulang SEKALI setelah jeda singkat sebelum benar-benar
// melempar error ke peserta.
async function fetchWithRetry(url, options, { retries = 1, delayMs = 1200 } = {}) {
  let lastRes;
  for (let attempt = 0; attempt <= retries; attempt++) {
    lastRes = await fetch(url, options);
    if (lastRes.ok) return lastRes;

    const isTransient = lastRes.status === 429 || (lastRes.status >= 500 && lastRes.status <= 599);
    if (!isTransient || attempt === retries) return lastRes;

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return lastRes;
}

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

  const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
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

  const res = await fetchWithRetry(baseUrl, {
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

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      // Field thinkingConfig/thinkingBudget berbeda-beda tergantung generasi model
      // Gemini (2.5 vs 3.x pakai nama & nilai parameter yang berbeda, dan kalau
      // salah field/nilai malah bikin error 400 INVALID_ARGUMENT). Daripada
      // menebak parameter yang bisa berubah lagi di masa depan, jatah token
      // dibuat jauh lebih besar supaya walau sebagian terpakai untuk proses
      // berpikir internal model, masih cukup sisa untuk jawaban JSON-nya.
      generationConfig: {
        maxOutputTokens: Math.max(maxTokens * 3, 2048),
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const finishReason = data.candidates?.[0]?.finishReason;

  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      "Gemini kehabisan jatah token sebelum selesai menjawab (kemungkinan besar habis untuk proses berpikir internal model). Coba lagi, atau ganti provider AI di dropdown."
    );
  }

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
