import fs from "node:fs";
import path from "node:path";

const projectRoot = "/home/matt/DProjects/hikmah-quest-beta";
const authoringRoot = "/home/matt/DProjects/ilm-quest";
const outputDir = path.join(projectRoot, "beta/content/banks");

const legacyPath = path.join(authoringRoot, "cards-297-theme-template.json");
const seasonalDir = path.join(projectRoot, "beta/content/packs");

const labelMap = {
  quran: "Quran",
  sunnah: "Sunnah",
  ummah: "Ummah",
  hidayah: "Hidayah",
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function seasonalToLegacy(card, targetCategory, subTheme, index) {
  const diff = card.difficulty === "hard" ? 3 : card.difficulty === "medium" ? 2 : 1;
  return {
    id: `${targetCategory}-seasonal-${String(index).padStart(3, "0")}`,
    cat: targetCategory,
    subTheme,
    pts: diff,
    icon: "",
    label: `${labelMap[targetCategory]} · ${subTheme}`,
    nameOfAllah: "",
    nameMeaning: "",
    question: card.promptText || card.question || "",
    answer: card.answerText || card.answer || "",
    clusterId: `${targetCategory}-${card.id}`,
    clusterRole: card.questionType || "anchor",
    templateStatus: "seasonal-import",
    themeAnchor: card.title || subTheme,
    referenceHint: card.sourceTitle || "",
    generatedFromId: card.id,
    sourcePackId: card.packId || "",
    sourceCategory: card.category || "",
    sourceTitle: card.sourceTitle || "",
  };
}

function buildLegacyIndexes(cards) {
  const byCategory = {};
  const byClusterPrefix = new Map();
  const bySubTheme = {};

  for (const card of cards) {
    byCategory[card.cat] ??= [];
    byCategory[card.cat].push(card);

    bySubTheme[card.cat] ??= {};
    bySubTheme[card.cat][card.subTheme] ??= [];
    bySubTheme[card.cat][card.subTheme].push(card);

    const prefix = String(card.id).split("-")[0];
    const bucket = byClusterPrefix.get(prefix) ?? [];
    bucket.push(card);
    byClusterPrefix.set(prefix, bucket);
  }

  return { byCategory, byClusterPrefix, bySubTheme };
}

function sortLegacy(cards) {
  return [...cards].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

function sortByDiff(cards) {
  return [...cards].sort((a, b) => {
    if (a.pts !== b.pts) return a.pts - b.pts;
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
}

function assertCounts(name, cards) {
  const total = cards.length;
  const byPts = { 1: 0, 2: 0, 3: 0 };
  for (const card of cards) byPts[card.pts] = (byPts[card.pts] || 0) + 1;
  if (total !== 99 || byPts[1] !== 33 || byPts[2] !== 33 || byPts[3] !== 33) {
    throw new Error(`${name} invalid counts: total=${total} pts=${JSON.stringify(byPts)}`);
  }
  return { total, byPts };
}

const legacyCards = readJson(legacyPath);
const seasonalPacks = Object.fromEntries(
  fs.readdirSync(seasonalDir)
    .filter(file => file.endsWith(".json") && file !== "allah-names-finale.json")
    .map(file => [file, readJson(path.join(seasonalDir, file))]),
);

const { byCategory, byClusterPrefix, bySubTheme } = buildLegacyIndexes(legacyCards);

const quranBank = sortLegacy(byCategory.quran);
const sunnahBank = sortLegacy(byCategory.sunnah);

const hidayahHadithClusters = [
  "34", "35", "36", "38", "39",
  "45", "47", "49", "50",
  "56", "57", "60",
];

const hidayahLegacy = [
  ...sortLegacy(bySubTheme.ummah.Pillars),
  ...hidayahHadithClusters.flatMap(prefix => sortLegacy(byClusterPrefix.get(prefix) ?? [])),
];

const hidayahSeasonal = [
  seasonalToLegacy(seasonalPacks["duas-faith.json"][2], "hidayah", "Dua", 1),
  seasonalToLegacy(seasonalPacks["duas-faith.json"][3], "hidayah", "Iman", 2),
  seasonalToLegacy(seasonalPacks["duas-faith.json"][7], "hidayah", "Tawakkul", 3),
  seasonalToLegacy(seasonalPacks["days-of-hajj.json"][10], "hidayah", "Hajj Practice", 4),
  seasonalToLegacy(seasonalPacks["days-of-hajj.json"][11], "hidayah", "Hajj Practice", 5),
  seasonalToLegacy(seasonalPacks["adha-hajj.json"][7], "hidayah", "Hajj Practice", 6),
  seasonalToLegacy(seasonalPacks["eid-al-adha.json"][8], "hidayah", "Submission", 7),
  seasonalToLegacy(seasonalPacks["eid-al-adha.json"][11], "hidayah", "Pilgrim Awareness", 8),
  seasonalToLegacy(seasonalPacks["prophets-hadiths.json"][6], "hidayah", "Prophetic Journey", 9),
];

const hidayahBank = sortByDiff([...hidayahLegacy, ...hidayahSeasonal]);

const ummahLegacy = [
  ...sortLegacy(bySubTheme.ummah.Sahaba),
  ...["40", "41", "42", "44", "51", "53", "54", "55", "62", "63", "64", "66"]
    .flatMap(prefix => sortLegacy(byClusterPrefix.get(prefix) ?? [])),
];

const ummahSeasonal = [
  seasonalToLegacy(seasonalPacks["ibrahim-family-legacy.json"][0], "ummah", "Legacy", 1),
  seasonalToLegacy(seasonalPacks["ibrahim-family-legacy.json"][3], "ummah", "Legacy", 2),
  seasonalToLegacy(seasonalPacks["ibrahim-family-legacy.json"][4], "ummah", "Legacy", 3),
  seasonalToLegacy(seasonalPacks["ibrahim-family-legacy.json"][7], "ummah", "Legacy", 4),
  seasonalToLegacy(seasonalPacks["ibrahim-family-legacy.json"][9], "ummah", "Legacy", 5),
  seasonalToLegacy(seasonalPacks["ibrahim-family-legacy.json"][11], "ummah", "Legacy", 6),
  seasonalToLegacy(seasonalPacks["ibrahim-family-legacy.json"][1], "ummah", "Legacy", 7),
  seasonalToLegacy(seasonalPacks["ibrahim-family-legacy.json"][2], "ummah", "Legacy", 8),
  seasonalToLegacy(seasonalPacks["ibrahim-family-legacy.json"][6], "ummah", "Legacy", 9),
  seasonalToLegacy(seasonalPacks["ibrahim-family-legacy.json"][10], "ummah", "Legacy", 10),
  seasonalToLegacy(seasonalPacks["prophets-hadiths.json"][5], "ummah", "Prophetic Legacy", 11),
  seasonalToLegacy(seasonalPacks["prophets-hadiths.json"][8], "ummah", "Islamic History", 12),
  seasonalToLegacy(seasonalPacks["ibrahim-family-legacy.json"][5], "ummah", "Legacy", 13),
  seasonalToLegacy(seasonalPacks["ibrahim-family-legacy.json"][8], "ummah", "Legacy", 14),
  seasonalToLegacy(seasonalPacks["days-of-hajj.json"][10], "ummah", "Pilgrimage Heritage", 15),
  seasonalToLegacy(seasonalPacks["days-of-hajj.json"][11], "ummah", "Pilgrimage Heritage", 16),
  seasonalToLegacy(seasonalPacks["prophets-hadiths.json"][6], "ummah", "Prophetic Order", 17),
  seasonalToLegacy(seasonalPacks["eid-al-adha.json"][8], "ummah", "Ibrahimic Legacy", 18),
];

const ummahBank = sortByDiff([...ummahLegacy, ...ummahSeasonal]);

const manifest = {
  generatedAt: new Date().toISOString(),
  source: {
    legacy297: legacyPath,
    seasonalDir,
  },
  banks: {
    quran: assertCounts("quran", quranBank),
    sunnah: assertCounts("sunnah", sunnahBank),
    ummah: assertCounts("ummah", ummahBank),
    hidayah: assertCounts("hidayah", hidayahBank),
  },
};

ensureDir(outputDir);
fs.writeFileSync(path.join(outputDir, "quran-99.json"), JSON.stringify(quranBank, null, 2) + "\n");
fs.writeFileSync(path.join(outputDir, "sunnah-99.json"), JSON.stringify(sunnahBank, null, 2) + "\n");
fs.writeFileSync(path.join(outputDir, "ummah-99.json"), JSON.stringify(ummahBank, null, 2) + "\n");
fs.writeFileSync(path.join(outputDir, "hidayah-99.json"), JSON.stringify(hidayahBank, null, 2) + "\n");
fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`Wrote category banks to ${outputDir}`);
console.log(JSON.stringify(manifest, null, 2));
