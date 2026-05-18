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
    description: "Surah detail, ayah meaning, location recall, and Quran review anchors",
    themeId: "quran",
    variant: "night",
    deckUrl: "./content/banks/quran-99.json",
    deckType: "bank99",
  },
  sunnah: {
    id: "sunnah",
    label: "Sunnah",
    symbol: "",
    description: "Prophet, Seerah, hadith, adab, and daily du'a review",
    themeId: "sunnah",
    variant: "day",
    deckUrl: "./content/banks/sunnah-99.json",
    deckType: "bank99",
  },
  ummah: {
    id: "ummah",
    label: "Ummah",
    symbol: "",
    description: "Companions, legacy, turning points, and Muslim historical memory",
    themeId: "ummah",
    variant: "day",
    deckUrl: "./content/banks/ummah-99.json",
    deckType: "bank99",
  },
  hidayah: {
    id: "hidayah",
    label: "Hidayah",
    symbol: "",
    description: "Iman, worship, du'a, adab, family, and everyday guidance",
    themeId: "hidayah",
    variant: "day",
    deckUrl: "./content/banks/hidayah-99.json",
    deckType: "bank99",
  },
  jami: {
    id: "jami",
    label: "Jami'",
    symbol: "",
    description: "All categories together: Quran, Sunnah, Ummah, and Hidayah in one gathered round",
    themeId: "ultimate",
    variant: "day",
    deckUrls: [
      "./content/banks/quran-99.json",
      "./content/banks/sunnah-99.json",
      "./content/banks/ummah-99.json",
      "./content/banks/hidayah-99.json",
    ],
    deckType: "bank99",
  },
  bonus: {
    id: "bonus",
    label: "Allah's Names Bonus",
    symbol: "",
    description: "Bonus round outside the main 4 decks",
    themeId: "ultimate",
    variant: "night",
    deckUrl: "./content/packs/allah-names-finale.json",
    deckType: "seasonal-pack",
  },
};

export const MAIN_SOURCE_IDS = ["quran", "sunnah", "ummah", "hidayah", "jami"];

// ─── Label helpers ───────────────────────────────────────────────────────────

export function getModeLabel(mode) {
  const labels = { solo: "Solo", team: "Team" };
  return labels[mode] ?? mode;
}

export function getDifficultyLabel(difficulty) {
  const labels = { easy: "Easy", medium: "Medium", hard: "Hard" };
  return labels[difficulty] ?? difficulty;
}
