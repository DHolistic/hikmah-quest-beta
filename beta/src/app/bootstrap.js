import { sourceConfig, SESSION_KEY, saveSession, loadSession, getModeLabel, getDifficultyLabel } from "./config.js";
import { loadDeck, loadNamesDeck, loadUltimateDeck } from "../content/deck-loader.js";
import { createGameplayState } from "../gameplay/state.js";
import { revealName, revealAnswer, markCorrect, markIncorrect, markNameBonus, dismissNameBonus, skipCard, ptsForDifficulty, switchTurn } from "../gameplay/actions.js";
import { renderLeftTile, renderRightTile, renderScorebar, renderProgressBar } from "../gameplay/render.js";
import { triggerNoorPulse, rollBarakahCard, clearBarakahCard, triggerKnowledgeChain, updateBackdrop, resetBackdrop, initSoundPanel, initA11yPanel } from "./fx.js";
import { playCorrect, playMiss, playBonus, playStreak, playBarakah, playTurnSwitch, primeAudio } from "./sound.js";
import { showEncouragement } from "./encouragement.js";
import { initVerifyToggle } from "./verify-toggle.js";
import { showTurnSwitch } from "./turn-switch.js";
import { augmentDeckWithMcq } from "./mcq.js";

// ─── Display options (bg zoom / pan) ────────────────────────────────────────
// Persists per-theme settings in localStorage under key "iq-bg-display".
// Returns { onThemeChange(themeId) } so callers can reload settings on
// source switch (index page) without re-initialising the whole panel.

function initDisplayOptions(initialThemeId) {
  const STORAGE_KEY = "iq-bg-display";
  const ZOOM_STEP   = 0.1;
  const PAN_STEP    = 30; // px

  const panel   = document.getElementById("iq-display-panel");
  const toggle  = document.getElementById("iq-display-toggle");
  const closeBtn= document.getElementById("iq-display-close");
  const zoomVal = document.getElementById("iq-zoom-value");
  const bgLayer = document.querySelector(".iq-bg-layer");

  if (!panel || !bgLayer) return { onThemeChange() {} };

  let themeId = initialThemeId ?? document.documentElement.dataset.theme ?? "quran";
  let settings = loadSettings();

  // ── Persist helpers ──
  function loadSettings() {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (all[themeId]) return all[themeId];
      // No stored entry — clear any leftover inline vars so CSS defaults show through
      bgLayer.style.removeProperty("--bg-zoom");
      bgLayer.style.removeProperty("--bg-tx");
      bgLayer.style.removeProperty("--bg-ty");
      const cs   = getComputedStyle(bgLayer);
      const zoom = parseFloat(cs.getPropertyValue("--bg-zoom").trim()) || 1;
      const tx   = parseInt(cs.getPropertyValue("--bg-tx").trim(), 10)  || 0;
      const ty   = parseInt(cs.getPropertyValue("--bg-ty").trim(), 10)  || 0;
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

  // ── Apply CSS vars to bg layer ──
  function applySettings() {
    bgLayer.style.setProperty("--bg-zoom", settings.zoom);
    bgLayer.style.setProperty("--bg-tx",   `${settings.tx}px`);
    bgLayer.style.setProperty("--bg-ty",   `${settings.ty}px`);
    if (zoomVal) zoomVal.textContent = `${Math.round(settings.zoom * 100)}%`;
  }

  // ── Panel toggle ──
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

  // ── Control buttons ──
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
          tx:   parseInt(cs.getPropertyValue("--bg-tx").trim(), 10)  || 0,
          ty:   parseInt(cs.getPropertyValue("--bg-ty").trim(), 10)  || 0,
        };
        break;
      }
    }

    applySettings();
    saveSettings();
  });

  // ── Close on outside click ──
  document.addEventListener("click", e => {
    if (
      panel.classList.contains("is-open") &&
      !panel.contains(e.target) &&
      e.target !== toggle
    ) closePanel();
  }, true);

  // Initial apply
  applySettings();

  return {
    onThemeChange(newThemeId) {
      themeId  = newThemeId;
      settings = loadSettings();
      applySettings();
    },
  };
}

