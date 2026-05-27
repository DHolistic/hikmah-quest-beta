import { sourceConfig } from "./config.js";
import { loadDeckForReview } from "../content/deck-loader.js";
import { renderRightTile } from "../gameplay/render.js";

const REVIEW_CONFIGS = [
  sourceConfig.quran,
  sourceConfig.sunnah,
  sourceConfig.ummah,
  sourceConfig.hidayah,
  sourceConfig.bonus,
  {
    id: "pack-adha-hajj",
    label: "Pack · Adha / Hajj",
    themeId: "ummah",
    variant: "day",
    deckType: "seasonal-pack",
    deckUrl: "./content/packs/adha-hajj.json",
  },
  {
    id: "pack-days-of-hajj",
    label: "Pack · Days Of Hajj",
    themeId: "ummah",
    variant: "day",
    deckType: "seasonal-pack",
    deckUrl: "./content/packs/days-of-hajj.json",
  },
  {
    id: "pack-duas-faith",
    label: "Pack · Duas / Faith",
    themeId: "hidayah",
    variant: "day",
    deckType: "seasonal-pack",
    deckUrl: "./content/packs/duas-faith.json",
  },
  {
    id: "pack-eid-al-adha",
    label: "Pack · Eid Al-Adha",
    themeId: "ummah",
    variant: "day",
    deckType: "seasonal-pack",
    deckUrl: "./content/packs/eid-al-adha.json",
  },
  {
    id: "pack-eid-al-fitr",
    label: "Pack · Eid Al-Fitr",
    themeId: "hidayah",
    variant: "day",
    deckType: "seasonal-pack",
    deckUrl: "./content/packs/eid-al-fitr.json",
  },
  {
    id: "pack-fitr-ramadan",
    label: "Pack · Fitr / Ramadan",
    themeId: "hidayah",
    variant: "night",
    deckType: "seasonal-pack",
    deckUrl: "./content/packs/fitr-ramadan.json",
  },
  {
    id: "pack-ibrahim-family-legacy",
    label: "Pack · Ibrahim Family Legacy",
    themeId: "ummah",
    variant: "day",
    deckType: "seasonal-pack",
    deckUrl: "./content/packs/ibrahim-family-legacy.json",
  },
  {
    id: "pack-prophets-hadiths",
    label: "Pack · Prophets / Hadiths",
    themeId: "sunnah",
    variant: "day",
    deckType: "seasonal-pack",
    deckUrl: "./content/packs/prophets-hadiths.json",
  },
];

const STYLE_FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "multiple-choice", label: "Multiple Choice" },
  { id: "fill-blank", label: "Fill In Blank" },
  { id: "sequence", label: "Reorder" },
  { id: "match", label: "Organize List" },
  { id: "speech", label: "Speech" },
];

const VARIANT_FILTERS = [
  { id: "day", label: "Day" },
  { id: "night", label: "Night" },
];

const THEME_ASSETS = {
  quran: { day: "2BWorldinner_landscape.png", night: "Arch2B_landscape.png" },
  sunnah: { day: "2AWorldInner_landscape.png", night: "Arch2A_landscape.png" },
  ummah: { day: "2cWorldInner_landscape.png", night: "Arch2C_landscape.png" },
  hidayah: { day: "HidayahInnerWorld.png", night: "HidayahNighInnerWorld.png" },
  ultimate: { day: "2DWorldInner.png", night: "2DArch_landscape.png" },
};

const state = {
  cards: [],
  filteredCards: [],
  sourceId: "all",
  styleId: "all",
  variant: "night",
  query: "",
  currentIndex: 0,
  preview: {
    revealStage: "question",
    sequenceSelection: [],
    matchedPairs: [],
    pendingMatchLeft: null,
    speechTranscript: "",
    speechScore: 0,
    speechStatus: "idle",
    speechError: "",
  },
  stageMessage: "",
};

function classifyCardStyle(card) {
  const questionType = String(card.questionType || "").trim();
  if (questionType === "fill-blank") return "fill-blank";
  if (questionType === "multiple-choice") return "multiple-choice";
  if (questionType === "sequence") return "sequence";
  if (questionType === "match") return "match";
  if (questionType === "speech") return "speech";
  if (Array.isArray(card.options) && card.options.length) return "multiple-choice";
  return "open";
}

function humanStyle(styleId) {
  return STYLE_FILTERS.find(item => item.id === styleId)?.label ?? styleId;
}

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyTheme(themeId, variant) {
  document.documentElement.dataset.theme = themeId || "ultimate";
  document.documentElement.dataset.variant = variant || "night";
}

