/* ═══════════════════════════════════════════════════════════════
   HQUEST · FX CONTROLLER
   Noor Pulse · Barakah Card · Knowledge Chain · Backdrop Evolution
   Sound Panel · Accessibility Panel UI
   ═══════════════════════════════════════════════════════════════ */

import { getSoundMode, setSoundMode, SOUND_MODES, primeAudio } from "./sound.js";

// ─── Reduce-motion helper ────────────────────────────────────────────────
function motionOk() {
  if (document.documentElement.dataset.reduceMotion === "1") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ─── Noor Pulse ──────────────────────────────────────────────────────────
/**
 * Flash a radial gold glow across the viewport.
 * @param {boolean} [isStreak=false] — use the longer streak variant
 */
export function triggerNoorPulse(isStreak = false) {
  if (!motionOk()) return;

  const el = document.createElement("div");
  el.className = "fx-noor-pulse" + (isStreak ? " fx-noor-pulse--streak" : "");
  document.body.appendChild(el);

  const dur = isStreak ? 1100 : 700;
  setTimeout(() => el.remove(), dur + 50);
}

// ─── Barakah Card ────────────────────────────────────────────────────────
// Disabled: the green shimmer overlapped the answer text and read as a "flash."
// Set chance back to 0.10 to re-enable; particle/style code kept intact below.
const BARAKAH_CHANCE = 0;
let _barakahCardEl   = null;

/**
 * Roll for a Barakah card event on the given right-tile element.
 * Returns true if Barakah was triggered (caller should play sound).
 * @param {HTMLElement} rightTileEl
 * @returns {boolean}
 */
export function rollBarakahCard(rightTileEl) {
  clearBarakahCard();
  if (!rightTileEl) return false;
  if (Math.random() > BARAKAH_CHANCE) return false;

  rightTileEl.classList.add("fx-barakah-active");
  _barakahCardEl = rightTileEl;

  if (motionOk()) _spawnBarakahParticles(rightTileEl);
  return true;
}

/** Remove Barakah state from previously blessed tile */
export function clearBarakahCard() {
  if (_barakahCardEl) {
    _barakahCardEl.classList.remove("fx-barakah-active");
    _barakahCardEl = null;
  }
}

function _spawnBarakahParticles(tileEl) {
  const rect  = tileEl.getBoundingClientRect();
  const count = 10;

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const p   = document.createElement("div");
      p.className = "fx-barakah-particle";
      const sx  = rect.left + Math.random() * rect.width;
      const sy  = rect.top  + Math.random() * rect.height;
      const tx  = (Math.random() - 0.5) * 80;
      const ty  = -(30 + Math.random() * 60);
      const dur = 1.2 + Math.random() * 0.8;
      p.style.cssText = `left:${sx}px; top:${sy}px; --tx:${tx}px; --ty:${ty}px; --dur:${dur}s;`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), dur * 1000 + 50);
    }, i * 60);
  }
}

// ─── Knowledge Chain ─────────────────────────────────────────────────────
let _chainSvg    = null;
let _chainTimer  = null;

/**
 * Draw a golden thread from one avatar/tile element to another.
 * Used when consecutive correct answers build a "knowledge chain."
 * @param {HTMLElement} fromEl
 * @param {HTMLElement} toEl
 */