// ─── Theme application ───────────────────────────────────────────────────────

export function applyTheme(themeId, variant = "day") {
  document.documentElement.dataset.theme = themeId ?? "quran";
  document.documentElement.dataset.variant = variant ?? "day";
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function initApp() {
  const page = location.pathname.split("/").pop() || "index.html";

  if (page === "gameplay.html") return initGameplay();
  if (page === "results.html")  return initResults();
  if (page === "mode-select.html") return initModeSelect();
  return initIndex();
}

// ─── index.html — realm selector (Page 1 of 2) ────────────────────────────────

function initIndex() {
  const session = loadSession();
  let selected = {
    sourceId:   session?.sourceId   ?? null,
    themeId:    session?.themeId ?? "ultimate",
    mode:       session?.mode       ?? "solo",
    difficulty: session?.difficulty ?? "medium",
    variant:    session?.variant ?? "night",
  };

  applyTheme(selected.themeId, selected.variant);

  const display = initDisplayOptions(selected.themeId);
  let sourceOrder = Object.values(sourceConfig);
  let dragSrc     = null;

  const list = document.getElementById("iq-source-list");

  // ── Render source list ──────────────────────────────────────────────────────
  function renderSourceList() {
    if (!list) return;
    list.innerHTML = sourceOrder.map(src => `
      <li
        class="iq-source-item${selected.sourceId === src.id ? " is-selected" : ""}"
        draggable="true"
        role="radio"
        aria-checked="${selected.sourceId === src.id}"
        data-source="${src.id}"
        tabindex="0"
      >${src.label}</li>
    `).join("");

    list.querySelectorAll(".iq-source-item").forEach(item => {
      // Select on click or keyboard
      item.addEventListener("click",   () => selectSource(item.dataset.source));
      item.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectSource(item.dataset.source);
        }
      });

      // HTML5 drag-to-reorder
      item.addEventListener("dragstart", e => {
        dragSrc = item;
        item.classList.add("is-dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.dataset.source);
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("is-dragging");
        list.querySelectorAll(".iq-source-item").forEach(i => i.classList.remove("drag-over"));
        dragSrc = null;
      });

      item.addEventListener("dragover", e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (item !== dragSrc) {
          list.querySelectorAll(".iq-source-item").forEach(i => i.classList.remove("drag-over"));
          item.classList.add("drag-over");
        }
      });

      item.addEventListener("dragleave", () => item.classList.remove("drag-over"));

      item.addEventListener("drop", e => {
        e.preventDefault();
        if (!dragSrc || item === dragSrc) return;
        const fromIdx = sourceOrder.findIndex(s => s.id === dragSrc.dataset.source);
        const toIdx   = sourceOrder.findIndex(s => s.id === item.dataset.source);
        const [moved] = sourceOrder.splice(fromIdx, 1);
        sourceOrder.splice(toIdx, 0, moved);
        renderSourceList();
      });
    });
  }

  // ── Select a realm ──────────────────────────────────────────────────────────
  function selectSource(sourceId) {
    const src = sourceConfig[sourceId];
    if (!src) return;

    selected.sourceId = src.id;
    selected.themeId  = src.themeId;
    selected.variant  = src.variant;

    applyTheme(src.themeId, src.variant);
    display.onThemeChange(src.themeId);
    
    const title = document.getElementById("realm-title");
    const desc  = document.getElementById("realm-desc");
    const badge = document.getElementById("realm-badge");
    if (title) title.textContent = src.label;
    if (desc)  desc.textContent  = src.description;
    if (badge) badge.textContent  = src.label.toUpperCase();

    // Enable next button
    const nextBtn = document.getElementById("iq-next-btn");
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.removeAttribute("aria-disabled");
    }

    renderSourceList();
  }

  renderSourceList();

  // Restore previous selection if any
  if (selected.sourceId && sourceConfig[selected.sourceId]) {
    selectSource(selected.sourceId);
  }

  // ── Next button → navigate to mode-select.html ──
  const nextBtn = document.getElementById("iq-next-btn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      saveSession(selected);
      location.href = `mode-select.html?realm=${selected.themeId}`;
    });
  }
}

