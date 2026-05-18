import { advanceCard, getCurrentCard } from "./state.js";

function milestoneFor(streak) {
  if (streak >= 10) return 10;
  if (streak >= 5) return 5;
  return 0;
}

// All functions are pure — they return a new state, never mutate.

// ─── Point values ─────────────────────────────────────────────────────────────

export function ptsForDifficulty(difficulty) {
  if (difficulty === "easy") return 1;
  if (difficulty === "hard") return 3;
  return 2; // medium
}

export function revealName(state) {
  return { ...state, nameRevealed: true };
}

export function revealAnswer(state) {
  return { ...state, revealStage: "answer" };
}

export function markCorrect(state) {
  const pts = ptsForDifficulty(state.difficulty);
  const streak = state.streak + 1;
  const updated = {
    ...state,
    soloScore: state.soloScore + pts,
    streak,
    correctCards: state.correctCards + 1,
    teamScoreA: state.turn === "A" ? state.teamScoreA + pts : state.teamScoreA,
    teamScoreB: state.turn === "B" ? state.teamScoreB + pts : state.teamScoreB,
    lastOutcome: "allocated",
    lastPoints: pts,
    streakMilestone: milestoneFor(streak),
  };
  return advanceCard(updated);
}

export function markIncorrect(state) {
  const { right } = getCurrentCard(state);
  const updated = {
    ...state,
    streak: 0,
    missedCards: right ? [...state.missedCards, right] : state.missedCards,
    lastOutcome: "missed",
    lastPoints: 0,
    streakMilestone: 0,
  };
  return advanceCard(updated);
}

// +1 bonus for correctly knowing the Allah Name on the left tile
export function markNameBonus(state) {
  return {
    ...state,
    soloScore: state.soloScore + 1,
    teamScoreA: state.turn === "A" ? state.teamScoreA + 1 : state.teamScoreA,
    teamScoreB: state.turn === "B" ? state.teamScoreB + 1 : state.teamScoreB,
    nameBonusClaimed: true,
    lastOutcome: "bonus",
    lastPoints: 1,
  };
}

// Missed the name — no penalty, just locks the bonus buttons
export function dismissNameBonus(state) {
  return {
    ...state,
    nameBonusClaimed: true,
    lastOutcome: "bonus-missed",
    lastPoints: 0,
  };
}

export function skipCard(state) {
  // Skip: does not penalise streak or count as a miss, just moves forward
  return advanceCard({
    ...state,
    lastOutcome: "skipped",
    lastPoints: 0,
  });
}

// ─── Team helpers ─────────────────────────────────────────────────────────────

export function switchTurn(state) {
  return { ...state, turn: state.turn === "A" ? "B" : "A" };
}
