// ─── Fisher-Yates shuffle ────────────────────────────────────────────────────

export function shuffleDeck(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── State factory ───────────────────────────────────────────────────────────

export function createGameplayState(rightDeck, leftDeck, mode = "solo", options = {}) {
  const shouldShuffle = options.shuffleDecks !== false;
  return {
    index: 0,
    rightDeck: shouldShuffle ? shuffleDeck(rightDeck) : [...rightDeck],
    leftDeck: shouldShuffle ? shuffleDeck(leftDeck) : [...leftDeck],
    mode,
    difficulty: "medium",
    revealStage: "question",   // "question" | "answer"
    nameRevealed: false,
    nameBonusClaimed: false,
    soloScore: 0,
    streak: 0,
    teamScoreA: 0,
    teamScoreB: 0,
    turn: "A",
    correctCards: 0,
    missedCards: [],
    lastOutcome: null,
    lastPoints: 0,
    streakMilestone: 0,
    isComplete: false,
    totalCards: rightDeck.length,
    sequenceSelection: [],
    matchedPairs: [],
    pendingMatchLeft: null,
    speechTranscript: "",
    speechScore: 0,
    speechStatus: "idle",
    speechError: "",
    speechLocale: "",
    ...options,
  };
}

// ─── Selectors ───────────────────────────────────────────────────────────────

export function getCurrentCard(state) {
  const right = state.rightDeck[state.index] ?? null;
  const left = state.leftDeck.length
    ? state.leftDeck[state.index % state.leftDeck.length]
    : null;
  return { right, left };
}

// ─── Transitions ─────────────────────────────────────────────────────────────

export function advanceCard(state) {
  const next = state.index + 1;
  return {
    ...state,
    index: next,
    revealStage: "question",
    nameRevealed: false,
    nameBonusClaimed: false,
    isComplete: next >= state.rightDeck.length,
    sequenceSelection: [],
    matchedPairs: [],
    pendingMatchLeft: null,
    speechTranscript: "",
    speechScore: 0,
    speechStatus: "idle",
    speechError: "",
    speechLocale: "",
  };
}

export function resetState(state) {
  return createGameplayState(state.rightDeck, state.leftDeck, state.mode);
}
