// app.js — logika interaktif Formula Coach

const state = { activeTab: "explain" };

const el = {
  formulaInput: document.getElementById("formulaInput"),
  cellRef: document.getElementById("cellRef"),
  tabs: document.querySelectorAll(".tab"),
  panels: {
    explain: document.getElementById("panel-explain"),
    fix: document.getElementById("panel-fix"),
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
};

// ---- Provider selection ------------------------------------------
const PROVIDER_STORAGE_KEY = "formula-coach:provider";

async function initProviderSelector() {
  // Pulihkan pilihan terakhir peserta (kalau ada)
  const saved = localStorage.getItem(PROVIDER_STORAGE_KEY);
  if (saved) el.providerSelect.value = saved;

  try {
    const res = await fetch("/api/providers");
    const data = await res.json();

    // Kalau belum ada pilihan tersimpan, ikuti default server
    if (!saved && data.defaultProvider) {
      el.providerSelect.value = data.defaultProvider;
    }

    // Tandai di label opsi mana yang API key-nya belum diset di server
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

// ---- Tab switching -------------------------------------------------
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
    el.formulaInput.placeholder =
      target === "explain"
        ? "=VLOOKUP(A2, Data!A:D, 3, FALSE)"
        : "=VLOOKUP(A2, Data!A:D, 3, FALSE"; // contoh formula tak lengkap untuk mode perbaikan
  });
});

// Sinkronkan name box formula bar dengan panjang input (kesan hidup, ringan)
let cellCounter = 1;
el.formulaInput.addEventListener("focus", () => {
  el.cellRef.textContent = "A" + cellCounter;
});

// ---- Helpers ---------------------------------------------------------
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

// ---- Explain form ------------------------------------------------
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
    ${
      data.contoh_kasus
        ? `<div class="result-block">
            <p class="result-eyebrow">Contoh kasus</p>
            <p class="result-text">${escapeHTML(data.contoh_kasus)}</p>
          </div>`
        : ""
    }
    ${
      data.catatan
        ? `<div class="result-block">
            <p class="result-eyebrow">Catatan</p>
            <p class="result-text">${escapeHTML(data.catatan)}</p>
          </div>`
        : ""
    }
  `;
  el.explainResult.hidden = false;
}

// ---- Fix form ------------------------------------------------------
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
    ${
      data.tips_pencegahan
        ? `<div class="result-block">
            <p class="result-eyebrow">Supaya tidak terulang</p>
            <p class="result-text">${escapeHTML(data.tips_pencegahan)}</p>
          </div>`
        : ""
    }
  `;
  el.fixResult.hidden = false;

  document.getElementById("copyFixedBtn").addEventListener("click", () => {
    navigator.clipboard
      .writeText(data.formula_perbaikan)
      .then(() => showToast("Formula disalin ke clipboard."))
      .catch(() => showToast("Gagal menyalin. Salin manual saja."));
  });
}