export function triggerKnowledgeChain(fromEl, toEl) {
  if (!motionOk()) return;
  clearKnowledgeChain();
  if (!fromEl || !toEl) return;

  const fromR = fromEl.getBoundingClientRect();
  const toR   = toEl.getBoundingClientRect();

  const x1 = fromR.left + fromR.width  / 2;
  const y1 = fromR.top  + fromR.height / 2;
  const x2 = toR.left   + toR.width    / 2;
  const y2 = toR.top    + toR.height   / 2;

  // Control point arcs upward
  const cx = (x1 + x2) / 2;
  const cy = Math.min(y1, y2) - 60;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "fx-chain-svg");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "fx-chain-path");
  path.setAttribute("d", `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);

  // Set stroke-dasharray to actual path length after appending
  svg.appendChild(path);
  document.body.appendChild(svg);
  _chainSvg = svg;

  requestAnimationFrame(() => {
    const len = path.getTotalLength();
    path.style.strokeDasharray  = len;
    path.style.strokeDashoffset = len;
    // Force reflow
    void path.getBoundingClientRect();
    path.style.transition = "stroke-dashoffset 0.8s ease-out";
    path.style.strokeDashoffset = "0";
  });

  // Auto-clear after display
  _chainTimer = setTimeout(() => clearKnowledgeChain(), 2200);
}

export function clearKnowledgeChain() {
  if (_chainTimer) { clearTimeout(_chainTimer); _chainTimer = null; }
  if (_chainSvg)   { _chainSvg.remove(); _chainSvg = null; }
}

// ─── Backdrop Evolution ───────────────────────────────────────────────────
/**
 * Update the scene luminance based on game progress.
 * @param {number} correctCards — number correct so far
 * @param {number} totalCards   — total cards in deck
 */
export function updateBackdrop(correctCards, totalCards) {
  if (!totalCards) return;
  const ratio     = Math.min(1, correctCards / totalCards);
  const luminance = Math.pow(ratio, 1.4);  // ease-in curve — bright at end
  document.documentElement.style.setProperty("--scene-luminance", luminance.toFixed(3));
}

export function resetBackdrop() {
  document.documentElement.style.setProperty("--scene-luminance", "0");
}

// ─── Sound Panel UI ───────────────────────────────────────────────────────
const SOUND_ICONS = {
  [SOUND_MODES.FULL]:    "🔊",
  [SOUND_MODES.MINIMAL]: "🔉",
  [SOUND_MODES.SILENT]:  "🔇",
  [SOUND_MODES.HAPTIC]:  "📳",
};

const SOUND_LABELS = {
  [SOUND_MODES.FULL]:    "Full",
  [SOUND_MODES.MINIMAL]: "Minimal",
  [SOUND_MODES.SILENT]:  "Silent",
  [SOUND_MODES.HAPTIC]:  "Haptic only",
};

export function initSoundPanel() {
  const panel = document.createElement("div");
  panel.className = "iq-sound-panel";
  panel.setAttribute("aria-label", "Sound settings");

  const toggleBtn = document.createElement("button");
  toggleBtn.className   = "iq-sound-toggle";
  toggleBtn.title       = "Sound settings";
  toggleBtn.setAttribute("aria-label", "Sound settings");
  toggleBtn.setAttribute("aria-expanded", "false");

  const drawer = document.createElement("div");
  drawer.className = "iq-sound-drawer";

  const drawerLabel = document.createElement("div");
  drawerLabel.className = "iq-sound-drawer__label";
  drawerLabel.textContent = "Sound";
  drawer.appendChild(drawerLabel);

  function syncToggleIcon() {
    toggleBtn.textContent = SOUND_ICONS[getSoundMode()] ?? "🔊";
    toggleBtn.setAttribute("aria-label", `Sound: ${SOUND_LABELS[getSoundMode()]}`);
  }

  function buildModeButtons() {
    // Remove existing mode buttons
    drawer.querySelectorAll(".iq-sound-mode-btn").forEach(b => b.remove());

    Object.values(SOUND_MODES).forEach(mode => {
      const btn = document.createElement("button");
      btn.className   = "iq-sound-mode-btn" + (getSoundMode() === mode ? " is-active" : "");
      btn.textContent = `${SOUND_ICONS[mode]} ${SOUND_LABELS[mode]}`;
      btn.dataset.mode = mode;
      btn.setAttribute("aria-pressed", getSoundMode() === mode);
      btn.addEventListener("click", () => {
        setSoundMode(mode);
        primeAudio();
        syncToggleIcon();
        buildModeButtons();
      });
      drawer.appendChild(btn);
    });
  }

  buildModeButtons();

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = drawer.classList.toggle("is-open");
    toggleBtn.setAttribute("aria-expanded", open);
    if (open) primeAudio();
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target)) {
      drawer.classList.remove("is-open");
      toggleBtn.setAttribute("aria-expanded", "false");
    }
  }, true);

  panel.appendChild(drawer);
  panel.appendChild(toggleBtn);
  document.body.appendChild(panel);
  syncToggleIcon();
}

// ─── Accessibility Panel UI ───────────────────────────────────────────────
export function initA11yPanel() {
  const panel = document.createElement("div");
  panel.className = "iq-a11y-panel";
  panel.setAttribute("aria-label", "Accessibility settings");

  const toggleBtn = document.createElement("button");
  toggleBtn.className   = "iq-a11y-toggle";
  toggleBtn.textContent = "♿";
  toggleBtn.title       = "Accessibility settings";
  toggleBtn.setAttribute("aria-label", "Accessibility settings");
  toggleBtn.setAttribute("aria-expanded", "false");

  const drawer = document.createElement("div");
  drawer.className = "iq-a11y-drawer";

  const drawerLabel = document.createElement("div");
  drawerLabel.className = "iq-a11y-drawer__label";
  drawerLabel.textContent = "Accessibility";
  drawer.appendChild(drawerLabel);

  // Helper to build a toggle row
  function makeToggleRow(labelText, storageKey, onToggle) {
    const stored = localStorage.getItem(storageKey) === "1";

    const row = document.createElement("div");
    row.className = "iq-a11y-row";

    const span  = document.createElement("span");
    span.textContent = labelText;

    const label  = document.createElement("label");
    label.className = "iq-a11y-switch";

    const input   = document.createElement("input");
    input.type    = "checkbox";
    input.checked = stored;
    input.setAttribute("aria-label", labelText);

    const slider  = document.createElement("span");
    slider.className = "iq-a11y-switch__slider";

    input.addEventListener("change", () => {
      const val = input.checked ? "1" : "0";
      try { localStorage.setItem(storageKey, val); } catch {}
      onToggle(input.checked);
    });

    label.appendChild(input);
    label.appendChild(slider);
    row.appendChild(span);
    row.appendChild(label);
    drawer.appendChild(row);

    // Apply stored state immediately
    onToggle(stored);
    return { input };
  }

  makeToggleRow("Reduce motion", "iq-reduce-motion", (on) => {
    document.documentElement.dataset.reduceMotion = on ? "1" : "0";
  });

  makeToggleRow("Mute effects", "iq-mute-effects", (on) => {
    if (on) setSoundMode(SOUND_MODES.SILENT);
    // Don't restore mode here — user can pick via sound panel
  });

  makeToggleRow("High contrast", "iq-high-contrast", (on) => {
    document.documentElement.dataset.highContrast = on ? "1" : "0";
  });

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = drawer.classList.toggle("is-open");
    toggleBtn.setAttribute("aria-expanded", open);
  });

  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target)) {
      drawer.classList.remove("is-open");
      toggleBtn.setAttribute("aria-expanded", "false");
    }
  }, true);

  panel.appendChild(toggleBtn);
  panel.appendChild(drawer);
  document.body.appendChild(panel);
}
