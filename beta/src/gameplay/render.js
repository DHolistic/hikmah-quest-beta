// ─── Left tile (99 Names bonus) — Ornate Arch layout ─────────────────────────

export function renderLeftTile(container, state, handlers = {}) {
  const { left, right } = getCurrentPair(state);
  if (!left) { container.innerHTML = ""; return; }

  const { arabic, transliteration, meaning } = left;
  const revealed = state.nameRevealed;
  const linkedBadge = right
    ? `Linked Name · ${formatCategory(right.category)} · ${formatDifficulty(right.difficulty)}`
    : "Linked Name";

  container.innerHTML = `
    <div class="iq-tile iq-tile--left${revealed ? " is-revealed" : ""}">
      <div class="iq-arch-wrap">
        <div class="iq-arch-top">
          <div class="iq-arch-halo"></div>
          <div class="iq-arch-inner">
            <span class="iq-arch-ornament">✦ ✦ ✦</span>
            <div class="iq-tile-header">
              <span class="iq-tile-badge">${linkedBadge}</span>
            </div>
            <p class="iq-tile-arabic" dir="rtl" lang="ar">${arabic}</p>
            <p class="iq-tile-name${revealed ? "" : " iq-tile-name--hidden"}">
              ${revealed ? transliteration : "— hidden —"}
            </p>
            <span class="iq-arch-ornament">— ✦ —</span>
          </div>
        </div>
        <div class="iq-arch-base">
          ${revealed
            ? `<p class="iq-tile-meaning">${meaning}</p>
               <div class="iq-ghost-row">
                 <button class="iq-ghost-pill iq-ghost-pill--x"    data-action="nameIncorrect" ${state.nameBonusClaimed ? "disabled" : ""}>✗ Missed It</button>
                 <button class="iq-ghost-pill iq-ghost-pill--check" data-action="nameCorrect"   ${state.nameBonusClaimed ? "disabled" : ""}>✓ Got It <em>+1</em></button>
               </div>`
            : ``
          }
        </div>
      </div>
    </div>
  `;

  container.querySelector(".iq-arch-wrap").addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "revealName"    && handlers.onRevealName)    handlers.onRevealName();
    if (action === "nameCorrect"   && handlers.onNameCorrect)   handlers.onNameCorrect();
    if (action === "nameIncorrect" && handlers.onNameIncorrect) handlers.onNameIncorrect();
  });
}

// ─── Right tile (Q&A card) — Scene Float ─────────────────────────────────────

