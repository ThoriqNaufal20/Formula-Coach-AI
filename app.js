// app.js — logika interaktif Formula Coach

const state = { activeTab: "explain" };

const el = {
  formulaInput: document.getElementById("formulaInput"),
  formulaBar: document.getElementById("formulaBar"),
  cellRef: document.getElementById("cellRef"),
  tabs: document.querySelectorAll(".tab"),
  panels: {
    explain: document.getElementById("panel-explain"),
    fix: document.getElementById("panel-fix"),
    generate: document.getElementById("panel-generate"),
  },
  explainForm: document.getElementById("explainForm"),
  explainContext: document.getElementById("explainContext"),
  explainSubmit: document.getElementById("explainSubmit"),
  explainResult: document.getElementById("explainResult"),
  explainSkeleton: document.getElementById("explainSkeleton"),
  explainError: document.getElementById("explainError"),
  fixForm: document.getElementById("fixForm"),
  fixErrorInput: document.getElementById("fixError"),
  fixContext: document.getElementById("fixContext"),
  fixSubmit: document.getElementById("fixSubmit"),
  fixResult: document.getElementById("fixResult"),
  fixSkeleton: document.getElementById("fixSkeleton"),
  fixError2: document.getElementById("fixError2"),
  toast: document.getElementById("toast"),
  providerSelect: document.getElementById("providerSelect"),
  providerDot: document.getElementById("providerDot"),
  themeToggle: document.getElementById("themeToggle"),
  sheetGrid: document.getElementById("sheetGrid"),
  gridResetBtn: document.getElementById("gridResetBtn"),
  chatThread: document.getElementById("chatThread"),
  chatEmpty: document.getElementById("chatEmpty"),
  chatHistoryCount: document.getElementById("chatHistoryCount"),
  generateForm: document.getElementById("generateForm"),
  generateQuestion: document.getElementById("generateQuestion"),
  generateSubmit: document.getElementById("generateSubmit"),
};

// =====================================================================
// THEME TOGGLE (dark = Graphite Warm default, light = Slate Modern)
// =====================================================================
const THEME_STORAGE_KEY = "formula-coach:theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

(function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(saved === "light" ? "light" : "dark");
})();

el.themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "light" ? "dark" : "light");
});

// =====================================================================
// TAB SWITCHING
// =====================================================================
el.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    if (target === state.activeTab) return;

    el.tabs.forEach((t) => {
      t.classList.toggle("active", t === tab);
      t.setAttribute("aria-selected", t === tab ? "true" : "false");
    });

    Object.entries(el.panels).forEach(([key, panel]) => {
      const isActive = key === target;
      panel.classList.toggle("active", isActive);
      panel.hidden = !isActive;
    });

    state.activeTab = target;

    // Formula bar hanya relevan untuk mode Jelaskan/Perbaiki
    el.formulaBar.classList.toggle("is-hidden", target === "generate");

    if (target === "fix") {
      el.formulaInput.placeholder = "=VLOOKUP(A2, Data!A:D, 3, FALSE";
    } else if (target === "explain") {
      el.formulaInput.placeholder = "=VLOOKUP(A2, Data!A:D, 3, FALSE)";
    }
  });
});

let cellCounter = 1;
el.formulaInput.addEventListener("focus", () => {
  el.cellRef.textContent = "A" + cellCounter;
});