function currentCard() {
  return state.filteredCards[state.currentIndex] ?? null;
}

function resetPreview(message = "") {
  state.preview = {
    revealStage: "question",
    sequenceSelection: [],
    matchedPairs: [],
    pendingMatchLeft: null,
    speechTranscript: "",
    speechScore: 0,
    speechStatus: "idle",
    speechError: "",
  };
  state.stageMessage = message;
}

function buildPreviewState(card) {
  return {
    rightDeck: [card],
    leftDeck: [],
    index: 0,
    revealStage: state.preview.revealStage,
    answerStyle: "guided",
    sequenceSelection: state.preview.sequenceSelection,
    matchedPairs: state.preview.matchedPairs,
    pendingMatchLeft: state.preview.pendingMatchLeft,
    speechTranscript: state.preview.speechTranscript,
    speechScore: state.preview.speechScore,
    speechStatus: state.preview.speechStatus,
    speechError: state.preview.speechError,
    difficulty: card?.difficulty || "medium",
    mode: "solo",
    totalCards: 1,
    nameRevealed: false,
    nameBonusClaimed: false,
  };
}

function updateThemeForCard(card) {
  if (!card) return;
  applyTheme(card.reviewThemeId || "ultimate", state.variant);
}

function cardMatchesFilter(card) {
  if (state.sourceId !== "all" && card.reviewSourceId !== state.sourceId) return false;
  if (state.styleId !== "all" && card.reviewStyle !== state.styleId) return false;
  if (state.query) {
    const haystack = [
      card.title,
      card.promptText,
      card.answerText,
      card.sourceTitle,
      card.id,
      card.packId,
    ].join(" ").toLowerCase();
    if (!haystack.includes(state.query.toLowerCase())) return false;
  }
  return true;
}

function updateFilteredCards() {
  const currentId = currentCard()?.id;
  state.filteredCards = state.cards.filter(cardMatchesFilter);
  const nextIndex = state.filteredCards.findIndex(card => card.id === currentId);
  state.currentIndex = nextIndex >= 0 ? nextIndex : 0;
  resetPreview();
}

function sourceOptions() {
  return [
    { id: "all", label: "All 504 Cards" },
    ...REVIEW_CONFIGS.map(config => ({ id: config.id, label: config.label })),
  ];
}

function countsForStyles(cards) {
  return STYLE_FILTERS.reduce((acc, item) => {
    acc[item.id] = item.id === "all"
      ? cards.length
      : cards.filter(card => card.reviewStyle === item.id).length;
    return acc;
  }, {});
}

async function loadCards() {
  const grouped = await Promise.all(REVIEW_CONFIGS.map(async config => {
    const cards = await loadDeckForReview(config);
    return cards.map((card, index) => ({
      ...card,
      reviewSourceId: config.id,
      reviewSourceLabel: config.label,
      reviewThemeId: config.themeId || "ultimate",
      reviewDefaultVariant: config.variant || "night",
      reviewStyle: classifyCardStyle(card),
      reviewOrder: index,
    }));
  }));

  state.cards = grouped.flat();
  updateFilteredCards();
}

function renderSourceSelect() {
  const select = document.getElementById("iq-review-source");
  if (!select) return;
  select.innerHTML = sourceOptions()
    .map(option => `<option value="${option.id}">${escHtml(option.label)}</option>`)
    .join("");
  select.value = state.sourceId;
  select.addEventListener("change", () => {
    state.sourceId = select.value;
    updateFilteredCards();
    redraw();
  });
}

function renderChipRow(containerId, items, activeId, onPick, countMap = null) {
  const row = document.getElementById(containerId);
  if (!row) return;
  row.innerHTML = items.map(item => {
    const count = countMap ? ` (${countMap[item.id] ?? 0})` : "";
    return `<button class="iq-review-chip${item.id === activeId ? " is-active" : ""}" data-chip="${item.id}">${escHtml(item.label)}${count}</button>`;
  }).join("");
  row.querySelectorAll("[data-chip]").forEach(button => {
    button.addEventListener("click", () => onPick(button.dataset.chip));
  });
}

