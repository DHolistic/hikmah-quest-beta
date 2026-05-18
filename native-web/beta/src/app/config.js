// ─── Session ────────────────────────────────────────────────────────────────

export const SESSION_KEY = "hikmahQuestBetaSession";
const LEGACY_SESSION_KEY = "ilmQuestBetaSession";

export function saveSession(config) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(config));
}

export function loadSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (raw) return JSON.parse(raw);

  const legacyRaw = sessionStorage.getItem(LEGACY_SESSION_KEY);
  if (!legacyRaw) return null;

  const parsed = JSON.parse(legacyRaw);
  try {
    sessionStorage.setItem(SESSION_KEY, legacyRaw);
  } catch {}
  return parsed;
}

// ─── Source configuration ────────────────────────────────────────────────────

export const sourceConfig = {
  fitr: {
    id: "fitr",
    label: "Eid al-Fitr",
    symbol: "",
    description: "Ramadan, fasting, charity, gratitude, and the day of breaking the fast",
    themeId: "quran",
    variant: "night",
    deckUrl: "./content/packs/eid-al-fitr.json",
    deckType: "seasonal-pack",
  },
  adha: {
    id: "adha",
    label: "Eid al-Adha",
    symbol: "",
    description: "Sacrifice, obedience, generosity, and the meaning of Eid al-Adha",
    themeId: "sunnah",
    variant: "day",
    deckUrl: "./content/packs/eid-al-adha.json",
    deckType: "seasonal-pack",
  },
  hajj: {
    id: "hajj",
    label: "Days of Hajj",
    symbol: "",
    description: "Ihram, Arafah, Mina, sacrifice, and the sacred days of Dhul Hijjah",
    themeId: "ummah",
    variant: "day",
    deckUrl: "./content/packs/days-of-hajj.json",
    deckType: "seasonal-pack",
  },
  ultimate: {
    id: "ultimate",
    label: "Ultimate",
    symbol: "",
    description: "Ibrahim family legacy, sacred story, and an Allah's Names finale round",
    themeId: "ultimate",
    variant: "day",
    deckUrl: "./content/packs/ibrahim-family-legacy.json",
    finaleDeckUrl: "./content/packs/allah-names-finale.json",
    deckType: "seasonal-pack",
  },
};

// ─── Label helpers ───────────────────────────────────────────────────────────

export function getModeLabel(mode) {
  const labels = { solo: "Solo", team: "Team" };
  return labels[mode] ?? mode;
}

export function getDifficultyLabel(difficulty) {
  const labels = { easy: "Easy", medium: "Medium", hard: "Hard" };
  return labels[difficulty] ?? difficulty;
}