// =====================================================================
// HELPERS
// =====================================================================
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (el.toast.hidden = true), 2200);
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Permintaan gagal (${res.status})`);
  }
  return data;
}

function setLoading(kind, isLoading) {
  const submitBtn = kind === "explain" ? el.explainSubmit : el.fixSubmit;
  const skeleton = kind === "explain" ? el.explainSkeleton : el.fixSkeleton;
  const result = kind === "explain" ? el.explainResult : el.fixResult;
  const errBox = kind === "explain" ? el.explainError : el.fixError2;

  submitBtn.disabled = isLoading;
  skeleton.hidden = !isLoading;
  if (isLoading) {
    result.hidden = true;
    errBox.hidden = true;
  }
}

// =====================================================================
// PROVIDER SELECTOR
// =====================================================================
const PROVIDER_STORAGE_KEY = "formula-coach:provider";

async function initProviderSelector() {
  const saved = localStorage.getItem(PROVIDER_STORAGE_KEY);
  if (saved) el.providerSelect.value = saved;

  try {
    const res = await fetch("/api/providers");
    const data = await res.json();

    if (!saved && data.defaultProvider) {
      el.providerSelect.value = data.defaultProvider;
    }

    [...el.providerSelect.options].forEach((opt) => {
      const configured = data.status?.[opt.value];
      const baseLabel = opt.textContent.replace(" (belum dikonfigurasi)", "");
      opt.textContent = configured ? baseLabel : `${baseLabel} (belum dikonfigurasi)`;
    });

    updateProviderDot(data.status?.[el.providerSelect.value]);
  } catch {
    // Kalau endpoint status gagal diakses, dropdown tetap bisa dipakai apa adanya
  }
}

function updateProviderDot(isConfigured) {
  if (isConfigured === false) {
    el.providerDot.classList.add("unconfigured");
    el.providerDot.title = "API key untuk provider ini belum diset di server";
  } else {
    el.providerDot.classList.remove("unconfigured");
    el.providerDot.title = "Provider siap dipakai";
  }
}

el.providerSelect.addEventListener("change", () => {
  localStorage.setItem(PROVIDER_STORAGE_KEY, el.providerSelect.value);
  fetch("/api/providers")
    .then((r) => r.json())
    .then((data) => updateProviderDot(data.status?.[el.providerSelect.value]))
    .catch(() => {});
});

initProviderSelector();

// =====================================================================
// EXPLAIN FORM
// =====================================================================
el.explainForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formula = el.formulaInput.value.trim();

  if (!formula) {
    showToast("Isi dulu formulanya di formula bar ya.");
    el.formulaInput.focus();
    return;
  }

  setLoading("explain", true);
  cellCounter++;

  try {
    const data = await postJSON("/api/explain", {
      formula,
      context: el.explainContext.value,
      provider: el.providerSelect.value,
    });
    renderExplainResult(data);
  } catch (err) {
    el.explainError.textContent = err.message;
    el.explainError.hidden = false;
  } finally {
    setLoading("explain", false);
  }
});

function renderExplainResult(data) {
  const parts = (data.bagian || [])
    .map(
      (p) => `
      <div class="part-item">
        <span class="part-code">${escapeHTML(p.kode)}</span>
        <span class="part-desc">${escapeHTML(p.penjelasan)}</span>
      </div>`
    )
    .join("");

  el.explainResult.innerHTML = `
    <div class="result-block">
      <p class="result-eyebrow">Ringkasan</p>
      <p class="result-summary">${escapeHTML(data.ringkasan)}</p>
    </div>
    <div class="result-block">
      <p class="result-eyebrow">Bagian per bagian</p>
      <div class="part-list">${parts}</div>
    </div>
    ${data.contoh_kasus ? `<div class="result-block"><p class="result-eyebrow">Contoh kasus</p><p class="result-text">${escapeHTML(data.contoh_kasus)}</p></div>` : ""}
    ${data.catatan ? `<div class="result-block"><p class="result-eyebrow">Catatan</p><p class="result-text">${escapeHTML(data.catatan)}</p></div>` : ""}
  `;
  el.explainResult.hidden = false;
}

// =====================================================================
// FIX FORM
// =====================================================================
el.fixForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formula = el.formulaInput.value.trim();

  if (!formula) {
    showToast("Isi dulu formulanya di formula bar ya.");
    el.formulaInput.focus();
    return;
  }

  setLoading("fix", true);
  cellCounter++;

  try {
    const data = await postJSON("/api/fix", {
      formula,
      errorMessage: el.fixErrorInput.value,
      context: el.fixContext.value,
      provider: el.providerSelect.value,
    });
    renderFixResult(data);
  } catch (err) {
    el.fixError2.textContent = err.message;
    el.fixError2.hidden = false;
  } finally {
    setLoading("fix", false);
  }
});

function renderFixResult(data) {
  el.fixResult.innerHTML = `
    <div class="result-block">
      <span class="error-type-tag">${escapeHTML(data.jenis_kesalahan)}</span>
      <p class="result-text">${escapeHTML(data.diagnosis)}</p>
    </div>
    <div class="result-block">
      <p class="result-eyebrow">Formula perbaikan</p>
      <div class="formula-result-box">
        <span class="formula-result-code" id="fixedFormulaText">${escapeHTML(data.formula_perbaikan)}</span>
        <button type="button" class="copy-btn" id="copyFixedBtn">Salin</button>
      </div>
    </div>
    <div class="result-block">
      <p class="result-eyebrow">Kenapa ini memperbaiki masalah</p>
      <p class="result-text">${escapeHTML(data.penjelasan_perbaikan)}</p>
    </div>
    ${data.tips_pencegahan ? `<div class="result-block"><p class="result-eyebrow">Supaya tidak terulang</p><p class="result-text">${escapeHTML(data.tips_pencegahan)}</p></div>` : ""}
  `;
  el.fixResult.hidden = false;

  document.getElementById("copyFixedBtn").addEventListener("click", () => {
    navigator.clipboard
      .writeText(data.formula_perbaikan)
      .then(() => showToast("Formula disalin ke clipboard."))
      .catch(() => showToast("Gagal menyalin. Salin manual saja."));
  });
}

// =====================================================================
// GENERATE FORMULA — grid + chat
// =====================================================================
const GRID_STORAGE_KEY = "formula-coach:grid";
const HISTORY_STORAGE_KEY = "formula-coach:generate-history";
const MAX_HISTORY = 10;
const GRID_ROWS = 5;
const GRID_COLS = 5;
const COL_LETTERS = ["A", "B", "C", "D", "E"];

function loadGrid() {
  try {
    const raw = localStorage.getItem(GRID_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* abaikan, pakai grid kosong */
  }
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(""));
}

function saveGrid(gridValues) {
  localStorage.setItem(GRID_STORAGE_KEY, JSON.stringify(gridValues));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* abaikan */
  }
  return [];
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}

let gridValues = loadGrid();
let chatHistory = loadHistory();

function renderGrid() {
  el.sheetGrid.innerHTML = "";

  // Baris header kolom (A-E) dengan sudut kosong di kiri atas
  const corner = document.createElement("div");
  corner.className = "sheet-cell corner";
  el.sheetGrid.appendChild(corner);

  COL_LETTERS.forEach((letter) => {
    const colHead = document.createElement("div");
    colHead.className = "sheet-cell colhead";
    colHead.textContent = letter;
    el.sheetGrid.appendChild(colHead);
  });

  for (let r = 0; r < GRID_ROWS; r++) {
    const rowHead = document.createElement("div");
    rowHead.className = "sheet-cell rowhead";
    rowHead.textContent = r + 1;
    el.sheetGrid.appendChild(rowHead);

    for (let c = 0; c < GRID_COLS; c++) {
      const cellWrap = document.createElement("div");
      cellWrap.className = "sheet-cell" + (r === 0 ? " sheet-row-1" : "");

      const input = document.createElement("input");
      input.className = "sheet-input";
      input.type = "text";
      input.value = gridValues[r][c] || "";
      input.placeholder = r === 0 ? "Header" : "";
      input.dataset.row = r;
      input.dataset.col = c;

      input.addEventListener("input", () => {
        gridValues[r][c] = input.value;
        saveGrid(gridValues);
      });

      cellWrap.appendChild(input);
      el.sheetGrid.appendChild(cellWrap);
    }
  }
}

el.gridResetBtn.addEventListener("click", () => {
  gridValues = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(""));
  saveGrid(gridValues);
  renderGrid();
  showToast("Grid dikosongkan.");
});

function gridToPayload() {
  return {
    headers: gridValues[0],
    rows: gridValues.slice(1),
  };
}

function renderChatThread() {
  el.chatThread.innerHTML = "";
  el.chatHistoryCount.textContent = `${chatHistory.length}/${MAX_HISTORY}`;

  if (chatHistory.length === 0) {
    el.chatThread.appendChild(el.chatEmpty);
    return;
  }

  chatHistory.forEach((entry) => {
    const userBubble = document.createElement("div");
    userBubble.className = "bubble-user";
    userBubble.textContent = entry.question;
    el.chatThread.appendChild(userBubble);

    const aiBubble = document.createElement("div");
    aiBubble.className = "bubble-ai";
    aiBubble.innerHTML = `
      <div class="formula-result-box">
        <span class="formula-result-code">${escapeHTML(entry.formula)}</span>
        <button type="button" class="copy-btn copy-history-btn" data-formula="${escapeHTML(entry.formula)}">Salin</button>
      </div>
      <p class="result-text">${escapeHTML(entry.penjelasan)}</p>
    `;
    el.chatThread.appendChild(aiBubble);
  });

  el.chatThread.querySelectorAll(".copy-history-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigator.clipboard
        .writeText(btn.dataset.formula)
        .then(() => showToast("Formula disalin ke clipboard."))
        .catch(() => showToast("Gagal menyalin. Salin manual saja."));
    });
  });

  el.chatThread.scrollTop = el.chatThread.scrollHeight;
}

function addChatSkeleton() {
  const skeleton = document.createElement("div");
  skeleton.className = "chat-skeleton";
  skeleton.id = "chatSkeleton";
  skeleton.innerHTML = `
    <div class="sk-line w-70"></div>
    <div class="sk-line w-50"></div>
  `;
  el.chatThread.appendChild(skeleton);
  el.chatThread.scrollTop = el.chatThread.scrollHeight;
}

function removeChatSkeleton() {
  document.getElementById("chatSkeleton")?.remove();
}

el.generateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = el.generateQuestion.value.trim();

  if (!question) {
    showToast("Tulis dulu apa yang mau kamu hitung atau cari.");
    el.generateQuestion.focus();
    return;
  }

  const hasHeader = gridValues[0].some((cell) => cell.trim());
  if (!hasHeader) {
    showToast("Isi dulu minimal baris header di grid contoh data.");
    return;
  }

  // Tampilkan bubble pertanyaan user segera, sebelum respons AI datang
  const userBubbleTemp = document.createElement("div");
  userBubbleTemp.className = "bubble-user";
  userBubbleTemp.textContent = question;
  if (chatHistory.length === 0) el.chatThread.innerHTML = "";
  el.chatThread.appendChild(userBubbleTemp);
  addChatSkeleton();

  el.generateSubmit.disabled = true;
  el.generateQuestion.value = "";

  try {
    const data = await postJSON("/api/generate", {
      grid: gridToPayload(),
      question,
      history: chatHistory.map((h) => ({ question: h.question, formula: h.formula })),
      provider: el.providerSelect.value,
    });

    chatHistory.push({ question, formula: data.formula, penjelasan: data.penjelasan });
    if (chatHistory.length > MAX_HISTORY) {
      chatHistory = chatHistory.slice(chatHistory.length - MAX_HISTORY);
    }
    saveHistory(chatHistory);
    renderChatThread();
  } catch (err) {
    removeChatSkeleton();
    userBubbleTemp.remove();
    showToast(err.message || "Gagal membuat formula.");
    if (chatHistory.length === 0) renderChatThread();
  } finally {
    el.generateSubmit.disabled = false;
  }
});

renderGrid();
renderChatThread();
