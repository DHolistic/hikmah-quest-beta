import { sourceConfig, SESSION_KEY, saveSession, loadSession } from "./config.js";

// ─── Theme application ───────────────────────────────────────────────────────

export function applyTheme(themeId, variant = "day") {
  document.documentElement.dataset.theme = themeId ?? "quran";
  document.documentElement.dataset.variant = variant ?? "day";
}

// ─── Display options (bg zoom / pan) ────────────────────────────────────────
// Persists per-theme settings in localStorage under key "iq-bg-display".

function initDisplayOptions(initialThemeId) {
  const STORAGE_KEY = "iq-bg-display";
  const ZOOM_STEP   = 0.1;
  const PAN_STEP    = 30; // px

  const panel   = document.getElementById("iq-display-panel");
  const toggle  = document.getElementById("iq-display-toggle");
  const closeBtn= document.getElementById("iq-display-close");
  const bgLayer = document.querySelector(".iq-bg-layer");

  if (!panel || !bgLayer) return { onThemeChange() {} };

  let themeId = initialThemeId ?? document.documentElement.dataset.theme ?? "quran";
  let settings = loadSettings();

  function loadSettings() {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (all[themeId]) return all[themeId];
      const cs = getComputedStyle(bgLayer);
      const zoom = parseFloat(cs.getPropertyValue("--bg-zoom").trim()) || 1;
      const tx = parseInt(cs.getPropertyValue("--bg-tx").trim(), 10) || 0;
      const ty = parseInt(cs.getPropertyValue("--bg-ty").trim(), 10) || 0;
      return { zoom, tx, ty };
    } catch { return { zoom: 1, tx: 0, ty: 0 }; }
  }

  function saveSettings() {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      all[themeId] = settings;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {}
  }

  function applySettings() {
    bgLayer.style.setProperty("--bg-zoom", settings.zoom);
    bgLayer.style.setProperty("--bg-tx", `${settings.tx}px`);
    bgLayer.style.setProperty("--bg-ty", `${settings.ty}px`);
  }

  function openPanel() {
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    toggle?.classList.add("is-active");
    toggle?.setAttribute("aria-expanded", "true");
  }

  function closePanel() {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    toggle?.classList.remove("is-active");
    toggle?.setAttribute("aria-expanded", "false");
  }

  toggle?.addEventListener("click", () =>
    panel.classList.contains("is-open") ? closePanel() : openPanel()
  );
  closeBtn?.addEventListener("click", closePanel);

  panel.addEventListener("click", e => {
    const action = e.target.closest("[data-display-action]")?.dataset.displayAction;
    if (!action) return;

    switch (action) {
      case "zoom-in":    settings.zoom = Math.min(3, +(settings.zoom + ZOOM_STEP).toFixed(2)); break;
      case "zoom-out":   settings.zoom = Math.max(0.5, +(settings.zoom - ZOOM_STEP).toFixed(2)); break;
      case "pan-up":     settings.ty -= PAN_STEP; break;
      case "pan-down":   settings.ty += PAN_STEP; break;
      case "pan-left":   settings.tx -= PAN_STEP; break;
      case "pan-right":  settings.tx += PAN_STEP; break;
      case "reset-pan":  settings.tx = 0; settings.ty = 0; break;
      case "reset-all": {
        bgLayer.style.removeProperty("--bg-zoom");
        bgLayer.style.removeProperty("--bg-tx");
        bgLayer.style.removeProperty("--bg-ty");
        const cs = getComputedStyle(bgLayer);
        settings = {
          zoom: parseFloat(cs.getPropertyValue("--bg-zoom").trim()) || 1,
          tx: parseInt(cs.getPropertyValue("--bg-tx").trim(), 10) || 0,
          ty: parseInt(cs.getPropertyValue("--bg-ty").trim(), 10) || 0,
        };
        break;
      }
    }

    applySettings();
    saveSettings();
  });

  document.addEventListener("click", e => {
    if (
      panel.classList.contains("is-open") &&
      !panel.contains(e.target) &&
      e.target !== toggle
    ) closePanel();
  }, true);

  applySettings();

  return {
    onThemeChange(newThemeId) {
      themeId = newThemeId;
      settings = loadSettings();
      applySettings();
    },
  };
}

// ─── mode-select.html — Mode & Difficulty selector (Page 2 of 2) ──────────────

