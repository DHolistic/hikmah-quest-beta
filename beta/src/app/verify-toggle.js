/* ═══════════════════════════════════════════════════════════════
   ILM QUEST · CARD VERIFICATION TOGGLE
   Subtle ✓ chip — Donya marks each card whose Q&A she's eyeballed
   and confirmed correct. Persists to localStorage; export later.
   Complementary to the أستغفر الله beta-feedback modal:
     – Modal: file detailed issue (wrong answer, bad reference)
     – Chip:  fast positive confirmation that this card is good
   ═══════════════════════════════════════════════════════════════ */

const STORE_KEY = "iq-verified-cards";

function loadSet() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function saveSet(set) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...set]));
  } catch {}
}

function cardKey(card) {
  if (!card) return null;
  if (card.id) return String(card.id);
  // Fallback for cards without explicit id
  const q = (card.promptText ?? card.question ?? "").slice(0, 60);
  return `${card.packId ?? ""}|${card.nameOfAllah ?? ""}|${q}`;
}

export function initVerifyToggle({ getCard }) {
  const chip = document.createElement("button");
  chip.id = "iq-verify-chip";
  chip.className = "iq-verify-chip";
  chip.type = "button";
  chip.setAttribute("aria-pressed", "false");
  chip.setAttribute("title", "Mark this card's Q&A as reviewed");
  chip.innerHTML = `
    <span class="iq-verify-chip__icon" aria-hidden="true">✓</span>
    <span class="iq-verify-chip__count" aria-hidden="true">0</span>
    <span class="iq-verify-chip__sr">Mark Q&A reviewed</span>
  `;
  document.body.appendChild(chip);

  let set = loadSet();

  function sync() {
    const card = getCard?.();
    const key = cardKey(card);
    const has = key && set.has(key);
    chip.classList.toggle("is-on", !!has);
    chip.setAttribute("aria-pressed", has ? "true" : "false");
    chip.dataset.cardKey = key ?? "";
    chip.querySelector(".iq-verify-chip__count").textContent = String(set.size);
    chip.disabled = !key;
  }

  chip.addEventListener("click", () => {
    const key = chip.dataset.cardKey;
    if (!key) return;
    if (set.has(key)) set.delete(key);
    else set.add(key);
    saveSet(set);
    sync();
  });

  // Expose a quick export hook for Donya's review workflow
  window.__iqVerifyExport = () => ({
    count: set.size,
    ids: [...set],
    json: JSON.stringify([...set], null, 2),
  });

  sync();
  return { sync };
}