export function renderRightTile(container, state, handlers = {}) {
  const { right } = getCurrentPair(state);
  if (!right) { container.innerHTML = ""; return; }

  const answered = state.revealStage === "answer";
  const questionType = right.questionType || (state.answerStyle === "mcq" ? "multiple-choice" : "open");

  let bodyHtml;
  if (right.type === "two-tile") {
    bodyHtml = buildTwoTileBody(right, answered);
  } else {
    bodyHtml = buildTriviaBody(right, answered, state);
  }

  container.innerHTML = `
    <div class="iq-tile iq-tile--right${answered ? " is-revealed" : ""}">
      <div class="iq-tile-header">
        <span class="iq-tile-badge">
          ${right.type === "two-tile"
            ? (right.symbolName ?? "Trivia")
            : escHtml(right.badgeLabel ?? right.title ?? formatCategory(right.category) ?? "Trivia")}
        </span>
      </div>
      <div class="iq-tile-body">
        ${bodyHtml}
        ${answered ? `
          <div class="iq-tile-reveal">
            ${formatProse(right.answerText, "iq-tile-answer")}
            ${right.explanation ? formatProse(right.explanation, "iq-tile-clue") : ""}
            ${right.sourceTitle ? `<p class="iq-tile-source">${escHtml(right.sourceTitle)}</p>` : ""}
          </div>
        ` : ""}
      </div>
      <div class="iq-tile-footer">
        <div class="iq-tile-btn-rail iq-tile-btn-rail--right">
          ${answered
            ? `<div class="iq-ghost-row">
                 <button class="iq-ghost-pill iq-ghost-pill--x"    data-action="incorrect">✗ Missed It</button>
                 <button class="iq-ghost-pill iq-ghost-pill--check" data-action="correct">✓ Got It</button>
               </div>`
            : ``
          }
          <button class="iq-skip-link" data-action="skip" aria-label="Skip this card">skip →</button>
        </div>
      </div>
    </div>
  `;

  container.querySelector(".iq-tile-btn-rail--right").addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "revealAnswer" && handlers.onRevealAnswer) handlers.onRevealAnswer();
    if (action === "correct"      && handlers.onCorrect)      handlers.onCorrect();
    if (action === "incorrect"    && handlers.onIncorrect)    handlers.onIncorrect();
    if (action === "skip"         && handlers.onSkip)         handlers.onSkip();
  });

  if (!answered) {
    container.querySelector(".iq-tile-body")?.addEventListener("click", (e) => {
      if (questionType === "multiple-choice") {
        const li = e.target.closest("[data-option-index]");
        if (!li) return;
        const idx = Number(li.dataset.optionIndex);
        if (Number.isNaN(idx)) return;
        handlers.onMcqPick?.(idx);
        return;
      }

      if (questionType === "sequence") {
        const item = e.target.closest("[data-sequence-index]");
        if (!item) return;
        const idx = Number(item.dataset.sequenceIndex);
        if (Number.isNaN(idx)) return;
        handlers.onSequencePick?.(idx);
        return;
      }

      if (questionType === "match") {
        const left = e.target.closest("[data-match-left]");
        if (left) {
          handlers.onMatchLeftPick?.(left.dataset.matchLeft);
          return;
        }

        const rightOpt = e.target.closest("[data-match-right]");
        if (rightOpt) {
          handlers.onMatchRightPick?.(rightOpt.dataset.matchRight);
        }
        return;
      }

      if (questionType === "speech") {
        const speechBtn = e.target.closest('[data-action="startSpeech"]');
        if (speechBtn) handlers.onSpeechStart?.();
      }
    });
  }
}

// ─── Scorebar ─────────────────────────────────────────────────────────────────