function initModeSelect() {
  const session = loadSession();
  if (!session || !session.sourceId) {
    location.href = "index.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const urlRealm = params.get("realm");
  const urlMode  = params.get("mode");
  if (urlRealm && sourceConfig[urlRealm]) {
    session.themeId = urlRealm;
    session.variant = "night";
  }

  applyTheme(session.themeId, session.variant);
  initDisplayOptions(session.themeId);

  const src = sourceConfig[session.sourceId];
  const isBonusRound = session.sourceId === "bonus";
  let selected = {
    sourceId:    session.sourceId,
    themeId:     session.themeId,
    mode:        (urlMode === "team" || urlMode === "solo") ? urlMode : (session.mode ?? "solo"),
    difficulty:  session.difficulty ?? "medium",
    variant:     session.variant,
    answerStyle: session.answerStyle ?? "guided",
  };

  // Update realm summary
  const realmName = document.getElementById("summary-realm-name");
  const realmDesc = document.getElementById("summary-realm-desc");
  if (realmName) realmName.textContent = src?.label ?? "Unknown";
  if (realmDesc) realmDesc.textContent = src?.description ?? "";

  const challengeBadge = document.getElementById("challenge-badge");
  const challengeTitle = document.getElementById("challenge-title");
  const challengeCopy = document.getElementById("challenge-copy");
  const journeyBtn = document.getElementById("iq-journey-btn");
  const teamHubGroup = document.getElementById("team-hub-group");
  const teamModeChip = document.querySelector('[data-mode="team"]');
  const guidedStyleChip = document.getElementById("guided-style-chip");

  if (isBonusRound) {
    selected.mode = "solo";
    if (challengeBadge) challengeBadge.textContent = "Bonus Round";
    if (challengeTitle) challengeTitle.textContent = "Allah's Names Bonus";
    if (challengeCopy) challengeCopy.textContent = "A separate bonus round focused on the Names of Allah. This stays distinct from the main Q&A realms.";
    if (guidedStyleChip) guidedStyleChip.textContent = "Name Reflection Round";
    if (journeyBtn) journeyBtn.textContent = "Begin Bonus Round →";
    if (teamModeChip) {
      teamModeChip.disabled = true;
      teamModeChip.style.display = "none";
    }
    if (teamHubGroup) teamHubGroup.style.display = "none";
  } else {
    if (challengeBadge) challengeBadge.textContent = "Challenge Settings";
    if (challengeTitle) challengeTitle.textContent = "Choose Your Challenge";
    if (challengeCopy) challengeCopy.textContent = "Guided deck formats for learning, with team rounds handled separately in the group hub";
    if (guidedStyleChip) guidedStyleChip.textContent = "Deck-Guided Learning";
    if (journeyBtn) journeyBtn.textContent = "Begin Q&A Round →";
    if (teamModeChip) {
      teamModeChip.disabled = false;
      teamModeChip.style.display = "";
    }
    if (teamHubGroup) teamHubGroup.style.display = "";
  }

  // Wire up mode, difficulty, and answer-style chips
  wireChips("[data-mode]", selected.mode, val => { selected.mode = val; });
  wireChips("[data-difficulty]", selected.difficulty, val => { selected.difficulty = val; });
  wireChips("[data-answer-style]", selected.answerStyle, val => { selected.answerStyle = val; });

  // Back button → return to index
  const backBtn = document.getElementById("iq-back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      location.href = "index.html";
    });
  }

  // Journey button → start gameplay
  if (journeyBtn) {
    journeyBtn.addEventListener("click", () => {
      saveSession(selected);
      location.href = "gameplay.html";
    });
  }

  const teamHubBtn = document.getElementById("iq-team-hub-btn");
  if (teamHubBtn) {
    teamHubBtn.addEventListener("click", e => {
      e.preventDefault();
      saveSession({ ...selected, mode: "team" });
      location.href = "team-beta2.html";
    });
  }
}

function chipValue(chip) {
  return chip.dataset.mode ?? chip.dataset.difficulty ?? chip.dataset.variant ?? chip.dataset.answerStyle;
}

function wireChips(selector, initialValue, onChange) {
  document.querySelectorAll(selector).forEach(chip => {
    const val = chipValue(chip);
    chip.classList.toggle("iq-chip--active", val === initialValue);
    chip.classList.toggle("is-selected", val === initialValue);
    chip.setAttribute("aria-pressed", val === initialValue);

    chip.addEventListener("click", () => {
      onChange(val);
      document.querySelectorAll(selector).forEach(c => {
        const cv = chipValue(c);
        c.classList.toggle("iq-chip--active", cv === val);
        c.classList.toggle("is-selected", cv === val);
        c.setAttribute("aria-pressed", cv === val);
      });
    });
  });
}

// Auto-boot on module load
initModeSelect();
