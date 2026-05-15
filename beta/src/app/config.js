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
  quran: {
    id: "quran",
    label: "Quran",
    symbol: "",
    description: "Quranic ayahs, tafsir, and Arabic reflection",
    themeId: "quran",
    variant: "night",
    deckUrl: "./cards-99.json",
    deckType: "cards99",
    bonusDeckType: "99names",
  },
  sunnah: {
    id: "sunnah",
    label: "Sunnah",
    symbol: "",
    description: "Prophetic hadith, Seerah, and the way of the Prophet ﷺ",
    themeId: "sunnah",
    variant: "day",
    deckUrl: "./cards-99.json",
    deckType: "cards99",
    bonusDeckType: "99names",
  },
  ummah: {
    id: "ummah",
    label: "Ummah",
    symbol: "",
    description: "Islamic history, scholars, civilisations, and contributions",
    themeId: "ummah",
    variant: "day",
    deckUrl: "./cards-99.json",
    deckType: "cards99",
    bonusDeckType: "99names",
  },
  ultimate: {
    id: "ultimate",
    label: "Ultimate",
    symbol: "",
    description: "All categories mixed — the full Hikmah Quest experience",
    themeId: "ultimate",
    variant: "day",
    deckUrl: "./cards-99.json",
    deckType: "cards99",
    bonusDeckType: "99names",
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