export function renderScorebar(container, state) {
  const isSolo = state.mode !== "team";
  const streakTier = state.streak >= 10 ? 10 : state.streak >= 5 ? 5 : 0;
  const cardsPlayed = Math.min(state.index, state.totalCards);
  const cardsRemaining = Math.max(state.totalCards - state.index, 0);
  const missedCount = state.missedCards.length;
  const allocatedCount = state.correctCards;
  const eventLabel = getEventLabel(state);
  const page = container.closest(".iq-page");

  page?.classList.toggle("iq-page--amp-5", streakTier === 5);
  page?.classList.toggle("iq-page--amp-10", streakTier === 10);

  // Compact one-line scorebar — single horizontal strip, no emoji.
  // The verbose event message is conveyed by the in-board toast already;
  // we surface it here only as a tiny aside.
  const teamA_active = state.turn === "A" ? " is-active" : "";
  const teamB_active = state.turn === "B" ? " is-active" : "";
  const hasTimer = Number(state.roundSeconds ?? 0) > 0;
  const timerLabel = hasTimer
    ? `<span class="iq-scorebar__pill">Time <strong>${Math.max(0, Number(state.roundTimeLeft ?? 0))}s</strong></span><span class="iq-scorebar__sep">·</span>`
    : "";

  container.innerHTML = isSolo
    ? `<div class="iq-scorebar iq-scorebar--solo iq-scorebar--inline${streakTier ? ` iq-scorebar--streak-${streakTier}` : ""}">
         ${timerLabel}
         <span class="iq-scorebar__pill">Score <strong>${state.soloScore}</strong></span>
         <span class="iq-scorebar__sep">·</span>
         <span class="iq-scorebar__pill">Streak <strong>${state.streak}</strong></span>
         <span class="iq-scorebar__sep">·</span>
         <span class="iq-scorebar__pill">${cardsPlayed}/${state.totalCards}</span>
         <span class="iq-scorebar__pill iq-scorebar__pill--miss" aria-label="Missed">${missedCount}m</span>
       </div>`
        : `<div class="iq-scorebar iq-scorebar--team iq-scorebar--inline${streakTier ? ` iq-scorebar--streak-${streakTier}` : ""}">
          ${timerLabel}
         <span class="iq-scorebar__pill iq-scorebar__team${teamA_active}">A <strong>${state.teamScoreA}</strong></span>
         <span class="iq-scorebar__pill iq-scorebar__team${teamB_active}">B <strong>${state.teamScoreB}</strong></span>
         <span class="iq-scorebar__sep">·</span>
         <span class="iq-scorebar__pill">${cardsPlayed}/${state.totalCards}</span>
         <span class="iq-scorebar__pill">Streak <strong>${state.streak}</strong></span>
       </div>`;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

export function renderProgressBar(container, state) {
  const pct = state.totalCards
    ? Math.round((state.index / state.totalCards) * 100)
    : 0;

  const fill = container.classList.contains("iq-progress__fill")
    ? container
    : container.querySelector(".iq-progress__fill");
  if (fill) {
    fill.style.setProperty("--progress", `${pct}%`);
    fill.style.width = `${pct}%`;
  }

  const label = container.querySelector(".iq-progress__label");
  if (label) label.textContent = `${state.index} / ${state.totalCards}`;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function getCurrentPair(state) {
  const right = state.rightDeck?.[state.index] ?? null;
  const left = right?.nameOfAllah && state.leftDeck?.length
    ? state.leftDeck.find(name => name.transliteration === right.nameOfAllah) ?? null
    : state.leftDeck?.length
      ? state.leftDeck[state.index % state.leftDeck.length]
      : null;
  return { right, left };
}

function buildTwoTileBody(card, answered) {
  const highlighted = escHtml(card.promptText).replace(
    /___/g,
    `<span class="iq-tile-blank">___</span>`
  );

  const optionsHtml = card.options
    ? card.options
        .map((opt, i) => {
          const cls = answered && i === card.correctIndex
            ? "iq-option iq-option--correct"
            : "iq-option";
          return `<li class="${cls}">${escHtml(opt)}</li>`;
        })
        .join("")
    : "";

  return `
    <div class="iq-tile-symbol">
      <span class="iq-tile-symbol__glyph">${card.symbol ?? ""}</span>
      <span class="iq-tile-symbol__name">${escHtml(card.symbolName ?? "")}</span>
    </div>
    <p class="iq-tile-question">${highlighted}</p>
    ${optionsHtml ? `<ol class="iq-options" type="A">${optionsHtml}</ol>` : ""}
  `;
}

function buildTriviaBody(card, answered, state) {
  const questionType = card.questionType || "open";
  if (questionType === "sequence") return buildSequenceBody(card, answered, state);
  if (questionType === "match") return buildMatchBody(card, answered, state);
  if (questionType === "speech") return buildSpeechBody(card, answered, state);

  return buildQuranBody(card, answered);
}

function buildQuranBody(card, answered) {
  const anchorLabel = getAnchorLabel(card.category);
  const strategy = getRevealStrategy(card);

  const optionsHtml = card.options
    ? card.options
        .map((opt, i) => {
          const cls = answered && i === card.correctIndex
            ? "iq-option iq-option--correct"
            : "iq-option";
          return `<li class="${cls}" data-option-index="${i}">${escHtml(opt)}</li>`;
        })
        .join("")
    : "";

  // ── Pre-reveal: show only what is NOT the answer ─────────────────────────
  // The strategy controls which fields are hidden until the user reveals.
  const preArabic =
    strategy.hide.includes("arabicText") ? "" :
    (card.promptArabicText ? `<p class="iq-tile-prompt-arabic" dir="rtl" lang="ar">${card.promptArabicText}</p>` : "");

  const preAnchor =
    strategy.hide.includes("themeAnchorText") ? "" :
    (card.themeAnchorText ? `<p class="iq-tile-anchor">${anchorLabel}: ${escHtml(card.themeAnchorText)}</p>` : "");

  // ── Reveal panel: render the answer + any previously-hidden context ──────
  const revealParts = [];
  if (answered) {
    if (card.arabicText && (strategy.hide.includes("arabicText") || strategy.show.includes("arabicText"))) {
      revealParts.push(`<p class="iq-tile-arabic" dir="rtl" lang="ar">${card.arabicText}</p>`);
    }
    if (card.transliterationText && strategy.show.includes("transliterationText")) {
      revealParts.push(`<p class="iq-tile-transliteration">${escHtml(card.transliterationText)}</p>`);
    }
    if (card.themeAnchorText && strategy.hide.includes("themeAnchorText")) {
      revealParts.push(`<p class="iq-tile-anchor"><strong>${anchorLabel}:</strong> ${escHtml(card.themeAnchorText)}</p>`);
    }
    if (card.translationText && strategy.show.includes("translationText")) {
      revealParts.push(formatProse(card.translationText, "iq-tile-clue"));
    }
  }

  return `
    ${preArabic}
    ${preAnchor}
    <p class="iq-tile-question">${escHtml(card.promptText)}</p>
    ${optionsHtml ? `<ol class="iq-options" type="A">${optionsHtml}</ol>` : ""}
    ${revealParts.length ? revealParts.join("\n") : ""}
  `;
}

function buildSequenceBody(card, answered, state) {
  const options = Array.isArray(card.sequenceOptions) ? card.sequenceOptions : [];
  const selected = Array.isArray(state.sequenceSelection) ? state.sequenceSelection : [];
  const selectedLabels = selected.map(idx => options[idx]).filter(Boolean);

  return `
    <p class="iq-tile-question">${escHtml(card.promptText)}</p>
    <p class="iq-tile-clue">Tap the steps in the correct order.</p>
    ${selectedLabels.length
      ? `<ol class="iq-list-answer">${selectedLabels.map(label => `<li>${escHtml(label)}</li>`).join("")}</ol>`
      : `<p class="iq-tile-clue">No steps chosen yet.</p>`
    }
    <div class="iq-match-grid">
      ${options.map((label, idx) => {
        const chosen = selected.includes(idx);
        return `<button class="iq-match-option${chosen ? " is-locked" : ""}" data-sequence-index="${idx}" ${chosen || answered ? "disabled" : ""}>${escHtml(label)}</button>`;
      }).join("")}
    </div>
    ${answered ? `<ol class="iq-list-prose">${(card.sequenceSteps || []).map(step => `<li>${escHtml(step)}</li>`).join("")}</ol>` : ""}
  `;
}

function buildMatchBody(card, answered, state) {
  const pairs = Array.isArray(card.matchPairs) ? card.matchPairs : [];
  const leftOptions = Array.isArray(card.matchLeftOptions) ? card.matchLeftOptions : [];
  const rightOptions = Array.isArray(card.matchRightOptions) ? card.matchRightOptions : [];
  const resolved = Array.isArray(state.matchedPairs) ? state.matchedPairs : [];
  const activeLeft = state.pendingMatchLeft;
  const usedLeft = new Set(resolved.map(pair => pair.left));
  const usedRight = new Set(resolved.map(pair => pair.right));

  return `
    <p class="iq-tile-question">${escHtml(card.promptText)}</p>
    <p class="iq-tile-clue">Tap one item from the left, then its match on the right.</p>
    <div class="iq-match-columns">
      <div class="iq-match-column">
        <p class="iq-setup-label">Left</p>
        ${leftOptions.map(label => `<button class="iq-match-option${activeLeft === label ? " is-active" : ""}${usedLeft.has(label) ? " is-locked" : ""}" data-match-left="${escAttr(label)}" ${usedLeft.has(label) || answered ? "disabled" : ""}>${escHtml(label)}</button>`).join("")}
      </div>
      <div class="iq-match-column">
        <p class="iq-setup-label">Right</p>
        ${rightOptions.map(label => `<button class="iq-match-option${usedRight.has(label) ? " is-locked" : ""}" data-match-right="${escAttr(label)}" ${usedRight.has(label) || answered ? "disabled" : ""}>${escHtml(label)}</button>`).join("")}
      </div>
    </div>
    ${resolved.length
      ? `<ul class="iq-list-prose">${resolved.map(pair => `<li>${escHtml(pair.left)} → ${escHtml(pair.right)}${pair.correct ? "" : " · retry needed"}</li>`).join("")}</ul>`
      : ""
    }
    ${answered ? `<ul class="iq-list-answer">${pairs.map(pair => `<li>${escHtml(pair.left)} → ${escHtml(pair.right)}</li>`).join("")}</ul>` : ""}
  `;
}

function buildSpeechBody(card, answered, state) {
  const transcript = state.speechTranscript || "";
  const scorePct = state.speechScore ? `${Math.round(state.speechScore * 100)}%` : "0%";
  const thresholdPct = `${Math.round((card.accuracyThreshold ?? 0.67) * 100)}%`;

  return `
    <p class="iq-tile-question">${escHtml(card.promptText)}</p>
    <p class="iq-tile-clue">Voice challenge: speak your answer clearly. Target accuracy: ${thresholdPct}.</p>
    <button class="iq-medallion-btn" data-action="startSpeech" ${answered ? "disabled" : ""}>Start Voice Answer</button>
    <p class="iq-tile-clue">Status: ${escHtml(state.speechStatus || "idle")}</p>
    ${state.speechError ? `<p class="iq-tile-clue">${escHtml(state.speechError)}</p>` : ""}
    ${transcript ? `<p class="iq-tile-anchor"><strong>Transcript:</strong> ${escHtml(transcript)}</p>` : ""}
    ${state.speechStatus === "scored" ? `<p class="iq-tile-anchor"><strong>Vocabulary Score:</strong> ${scorePct}</p>` : ""}
    ${answered ? `
      <p class="iq-tile-arabic" dir="rtl" lang="ar">${card.arabicText ? card.arabicText : ""}</p>
      ${card.transliterationText ? `<p class="iq-tile-transliteration">${escHtml(card.transliterationText)}</p>` : ""}
      ${card.themeAnchorText ? `<p class="iq-tile-anchor"><strong>Meaning Anchor:</strong> ${escHtml(card.themeAnchorText)}</p>` : ""}
    ` : ""}
  `;
}

// ─── Reveal strategy ──────────────────────────────────────────────────────────
// Inspect the question text to decide which card fields are the *answer* vs.
// *context*. Answer fields are hidden pre-reveal; context fields stay shown.
function getRevealStrategy(card) {
  const q = String(card.promptText ?? card.question ?? "").toLowerCase();
  const hasBlank = /___|\.\.\./.test(card.promptText ?? "");

  // Default: open question — show all context, reveal answer + extras
  let mode = "open";
  const hide = [];                                          // pre-reveal hidden
  const show = ["arabicText", "transliterationText", "translationText"]; // shown in reveal panel

  // Meaning question — hide the meaning anchor + translation; reveal them
  if (/meaning|translat|what does .* mean|interpret/.test(q)) {
    mode = "meaning";
    hide.push("themeAnchorText", "translationText");
  }
  // Completion question — hide the ayah text + transliteration; reveal them
  else if (hasBlank || /complete|comes next|fill in|missing word|next ayah|next verse/.test(q)) {
    mode = "completion";
    hide.push("arabicText", "transliterationText");
  }
  // Reference question — show meaning, hide ayah text (so player can guess source from meaning)
  else if (/which surah|which ayah|which verse|where (is|does)|from which|what surah|what verse/.test(q)) {
    mode = "reference";
    hide.push("arabicText", "transliterationText");
  }

  // Easy difficulty: trim reveal to the essentials
  if ((card.difficulty === 1 || card.difficulty === "easy") && mode === "open") {
    // keep show as-is but the rendering caller can skip extras
  }

  return { mode, hide, show: show.filter(f => !hide.includes(f)).concat(hide) };
}

// ─── List/prose formatter ─────────────────────────────────────────────────────
// Detects when text is naturally a list and renders <ul>/<ol> instead of <p>.
function formatProse(text, baseClass = "iq-tile-clue") {
  const raw = String(text ?? "").trim();
  if (!raw) return "";

  const items = splitIntoListItems(raw);
  if (items.length >= 2) {
    const ordered = /^\s*\d+[\.\)]/.test(raw);
    const tag = ordered ? "ol" : "ul";
    const cls = baseClass === "iq-tile-answer" ? "iq-list-answer" : "iq-list-prose";
    return `<${tag} class="${cls}">${
      items.map(it => `<li>${escHtml(it)}</li>`).join("")
    }</${tag}>`;
  }
  return `<p class="${baseClass}">${escHtml(raw)}</p>`;
}

function splitIntoListItems(raw) {
  // 1) Newline-separated lines (skip empties)
  const lines = raw.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
  if (lines.length >= 2) return lines.map(stripLeadingMarker);

  // 2) Numbered inline: "1. foo 2. bar 3. baz" or "1) foo 2) bar"
  const numbered = raw.match(/(?:^|\s)(\d+[\.\)])\s+/g);
  if (numbered && numbered.length >= 2) {
    return raw.split(/(?:^|\s)\d+[\.\)]\s+/).map(s => s.trim()).filter(Boolean);
  }

  // 3) Semicolon-separated, at least 2 segments
  if (raw.split(";").filter(s => s.trim()).length >= 2) {
    return raw.split(";").map(s => s.trim()).filter(Boolean);
  }

  // 4) Bullet markers
  if (/^\s*[-•·]\s/.test(raw)) {
    return raw.split(/[-•·]/).map(s => s.trim()).filter(Boolean);
  }

  // Otherwise: single paragraph
  return [raw];
}

function stripLeadingMarker(s) {
  return s.replace(/^\s*(?:\d+[\.\)]|[-•·*])\s+/, "").trim();
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(str) {
  return escHtml(str).replace(/'/g, "&#39;");
}

function getEventLabel(state) {
  switch (state.lastOutcome) {
    case "allocated":
      return { text: `points allocated +${state.lastPoints}`, className: "iq-scorebar__event--good" };
    case "missed":
      return { text: "card missed", className: "iq-scorebar__event--miss" };
    case "bonus":
      return { text: `name bonus +${state.lastPoints}`, className: "iq-scorebar__event--good" };
    case "bonus-missed":
      return { text: "name bonus missed", className: "iq-scorebar__event--miss" };
    case "skipped":
      return { text: "card skipped", className: "iq-scorebar__event--mute" };
    default:
      return { text: "deck live", className: "iq-scorebar__event--mute" };
  }
}

function formatCategory(category) {
  if (!category) return "Quest";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatDifficulty(difficulty) {
  if (!difficulty) return "Open";
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

function getAnchorLabel(category) {
  if (category === "quran") return "Meaning Anchor";
  if (category === "sunnah") return "Hadith Anchor";
  if (category === "ummah") return "History Anchor";
  return "Theme Anchor";
}
