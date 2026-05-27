import { sourceConfig, MAIN_SOURCE_IDS, SESSION_KEY, saveSession, loadSession, getModeLabel, getDifficultyLabel } from "./config.js";
import { loadDeck } from "../content/deck-loader.js";
import { createGameplayState } from "../gameplay/state.js";
import { revealAnswer, markCorrect, markIncorrect, skipCard, ptsForDifficulty, switchTurn } from "../gameplay/actions.js";
import { renderRightTile, renderScorebar, renderProgressBar } from "../gameplay/render.js";
import { triggerNoorPulse, rollBarakahCard, clearBarakahCard, triggerKnowledgeChain, updateBackdrop, resetBackdrop, initSoundPanel, initA11yPanel } from "./fx.js";
import { playCorrect, playMiss, playBonus, playStreak, playBarakah, playTurnSwitch, primeAudio } from "./sound.js";
import { showEncouragement } from "./encouragement.js";
import { initVerifyToggle } from "./verify-toggle.js";
import { showTurnSwitch } from "./turn-switch.js";
import { augmentDeckWithMcq } from "./mcq.js";
import { getActiveRoom } from "./multiplayer.js";

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
  let sourceOrder = MAIN_SOURCE_IDS.map(id => sourceConfig[id]).filter(Boolean);
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

  const bonusBtn = document.getElementById("iq-bonus-btn");
  if (bonusBtn) {
    bonusBtn.addEventListener("click", () => {
      const bonus = sourceConfig.bonus;
      const bonusSession = {
        sourceId: bonus.id,
        themeId: bonus.themeId,
        mode: "solo",
        difficulty: "medium",
        variant: bonus.variant,
        answerStyle: "guided",
      };
      saveSession(bonusSession);
      location.href = `mode-select.html?realm=${bonus.themeId}`;
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
  document.getElementById("page-gameplay")?.classList.add("iq-page--single-trivia");

  const realmLabel = document.getElementById("realm-label");
  if (realmLabel) realmLabel.textContent = `${config.symbol} ${config.label}`;
  const rawRightDeck = await loadDeck(config, session.difficulty);

  const answerStyle = "guided";
  const rightDeck = rawRightDeck.map(card => {
    if (card.questionType === "multiple-choice" && !card.options?.length) {
      return augmentDeckWithMcq([card, ...rawRightDeck])[0];
    }
    return card;
  });

  let state = createGameplayState(rightDeck, [], session.mode, {
    difficulty: session.difficulty ?? "medium",
    shuffleDecks: false,
    teamName: session.teamName ?? "",
    roundSeconds: Number(session.roundSeconds ?? 0),
    roundTimeLeft: Number(session.roundSeconds ?? 0),
  });
  state.answerStyle = answerStyle;
  document.documentElement.dataset.answerStyle = answerStyle;
  const room = getActiveRoom();
  const timerEnabled = Number(session.roundSeconds ?? 0) > 0;
  let timerId = null;
  let lastBroadcastIndex = -1;

  function stopRoundTimer() {
    if (!timerId) return;
    clearInterval(timerId);
    timerId = null;
  }

  function startRoundTimer() {
    if (!timerEnabled || state.isComplete) return;
    const startedAt = Date.now();
    const roundMs = Number(session.roundSeconds ?? 0) * 1000;
    timerId = setInterval(() => {
      if (state.isComplete) {
        stopRoundTimer();
        return;
      }
      const elapsed = Date.now() - startedAt;
      const leftMs = Math.max(0, roundMs - elapsed);
      const leftSec = Math.ceil(leftMs / 1000);
      if (leftSec !== state.roundTimeLeft) {
        state = { ...state, roundTimeLeft: leftSec };
        redraw();
      }
      if (leftMs <= 0) {
        state = { ...state, roundTimeLeft: 0, isComplete: true };
        checkComplete();
      }
    }, 250);
  }

  function broadcastTournamentState() {
    if (!room || room.role !== "host") return;

    room.sendScoreUpdate({
      teamA: state.teamScoreA,
      teamB: state.teamScoreB,
      solo: state.soloScore,
      correctCards: state.correctCards,
      missedCount: state.missedCards.length,
      roundTimeLeft: state.roundTimeLeft ?? 0,
      totalCards: state.totalCards,
    });
    room.sendTurnChange(state.turn);

    if (state.index !== lastBroadcastIndex) {
      lastBroadcastIndex = state.index;
      const currentCard = state.rightDeck?.[state.index];
      room.sendCardEvent({
        index: state.index,
        total: state.totalCards,
        roundTimeLeft: state.roundTimeLeft ?? 0,
        nameOfAllah: currentCard?.transliterationText ?? "",
        promptText: currentCard?.promptText ?? currentCard?.question ?? "",
      });
    }
  }

  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let activeRecognition = null;

  function stopActiveRecognition() {
    if (!activeRecognition) return;
    try { activeRecognition.onresult = null; } catch {}
    try { activeRecognition.onerror = null; } catch {}
    try { activeRecognition.onend = null; } catch {}
    try { activeRecognition.stop(); } catch {}
    activeRecognition = null;
  }

  function normalizedTokens(text) {
    return String(text ?? "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/\p{M}/gu, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(token => token.length > 1);
  }

  async function primeMicrophoneAccess() {
    if (!window.isSecureContext) {
      return "Voice input needs a secure page (HTTPS or localhost).";
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return null;
    } catch (err) {
      const reason = err?.name || "unknown-error";
      if (reason === "NotAllowedError" || reason === "SecurityError") {
        return "Microphone access was blocked. Allow mic permission and try again.";
      }
      if (reason === "NotFoundError" || reason === "DevicesNotFoundError") {
        return "No microphone was found on this device.";
      }
      return `Microphone setup failed: ${reason}.`;
    }
  }

  function scoreSpeechTranscript(transcript, targets) {
    const spoken = normalizedTokens(transcript);
    if (!spoken.length) return 0;

    let best = 0;
    for (const target of targets) {
      const expected = normalizedTokens(target);
      if (!expected.length) continue;
      const matched = expected.filter(token => spoken.includes(token)).length;
      best = Math.max(best, matched / expected.length);
    }
    return best;
  }

  // Provides current card context to the inline Beta Feedback modal script in gameplay.html.
  window.__iqGetCurrentCard = () => {
    const card = state.rightDeck?.[state.index];
    if (!card) return null;
    return {
      id:           card.id ?? "",
      packId:       card.packId ?? "",
      nameOfAllah:  card.transliterationText ?? "",
      nameMeaning:  "",
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

  const rightEl    = document.getElementById("iq-tile-right");
  const scoreEl    = document.getElementById("iq-scorebar");
  const progressEl = document.getElementById("iq-progress");

  // ── Side rail wiring — left: name actions, right: score actions ──────────
  const rightRail = document.getElementById("iq-side-right");

  rightRail?.addEventListener("click", e => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "revealAnswer" && handlers.onRevealAnswer) handlers.onRevealAnswer();
    if (action === "correct"      && handlers.onCorrect)      handlers.onCorrect();
    if (action === "incorrect"    && handlers.onIncorrect)    handlers.onIncorrect();
  });

  function syncSideRails() {
    const answerRevealed = state.revealStage === "answer";

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
      if (action === "revealAnswer"  && handlers.onRevealAnswer)  handlers.onRevealAnswer();
      if (action === "correct"       && handlers.onCorrect)       handlers.onCorrect();
      if (action === "incorrect"     && handlers.onIncorrect)     handlers.onIncorrect();
      if (action === "skip"          && handlers.onSkip)          handlers.onSkip();
    });
  }

  function syncDock() {
    if (!dock || !revealRow || !scoreRow || !utilityRow) return;

    const isMobile = mobileDockQuery.matches;
    const answerStyle = state.answerStyle ?? "reveal";
    const answerNeedsScore = answerStyle !== "mcq" && state.revealStage === "answer";
    const canRevealAnswer = state.revealStage !== "answer";
    const hasAnyDockAction =
      canRevealAnswer ||
      answerNeedsScore ||
      !state.isComplete;

    if (!isMobile || !hasAnyDockAction) {
      revealRow.style.display = "none";
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

    const revealAnswerBtn = revealRow.querySelector('[data-dock-action="revealAnswer"]');
    if (revealAnswerBtn) revealAnswerBtn.style.display = canRevealAnswer ? "" : "none";

    revealRow.style.display = canRevealAnswer ? "flex" : "none";
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
    onRevealAnswer:  () => { stopActiveRecognition(); state = revealAnswer(state); redraw(); },
    onCorrect: () => {
      stopActiveRecognition();
      const awardedPts = ptsForDifficulty(state.difficulty);
      showToast(awardedPts, "Correct!");
      state = markCorrect(state);
      // FX: streak pulse every 3
      const isStreak = state.streak > 0 && state.streak % 3 === 0;
      triggerNoorPulse(isStreak);
      if (isStreak) playStreak(state.streak); else playCorrect();
      showEncouragement({ streak: state.streak });
      updateBackdrop(state.correctCards, state.totalCards ?? state.rightDeck?.length ?? 1);
      clearBarakahCard();
      if (state.mode === "team") { state = switchTurn(state); playTurnSwitch(); showTurnSwitch(state.turn); }
      if (room) room.sendAnswerCorrect(awardedPts);
      checkComplete();
      redraw();
      // Roll Barakah for NEXT card after redraw
      requestAnimationFrame(() => {
        const rightEl2 = document.getElementById("iq-tile-right");
        if (rollBarakahCard(rightEl2)) playBarakah();
      });
    },
    onIncorrect: () => {
      stopActiveRecognition();
      showToast(0, "Missed");
      playMiss();
      state = markIncorrect(state);
      clearBarakahCard();
      if (state.mode === "team") { state = switchTurn(state); playTurnSwitch(); showTurnSwitch(state.turn); }
      if (room) room.sendAnswerMiss();
      checkComplete();
      redraw();
    },
    onSkip:          () => { stopActiveRecognition(); clearBarakahCard(); state = skipCard(state); checkComplete(); redraw(); },
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
    onSequencePick: (idx) => {
      const card = state.rightDeck?.[state.index];
      if (!card?.sequenceOptions?.length) return;
      if (state.sequenceSelection.includes(idx)) return;

      const sequenceSelection = [...state.sequenceSelection, idx];
      state = { ...state, sequenceSelection };
      redraw();

      if (sequenceSelection.length !== card.sequenceSteps?.length) return;
      const chosen = sequenceSelection.map(i => card.sequenceOptions[i]);
      const correct = chosen.every((step, i) => step === card.sequenceSteps[i]);
      state = revealAnswer(state);
      redraw();
      setTimeout(() => {
        if (correct) handlers.onCorrect();
        else handlers.onIncorrect();
      }, 700);
    },
    onMatchLeftPick: (label) => {
      state = { ...state, pendingMatchLeft: label };
      redraw();
    },
    onMatchRightPick: (label) => {
      const card = state.rightDeck?.[state.index];
      if (!card?.matchPairs?.length || !state.pendingMatchLeft) return;
      const expected = card.matchPairs.find(pair => pair.left === state.pendingMatchLeft);
      const resolvedPair = {
        left: state.pendingMatchLeft,
        right: label,
        correct: expected?.right === label,
      };
      const matchedPairs = [...state.matchedPairs, resolvedPair];
      state = { ...state, matchedPairs, pendingMatchLeft: null };
      redraw();

      if (matchedPairs.length !== card.matchPairs.length) return;
      const allCorrect = matchedPairs.every(pair => pair.correct);
      state = revealAnswer(state);
      redraw();
      setTimeout(() => {
        if (allCorrect) handlers.onCorrect();
        else handlers.onIncorrect();
      }, 700);
    },
    onSpeechStart: async preferredLocale => {
      const card = state.rightDeck?.[state.index];
      if (!card) return;

      stopActiveRecognition();

      if (!SpeechRecognitionCtor) {
        state = {
          ...state,
          speechStatus: "unsupported",
          speechError: "Voice recognition is not available on this browser/device.",
        };
        redraw();
        return;
      }

      const micAccessError = await primeMicrophoneAccess();
      if (micAccessError) {
        state = {
          ...state,
          speechStatus: "error",
          speechError: micAccessError,
          speechLocale: preferredLocale || card.speechLocales?.[0] || "en-US",
        };
        redraw();
        return;
      }

      const speechLocale = preferredLocale || card.speechLocales?.[0] || "en-US";
      const recognition = new SpeechRecognitionCtor();
      activeRecognition = recognition;
      recognition.lang = speechLocale;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      state = {
        ...state,
        speechStatus: "listening",
        speechError: "",
        speechTranscript: "",
        speechScore: 0,
        speechLocale,
      };
      redraw();

      recognition.onresult = event => {
        const transcript = Array.from(event.results)
          .map(result => result[0]?.transcript || "")
          .join(" ")
          .trim();
        const targets = [
          ...(card.speechTargets || []),
          card.answerText || "",
          card.transliterationText || "",
          card.themeAnchorText || "",
          card.arabicText || "",
        ].filter(Boolean);
        const score = scoreSpeechTranscript(transcript, targets);
        state = {
          ...state,
          speechTranscript: transcript,
          speechScore: score,
          speechStatus: "scored",
          speechError: "",
        };
        state = revealAnswer(state);
        redraw();
        setTimeout(() => {
          if (score >= (card.accuracyThreshold ?? 0.67)) handlers.onCorrect();
          else handlers.onIncorrect();
        }, 900);
      };

      recognition.onerror = event => {
        const rawError = event.error || "unknown-error";
        const hints = {
          "not-allowed": "Microphone permission was denied.",
          "audio-capture": "No microphone audio was captured.",
          "no-speech": "No speech was detected. Try again closer to the mic.",
          "network": "Voice recognition could not reach the browser speech service.",
        };
        state = {
          ...state,
          speechStatus: "error",
          speechError: hints[rawError] || `Voice input error: ${rawError}.`,
        };
        redraw();
      };

      recognition.onend = () => {
        activeRecognition = null;
        if (state.speechStatus === "listening") {
          state = {
            ...state,
            speechStatus: "ended",
            speechError: state.speechError || (Array.isArray(card.speechLocales) && card.speechLocales.length > 1
              ? "No voice transcript was captured. Try the other mic mode."
              : "No voice transcript was captured."),
          };
          redraw();
        }
      };

      recognition.start();
    },
  };

  function redraw() {
    if (rightEl)    renderRightTile(rightEl, state, handlers);
    if (scoreEl)    renderScorebar(scoreEl, state);
    if (progressEl) renderProgressBar(progressEl, state);
    syncSideRails();
    syncDock();
    verifyToggle?.sync();
    broadcastTournamentState();
  }

  function checkComplete() {
    if (state.isComplete) {
      stopRoundTimer();
      const achievementUnlocks = [];
      if ((state.correctCards ?? 0) >= 3) achievementUnlocks.push("3 Correct Streak");
      if ((state.missedCards?.length ?? 0) === 0 && (state.correctCards ?? 0) > 0) achievementUnlocks.push("Perfect Round");
      if ((state.streak ?? 0) >= 5) achievementUnlocks.push("Knowledge Chain x5");
      if ((state.mode === "team") && ((state.teamScoreA ?? 0) > 0 || (state.teamScoreB ?? 0) > 0)) achievementUnlocks.push("Team Battle Winner");

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
        roundTimeLeft: state.roundTimeLeft ?? 0,
        achievementUnlocks,
      });
      if (room && room.role === "host") {
        room.sendGameComplete({
          teamA: state.teamScoreA,
          teamB: state.teamScoreB,
          solo: state.soloScore,
          correctCards: state.correctCards,
          missedCount: state.missedCards.length,
        });
      }
      setTimeout(() => { location.href = "results.html"; }, 400);
    }
  }

  startRoundTimer();
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

  const ACHIEVE_KEY = "hq-tournament-achievements-v1";
  const unlocked = Array.isArray(session.achievementUnlocks) ? session.achievementUnlocks : [];
  if (unlocked.length) {
    try {
      const existing = JSON.parse(localStorage.getItem(ACHIEVE_KEY) ?? "[]");
      const safeExisting = Array.isArray(existing) ? existing : [];
      const stamp = new Date().toLocaleDateString();
      const merged = safeExisting.concat(unlocked.map(name => ({ name, when: stamp })));
      localStorage.setItem(ACHIEVE_KEY, JSON.stringify(merged.slice(-30)));
    } catch {}
  }

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