function chipValue(chip) {
  return chip.dataset.mode ?? chip.dataset.difficulty ?? chip.dataset.variant;
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

// ─── gameplay.html ───────────────────────────────────────────────────────────

async function initGameplay() {
  const session = loadSession();
  if (!session) { location.href = "index.html"; return; }

  applyTheme(session.themeId, session.variant);
  initDisplayOptions(session.themeId);
  resetBackdrop();

  // Prime audio on first interaction
  document.addEventListener("pointerdown", primeAudio, { once: true });

  const config = sourceConfig[session.sourceId] ?? sourceConfig.quran;

  const realmLabel = document.getElementById("realm-label");
  if (realmLabel) realmLabel.textContent = `${config.symbol} ${config.label}`;
  const [rawRightDeck, leftDeck] = await Promise.all([
    loadDeck(config, session.difficulty),
    loadNamesDeck(),
  ]);

  // MCQ augmentation: when the user picks Multiple Choice, attach options +
  // correctIndex to every card that doesn't already have them.
  const answerStyle = session.answerStyle ?? "reveal";
  const rightDeck = answerStyle === "mcq"
    ? augmentDeckWithMcq(rawRightDeck)
    : rawRightDeck;

  let state = createGameplayState(rightDeck, leftDeck, session.mode, {
    difficulty: session.difficulty ?? "medium",
  });
  state.answerStyle = answerStyle;
  document.documentElement.dataset.answerStyle = answerStyle;

  // Provides current card context to the inline Beta Feedback modal script in gameplay.html.
  window.__iqGetCurrentCard = () => {
    const card = state.rightDeck?.[state.index];
    if (!card) return null;
    return {
      id:           card.id ?? "",
      packId:       card.packId ?? "",
      nameOfAllah:  card.nameOfAllah ?? "",
      nameMeaning:  card.nameMeaning ?? "",
      pack:         card.packId ?? card.subTheme ?? "",
      deckName:     card.deckName ?? config.label ?? "",
      category:     card.category ?? "",
      difficulty:   state.difficulty ?? "",
      referenceHint:card.referenceHint ?? card.sourceTitle ?? "",
      promptText:   card.promptText ?? card.question ?? "",
      answerText:   card.answerText ?? card.answer ?? "",
      sourceTitle:  card.sourceTitle ?? "",
      question:     card.question ?? "",
    };
  };

  const verifyToggle = initVerifyToggle({ getCard: window.__iqGetCurrentCard });

  const leftEl     = document.getElementById("iq-tile-left");
  const rightEl    = document.getElementById("iq-tile-right");
  const scoreEl    = document.getElementById("iq-scorebar");
  const progressEl = document.getElementById("iq-progress");

  // ── Side rail wiring — left: name actions, right: score actions ──────────
  const leftRail  = document.getElementById("iq-side-left");
  const rightRail = document.getElementById("iq-side-right");

  leftRail?.addEventListener("click", e => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "revealName"    && handlers.onRevealName)    handlers.onRevealName();
    if (action === "nameCorrect"   && handlers.onNameCorrect)   handlers.onNameCorrect();
    if (action === "nameIncorrect" && handlers.onNameIncorrect) handlers.onNameIncorrect();
  });

  rightRail?.addEventListener("click", e => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "revealAnswer" && handlers.onRevealAnswer) handlers.onRevealAnswer();
    if (action === "correct"      && handlers.onCorrect)      handlers.onCorrect();
    if (action === "incorrect"    && handlers.onIncorrect)    handlers.onIncorrect();
  });

  function syncSideRails() {
    const nameRevealed   = state.nameRevealed;
    const answerRevealed = state.revealStage === "answer";

    // Left rail: show Reveal Name → swap to ✗/✓ after name revealed
    const revealNameBtn = leftRail?.querySelector('[data-action="revealName"]');
    if (revealNameBtn) revealNameBtn.style.display = nameRevealed ? "none" : "";
    leftRail?.querySelectorAll(".iq-medallion").forEach(btn => {
      btn.style.display = nameRevealed ? "" : "none";
      btn.disabled = !nameRevealed || state.nameBonusClaimed;
    });

    // Right rail: show Reveal Answer → swap to ✗/✓ after answer revealed
    const revealAnswerBtn = rightRail?.querySelector('[data-action="revealAnswer"]');
    if (revealAnswerBtn) revealAnswerBtn.style.display = answerRevealed ? "none" : "";
    rightRail?.querySelectorAll(".iq-medallion").forEach(btn => {
      btn.style.display = answerRevealed ? "" : "none";
      btn.disabled = !answerRevealed;
    });
  }

  // ── Action dock: draggable scoring panel ──────────────────────────────────
  const dock      = document.getElementById("iq-action-dock");
  const grip      = document.getElementById("iq-dock-grip");
  const revealRow = document.getElementById("iq-dock-reveal-row");
  const nameRow   = document.getElementById("iq-dock-name-row");
  const scoreRow  = document.getElementById("iq-dock-score-row");
  const utilityRow= document.getElementById("iq-dock-utility-row");
  const DOCK_KEY  = "iq-dock-pos";
  const mobileDockQuery = window.matchMedia("(max-width: 600px)");

  // Restore saved position
  (function restoreDockPos() {
    try {
      const saved = JSON.parse(localStorage.getItem(DOCK_KEY));
      if (saved && dock) {
        dock.style.left      = saved.left;
        dock.style.top       = saved.top;
        dock.style.bottom    = "auto";
        dock.style.transform = "none";
      }
    } catch {}
  })();

  // Drag logic (mouse + touch)
  if (grip && dock) {
    let dragging = false, ox = 0, oy = 0;

    function startDrag(cx, cy) {
      dragging = true;
      const r  = dock.getBoundingClientRect();
      ox = cx - r.left;
      oy = cy - r.top;
      dock.style.transform = "none";
      dock.style.bottom    = "auto";
    }

    function moveDrag(cx, cy) {
      if (!dragging) return;
      const left = Math.max(0, Math.min(window.innerWidth  - dock.offsetWidth,  cx - ox));
      const top  = Math.max(0, Math.min(window.innerHeight - dock.offsetHeight, cy - oy));
      dock.style.left = left + "px";
      dock.style.top  = top  + "px";
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      try { localStorage.setItem(DOCK_KEY, JSON.stringify({ left: dock.style.left, top: dock.style.top })); } catch {}
    }

    grip.addEventListener("mousedown",  e => { e.preventDefault(); startDrag(e.clientX, e.clientY); });
    document.addEventListener("mousemove", e => moveDrag(e.clientX, e.clientY));
    document.addEventListener("mouseup",   endDrag);

    grip.addEventListener("touchstart",  e => { startDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    document.addEventListener("touchmove",  e => { if (dragging) { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
    document.addEventListener("touchend",   endDrag);
  }

  // Wire dock button clicks
  if (dock) {
    dock.addEventListener("click", e => {
      const action = e.target.closest("[data-dock-action]")?.dataset.dockAction;
      if (action === "revealName"    && handlers.onRevealName)    handlers.onRevealName();
      if (action === "revealAnswer"  && handlers.onRevealAnswer)  handlers.onRevealAnswer();
      if (action === "correct"       && handlers.onCorrect)       handlers.onCorrect();
      if (action === "incorrect"     && handlers.onIncorrect)     handlers.onIncorrect();
      if (action === "nameCorrect"   && handlers.onNameCorrect)   handlers.onNameCorrect();
      if (action === "nameIncorrect" && handlers.onNameIncorrect) handlers.onNameIncorrect();
      if (action === "skip"          && handlers.onSkip)          handlers.onSkip();
    });
  }

  function syncDock() {
    if (!dock || !revealRow || !nameRow || !scoreRow || !utilityRow) return;

    const isMobile = mobileDockQuery.matches;
    const answerStyle = state.answerStyle ?? "reveal";
    const nameNeedsScore = state.nameRevealed && !state.nameBonusClaimed;
    const answerNeedsScore = answerStyle !== "mcq" && state.revealStage === "answer";
    const canRevealName = !state.nameRevealed;
    const canRevealAnswer = state.revealStage !== "answer";
    const hasAnyDockAction =
      canRevealName ||
      canRevealAnswer ||
      nameNeedsScore ||
      answerNeedsScore ||
      !state.isComplete;

    if (!isMobile || !hasAnyDockAction) {
      revealRow.style.display = "none";
      nameRow.style.display = "none";
      scoreRow.style.display = "none";
      utilityRow.style.display = "none";
      dock.style.display = "none";
      dock.dataset.mobileActive = "false";
      return;
    }

    dock.style.top = "";
    dock.style.left = "";
    dock.style.bottom = "";
    dock.style.transform = "";

    const revealNameBtn = revealRow.querySelector('[data-dock-action="revealName"]');
    const revealAnswerBtn = revealRow.querySelector('[data-dock-action="revealAnswer"]');
    if (revealNameBtn) revealNameBtn.style.display = canRevealName ? "" : "none";
    if (revealAnswerBtn) revealAnswerBtn.style.display = canRevealAnswer ? "" : "none";

    revealRow.style.display = canRevealName || canRevealAnswer ? "flex" : "none";
    nameRow.style.display = nameNeedsScore ? "flex" : "none";
    scoreRow.style.display = answerNeedsScore ? "flex" : "none";
    utilityRow.style.display = state.isComplete ? "none" : "flex";
    dock.style.display = "flex";
    dock.dataset.mobileActive = "true";
  }

  // ── Score float toast ──
  function showToast(pts, label) {
    const el = document.getElementById("iq-toast");
    if (!el) return;
    const sign = pts > 0 ? "+" : "";
    el.innerHTML = `
      <div class="iq-toast__pts${pts === 0 ? " iq-toast__pts--miss" : ""}">${sign}${pts} pt${pts !== 1 ? "s" : ""}</div>
      <div class="iq-toast__label">${label}</div>
    `;
    el.classList.remove("is-visible");
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add("is-visible");
    setTimeout(() => el.classList.remove("is-visible"), 1900);
  }

  const handlers = {
    onRevealName:    () => { state = revealName(state); redraw(); },
    onRevealAnswer:  () => { state = revealAnswer(state); redraw(); },
    onCorrect: () => {
      showToast(ptsForDifficulty(state.difficulty), "Correct!");
      state = markCorrect(state);
      // FX: streak pulse every 3
      const isStreak = state.streak > 0 && state.streak % 3 === 0;
      triggerNoorPulse(isStreak);
      if (isStreak) playStreak(state.streak); else playCorrect();
      showEncouragement({ streak: state.streak });
      // Knowledge chain: left tile → right tile on streak ≥ 2
      if (state.streak >= 2) {
        const fromEl = document.getElementById("iq-tile-left");
        const toEl   = document.getElementById("iq-tile-right");
        triggerKnowledgeChain(fromEl, toEl);
      }
      updateBackdrop(state.correctCards, state.totalCards ?? state.rightDeck?.length ?? 1);
      clearBarakahCard();
      if (state.mode === "team") { state = switchTurn(state); playTurnSwitch(); showTurnSwitch(state.turn); }
      checkComplete();
      redraw();
      // Roll Barakah for NEXT card after redraw
      requestAnimationFrame(() => {
        const rightEl2 = document.getElementById("iq-tile-right");
        if (rollBarakahCard(rightEl2)) playBarakah();
      });
    },
    onIncorrect: () => {
      showToast(0, "Missed");
      playMiss();
      state = markIncorrect(state);
      clearBarakahCard();
      if (state.mode === "team") { state = switchTurn(state); playTurnSwitch(); showTurnSwitch(state.turn); }
      checkComplete();
      redraw();
    },
    onNameCorrect: () => {
      showToast(1, "Allah Name · Bonus");
      triggerNoorPulse(false);
      playBonus();
      state = markNameBonus(state);
      redraw();
    },
    onNameIncorrect: () => { state = dismissNameBonus(state); redraw(); },
    onSkip:          () => { clearBarakahCard(); state = skipCard(state); checkComplete(); redraw(); },
    onMcqPick: (idx) => {
      const card = state.rightDeck?.[state.index];
      if (!card || typeof card.correctIndex !== "number") return;
      // Auto-reveal so the answer + correct option highlight before advance
      state = revealAnswer(state);
      redraw();
      // Brief delay so the user sees which one was correct
      setTimeout(() => {
        if (idx === card.correctIndex) handlers.onCorrect();
        else handlers.onIncorrect();
      }, 650);
    },
  };

  function redraw() {
    if (leftEl)     renderLeftTile(leftEl, state, handlers);
    if (rightEl)    renderRightTile(rightEl, state, handlers);
    if (scoreEl)    renderScorebar(scoreEl, state);
    if (progressEl) renderProgressBar(progressEl, state);
    syncSideRails();
    syncDock();
    verifyToggle?.sync();
  }

  function checkComplete() {
    if (state.isComplete) {
      saveSession({
        ...session,
        soloScore:    state.soloScore,
        streak:       state.streak,
        teamScoreA:   state.teamScoreA,
        teamScoreB:   state.teamScoreB,
        correctCards: state.correctCards,
        missedCards:  state.missedCards,
        missedCount:  state.missedCards.length,
        totalCards:   state.totalCards,
      });
      setTimeout(() => { location.href = "results.html"; }, 400);
    }
  }

  redraw();
  if (typeof mobileDockQuery.addEventListener === "function") {
    mobileDockQuery.addEventListener("change", redraw);
  } else if (typeof mobileDockQuery.addListener === "function") {
    mobileDockQuery.addListener(redraw);
  }

  // Init FX panels
  initSoundPanel();
  initA11yPanel();
}

// ─── results.html ────────────────────────────────────────────────────────────

function initResults() {
  const session = loadSession();
  if (!session) { location.href = "index.html"; return; }

  applyTheme(session.themeId, session.variant);
  initDisplayOptions(session.themeId);

  const src     = sourceConfig[session.sourceId];
  const total   = session.totalCards   ?? 0;
  const correct = session.correctCards ?? 0;
  const pct     = total ? Math.round((correct / total) * 100) : 0;

  // Tagline based on accuracy — no emoji icon (per design direction).
  const tagline = pct >= 90 ? "Excellent, māshāAllāh!" : pct >= 60 ? "Well done!" : "Keep practising — every card is dhikr.";
  setText("results-icon",       "");
  setText("results-tagline",    tagline);

  setText("iq-results-source",  src ? src.label : "");
  setText("iq-results-score",   session.soloScore  ?? 0);
  setText("iq-results-streak",  session.streak      ?? 0);
  setText("iq-results-correct", total ? `${pct}%` : "—");
  setText("iq-results-missed",  session.missedCount  ?? 0);
  setText("iq-results-total",   total);
  setText("iq-results-mode",    getModeLabel(session.mode));
  setText("iq-results-diff",    getDifficultyLabel(session.difficulty));

  if (session.mode === "team") {
    setText("iq-results-team-a", session.teamScoreA ?? 0);
    setText("iq-results-team-b", session.teamScoreB ?? 0);
  }

  // Missed cards list
  const missedList = document.getElementById("missed-list");
  if (missedList) {
    const missed = session.missedCards ?? [];
    if (missed.length === 0) {
      missedList.innerHTML = '<p class="iq-missed-empty">No missed cards — perfect round!</p>';
    } else {
    missedList.innerHTML = missed.map(card => `
        <div class="iq-missed-card" role="listitem">
          ${card.symbol ? `<p class="iq-missed-card__question">${esc(card.symbol)} ${esc(card.symbolName ?? "")}</p>` : ""}
          <p class="iq-missed-card__question">${esc(card.promptText ?? "")}</p>
          <p class="iq-missed-card__answer">${esc(card.answerText ?? "")}</p>
          ${card.sourceTitle ? `<p class="iq-missed-card__source">${esc(card.sourceTitle)}</p>` : ""}
        </div>
      `).join("");
    }
  }

  document.getElementById("iq-play-again-btn")
    ?.addEventListener("click", () => {
      saveSession({ ...session, sourceId: session.sourceId });
      location.href = "gameplay.html";
    });

  document.getElementById("iq-change-source-btn")
    ?.addEventListener("click", () => {
      location.href = "index.html";
    });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Auto-boot on module load
initApp();