function renderList() {
  const list = document.getElementById("iq-review-list");
  if (!list) return;

  if (!state.filteredCards.length) {
    list.innerHTML = `<p class="iq-review-empty">No cards match the current filters.</p>`;
    return;
  }

  list.innerHTML = state.filteredCards.map((card, index) => `
    <button class="iq-review-card-row${index === state.currentIndex ? " is-active" : ""}" data-card-index="${index}">
      <strong>${escHtml(card.title || card.promptText || card.id)}</strong>
      <small>${escHtml(card.reviewSourceLabel)} · ${escHtml(humanStyle(card.reviewStyle))} · ${escHtml(card.difficulty || "—")}</small>
      <small>${escHtml(card.id)}</small>
    </button>
  `).join("");

  list.querySelectorAll("[data-card-index]").forEach(button => {
    button.addEventListener("click", () => {
      state.currentIndex = Number(button.dataset.cardIndex);
      resetPreview();
      redraw();
    });
  });
}

function renderInspector(card) {
  const inspector = document.getElementById("iq-review-inspector");
  if (!inspector) return;
  if (!card) {
    inspector.innerHTML = `<p class="iq-review-empty">No card selected.</p>`;
    return;
  }

  const rows = [
    ["Card", card.id],
    ["Source", card.reviewSourceLabel],
    ["Style", humanStyle(card.reviewStyle)],
    ["Difficulty", card.difficulty || "—"],
    ["Theme", `${card.reviewThemeId} · ${state.variant}`],
    ["Pack", card.packId || card.deckName || "—"],
    ["Title", card.title || "—"],
    ["Prompt", card.promptText || "—"],
    ["Answer", card.answerText || "—"],
    ["Options", Array.isArray(card.options) ? card.options.join(" | ") : "—"],
    ["Sequence", Array.isArray(card.sequenceSteps) ? card.sequenceSteps.join(" → ") : "—"],
    ["Matches", Array.isArray(card.matchPairs) ? card.matchPairs.map(pair => `${pair.left} → ${pair.right}`).join(" | ") : "—"],
    ["Source Ref", card.sourceTitle || "—"],
  ];

  inspector.innerHTML = rows.map(([label, value]) => `
    <div class="iq-review-kv">
      <span class="iq-review-stat-label">${escHtml(label)}</span>
      <code>${escHtml(value)}</code>
    </div>
  `).join("");
}

function renderStage(card) {
  const stage = document.getElementById("iq-review-stage");
  const note = document.getElementById("iq-review-answer-note");
  if (!stage || !note) return;
  if (!card) {
    stage.textContent = "No card selected.";
    note.textContent = "";
    return;
  }

  const style = humanStyle(card.reviewStyle);
  const status = state.preview.revealStage === "answer" ? "Answer revealed." : "Question hidden.";
  stage.textContent = `${status} Style: ${style}. ${state.stageMessage || "Use Reveal Answer or interact with the card directly."}`;
  note.textContent = state.preview.revealStage === "answer"
    ? `Answer: ${card.answerText || "—"}`
    : "";
}

function renderSummary(card) {
  document.getElementById("iq-review-count-pill").textContent = `${state.cards.length} cards`;
  document.getElementById("iq-review-position").textContent = state.filteredCards.length
    ? `${state.currentIndex + 1} / ${state.filteredCards.length}`
    : "0 / 0";

  const styleCount = countsForStyles(state.filteredCards);
  const pickedStyle = state.styleId === "all"
    ? `All · ${styleCount.all}`
    : `${humanStyle(state.styleId)} · ${styleCount[state.styleId] ?? 0}`;
  document.getElementById("iq-review-style-summary").textContent = pickedStyle;

  const themeAsset = card
    ? THEME_ASSETS[card.reviewThemeId]?.[state.variant] || "unknown"
    : "—";
  document.getElementById("iq-review-theme-asset").textContent = themeAsset;

  const hidayahStatus = !card
    ? "—"
    : card.reviewThemeId !== "hidayah"
      ? "Switch to Hidayah cards to confirm"
      : state.variant === "night"
        ? "Dedicated Hidayah arch configured"
        : "Dedicated Hidayah inner world configured";
  document.getElementById("iq-review-hidayah-status").textContent = hidayahStatus;
}

function redrawPreview() {
  const card = currentCard();
  updateThemeForCard(card);
  renderSummary(card);
  renderStage(card);
  renderInspector(card);

  const previewEl = document.getElementById("iq-review-preview-card");
  if (!previewEl || !card) {
    if (previewEl) previewEl.innerHTML = "";
    return;
  }

  const previewState = buildPreviewState(card);
  renderRightTile(previewEl, previewState, handlers);
}

function redraw() {
  renderChipRow("iq-review-style-row", STYLE_FILTERS, state.styleId, (styleId) => {
    state.styleId = styleId;
    updateFilteredCards();
    redraw();
  }, countsForStyles(state.cards.filter(card => state.sourceId === "all" || card.reviewSourceId === state.sourceId)));

  renderChipRow("iq-review-variant-row", VARIANT_FILTERS, state.variant, (variant) => {
    state.variant = variant;
    redraw();
  });

  renderList();
  redrawPreview();
}

const handlers = {
  onRevealAnswer: () => {
    state.preview.revealStage = "answer";
    state.stageMessage = "Answer shown for live copy/content review.";
    redrawPreview();
  },
  onCorrect: () => {
    state.preview.revealStage = "answer";
    state.stageMessage = "Marked correct in review.";
    redrawPreview();
  },
  onIncorrect: () => {
    state.preview.revealStage = "answer";
    state.stageMessage = "Marked incorrect in review.";
    redrawPreview();
  },
  onSkip: () => {
    if (state.currentIndex < state.filteredCards.length - 1) {
      state.currentIndex += 1;
      resetPreview();
      redraw();
    }
  },
  onMcqPick: (idx) => {
    const card = currentCard();
    if (!card) return;
    state.preview.revealStage = "answer";
    state.stageMessage = idx === card.correctIndex
      ? "Picked the correct option."
      : `Picked option ${idx + 1}; correct option highlighted.`;
    redrawPreview();
  },
  onSequencePick: (idx) => {
    const card = currentCard();
    if (!card?.sequenceOptions?.length) return;
    if (state.preview.sequenceSelection.includes(idx)) return;
    state.preview.sequenceSelection = [...state.preview.sequenceSelection, idx];
    if (state.preview.sequenceSelection.length === card.sequenceSteps.length) {
      const chosen = state.preview.sequenceSelection.map(i => card.sequenceOptions[i]);
      const correct = chosen.every((step, i) => step === card.sequenceSteps[i]);
      state.preview.revealStage = "answer";
      state.stageMessage = correct ? "Sequence is in the correct order." : "Sequence completed; compare against the correct list.";
    }
    redrawPreview();
  },
  onMatchLeftPick: (label) => {
    state.preview.pendingMatchLeft = label;
    state.stageMessage = `Selected left item: ${label}`;
    redrawPreview();
  },
  onMatchRightPick: (label) => {
    const card = currentCard();
    const left = state.preview.pendingMatchLeft;
    if (!card?.matchPairs?.length || !left) return;
    const expected = card.matchPairs.find(pair => pair.left === left);
    state.preview.matchedPairs = [...state.preview.matchedPairs, {
      left,
      right: label,
      correct: expected?.right === label,
    }];
    state.preview.pendingMatchLeft = null;
    if (state.preview.matchedPairs.length === card.matchPairs.length) {
      state.preview.revealStage = "answer";
      state.stageMessage = "Match round completed; verify pair ordering in the inspector.";
    }
    redrawPreview();
  },
  onSpeechStart: () => {
    state.preview.revealStage = "answer";
    state.stageMessage = "Speech cards can be copy-reviewed here; microphone scoring stays on the gameplay page.";
    redrawPreview();
  },
};

function bindControls() {
  document.getElementById("iq-review-search")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    updateFilteredCards();
    redraw();
  });

  document.getElementById("iq-review-prev")?.addEventListener("click", () => {
    if (!state.filteredCards.length) return;
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    resetPreview();
    redraw();
  });

  document.getElementById("iq-review-next")?.addEventListener("click", () => {
    if (!state.filteredCards.length) return;
    state.currentIndex = Math.min(state.filteredCards.length - 1, state.currentIndex + 1);
    resetPreview();
    redraw();
  });

  document.getElementById("iq-review-reveal")?.addEventListener("click", () => {
    handlers.onRevealAnswer();
  });

  document.getElementById("iq-review-reload")?.addEventListener("click", async () => {
    const button = document.getElementById("iq-review-reload");
    if (button) button.disabled = true;
    resetPreview("Reloading from beta JSON files...");
    redrawPreview();
    await loadCards();
    if (button) button.disabled = false;
    redraw();
  });
}

async function init() {
  renderSourceSelect();
  bindControls();
  await loadCards();
  redraw();
}

init().catch((error) => {
  const stage = document.getElementById("iq-review-stage");
  if (stage) stage.textContent = `Review lab failed to load: ${error.message}`;
  console.error(error);
});
