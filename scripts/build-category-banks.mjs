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

// ─── Prompt de-repetition ─────────────────────────────────────────────────────
// Each cluster carries three role-cards (anchor / reinforce / locate-apply) that
// share one underlying fact and one answer. The legacy template phrased the
// reinforce/locate-apply prompts with a single generic stem, so an 11-card
// single-difficulty round showed the same sentence many times.
//
// buildClusterPrompts() rewrites the medium (reinforce) and hard (locate-apply)
// prompts so each one NAMES its specific subject and asks a different KIND of
// question (easy = recall the term, medium = match the meaning of THIS term,
// hard = locate / apply THIS item). Anchor (easy) prompts are authored and are
// preserved verbatim. Answers are never modified.

// A short, human-readable subject label for a card, drawn only from existing
// fields — no new theological claims are introduced.
function subjectFor(card) {
  const name = String(card.nameOfAllah || "").trim();
  const meaning = String(card.nameMeaning || "").trim();
  if (name && meaning) return `${name} (${meaning})`;
  if (name) return name;

  const anchor = String(card.themeAnchor || "").trim();
  if (anchor && anchor !== "meaning" && !anchor.includes("-")) return anchor;

  const sub = String(card.subTheme || "").trim();
  if (sub) return sub;

  return String(card.label || "this item").trim();
}

// Short topic tag used so the same subject reads differently across difficulties.
function topicFor(card) {
  const sub = String(card.subTheme || "").toLowerCase();
  const lane = `${card.label || ""} ${card.subTheme || ""}`.toLowerCase();
  if (card.cat === "quran") return sub.includes("ayah") ? "ayah" : "surah";
  if (card.cat === "sunnah") return sub.includes("prophet") ? "Seerah point" : "hadith";
  if (card.cat === "ummah") return sub.includes("sahaba") ? "companion" : "pillar / history point";
  if (card.cat === "hidayah") return card.subTheme || "guidance point";
  if (lane.includes("hadith")) return "hadith";
  return "topic";
}

// Reinforce (medium): match / restate the meaning of THIS specific subject.
function reinforcePrompt(card) {
  const subject = subjectFor(card);
  const topic = topicFor(card);
  switch (card.cat) {
    case "quran":
      return `Linked to ${subject}: which ${topic} does this clue point to?`;
    case "sunnah":
      return `Tied to ${subject}: which teaching does this ${topic} convey?`;
    case "ummah":
      return `Connected to ${subject}: which ${topic} does this clue describe?`;
    case "hidayah":
      return `Under ${subject}: what does this guidance point teach?`;
    default:
      return `Regarding ${subject}: which answer matches this clue?`;
  }
}

// Locate-apply (hard): locate the source / apply THIS specific subject.
function locateApplyPrompt(card) {
  const subject = subjectFor(card);
  switch (card.cat) {
    case "quran":
      return `Where is the ${topicFor(card)} for ${subject} found — and what does it call a believer to do?`;
    case "sunnah":
      return `Name the source of this ${topicFor(card)} for ${subject} and how to act on it.`;
    case "ummah":
      return `Place ${subject} in its context: which person or event does this point belong to?`;
    case "hidayah":
      return `Apply ${subject}: which practice or source completes this guidance?`;
    default:
      return `Locate and apply ${subject}: which answer fits?`;
  }
}

// Returns a card clone with its prompt re-derived from the cluster role.
// Anchor prompts (authored, approved) pass through untouched. Difficulty (pts)
// and cluster role are independent in the source data, so routing is by ROLE
// only — every cluster carries one anchor, one reinforce, and one locate-apply
// (a.k.a. source-practice / context-impact) prompt, each phrased differently and
// naming its own subject.
function withRolePrompt(card) {
  const role = String(card.clusterRole || "anchor").toLowerCase();

  if (role === "anchor") {
    return { ...card };
  }
  if (role === "reinforce") {
    return { ...card, question: reinforcePrompt(card) };
  }
  // locate-apply / source-practice / context-impact
  return { ...card, question: locateApplyPrompt(card) };
}

function rebuildBankPrompts(cards) {
  return cards.map(withRolePrompt);
}

function buildLegacyIndexes(cards) {
  const byCategory = {};
  for (const card of cards) {
    byCategory[card.cat] ??= [];
    byCategory[card.cat].push(card);
  }
  return { byCategory };
}

function sortByDiff(cards) {
  return [...cards].sort((a, b) => {
    if (a.pts !== b.pts) return a.pts - b.pts;
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });
}

function assertCounts(name, cards) {
  const total = cards.length;
  const byPts = { 1: 0, 2: 0, 3: 0 };
  for (const card of cards) byPts[card.pts] = (byPts[card.pts] || 0) + 1;
  if (total !== 99 || byPts[1] !== 33 || byPts[2] !== 33 || byPts[3] !== 33) {
    throw new Error(`${name} invalid counts: total=${total} pts=${JSON.stringify(byPts)}`);
  }
  const uniqQ = new Set(cards.map(c => c.question)).size;
  const uniqA = new Set(cards.map(c => c.answer)).size;
  return { total, byPts, uniqueQuestions: uniqQ, uniqueAnswers: uniqA };
}

// ─── Hidayah realm ─────────────────────────────────────────────────────────────
// The legacy authoring set (cards-297) only natively covers quran / sunnah /
// ummah. The previous build recycled ummah "Pillars" and sunnah hadith clusters
// into hidayah, which blurred the four realms together.
//
// Hidayah is now built from its OWN coherent source: the everyday-guidance
// seasonal packs (iman / dua / worship / Hajj & Eid practice). Each pack card
// becomes a 3-role cluster (recall / meaning / apply) so realms stay focused and
// distinct. These packs are NOT used to feed quran / sunnah / ummah, so there is
// no cross-realm leakage. The three special MCQ packs (adha-hajj, fitr-ramadan,
// prophets-hadiths) are intentionally excluded here — they are surfaced to
// players directly via the "Seasonal / Special" deck.
const HIDAYAH_PACKS = [
  "duas-faith.json",
  "days-of-hajj.json",
  "eid-al-adha.json",
  "eid-al-fitr.json",
];

function buildHidayahBank(seasonalPacks) {
  // Flatten the guidance packs into ordered (card, subTheme) facts, then keep 33.
  const facts = [];
  for (const file of HIDAYAH_PACKS) {
    const pack = seasonalPacks[file] || [];
    const subTheme = file.includes("duas")
      ? "Iman & Dua"
      : file.includes("hajj")
        ? "Hajj Practice"
        : file.includes("adha")
          ? "Eid & Sacrifice"
          : "Eid & Fasting";
    for (const card of pack) {
      facts.push({ card, subTheme, sourceFile: file });
    }
  }

  const selected = facts.slice(0, 33);
  if (selected.length < 33) {
    throw new Error(`hidayah needs 33 source facts, only found ${selected.length}`);
  }

  const out = [];
  selected.forEach((fact, i) => {
    const { card, subTheme } = fact;
    const idx = String(i + 1).padStart(3, "0");
    const clusterId = `hidayah-${idx}`;
    const answer = card.answerText || card.answer || "";
    const subject = card.title || subTheme;
    const ref = card.sourceTitle || "";

    // Easy (anchor) — recall the term / fact. Authored prompt preserved.
    out.push({
      id: `hidayah-${idx}-1`,
      cat: "hidayah",
      subTheme,
      pts: 1,
      icon: "",
      label: `${labelMap.hidayah} · ${subTheme}`,
      nameOfAllah: "",
      nameMeaning: "",
      question: card.promptText || card.question || `Recall: ${subject}.`,
      answer,
      clusterId,
      clusterRole: "anchor",
      templateStatus: "guidance-source",
      themeAnchor: subject,
      referenceHint: ref,
      generatedFromId: card.id || clusterId,
      sourceCategory: "hidayah",
      sourceTitle: ref,
    });

    // Medium (reinforce) — match the meaning of THIS guidance point.
    out.push({
      id: `hidayah-${idx}-2`,
      cat: "hidayah",
      subTheme,
      pts: 2,
      icon: "",
      label: `${labelMap.hidayah} · ${subTheme}`,
      nameOfAllah: "",
      nameMeaning: "",
      question: `Under ${subject} (${subTheme}): what does this guidance point teach?`,
      answer,
      clusterId,
      clusterRole: "reinforce",
      templateStatus: "guidance-source",
      themeAnchor: subject,
      referenceHint: ref,
      generatedFromId: card.id || clusterId,
      sourceCategory: "hidayah",
      sourceTitle: ref,
    });

    // Hard (locate-apply) — apply / source THIS guidance point.
    out.push({
      id: `hidayah-${idx}-3`,
      cat: "hidayah",
      subTheme,
      pts: 3,
      icon: "",
      label: `${labelMap.hidayah} · ${subTheme}`,
      nameOfAllah: "",
      nameMeaning: "",
      question: `Apply ${subject}: which practice or source completes this guidance${ref ? ` (cf. ${ref})` : ""}?`,
      answer,
      clusterId,
      clusterRole: "locate-apply",
      templateStatus: "guidance-source",
      themeAnchor: subject,
      referenceHint: ref,
      generatedFromId: card.id || clusterId,
      sourceCategory: "hidayah",
      sourceTitle: ref,
    });
  });

  return sortByDiff(out);
}

// ─── Build ─────────────────────────────────────────────────────────────────────

const legacyCards = readJson(legacyPath);
const seasonalPacks = Object.fromEntries(
  fs.readdirSync(seasonalDir)
    .filter(file => file.endsWith(".json") && file !== "allah-names-finale.json")
    .map(file => [file, readJson(path.join(seasonalDir, file))]),
);

const { byCategory } = buildLegacyIndexes(legacyCards);

// Each realm is built ONLY from its own native legacy category — no cross-realm
// recycling. Prompts are de-templated per cluster role.
const quranBank = sortByDiff(rebuildBankPrompts(byCategory.quran));
const sunnahBank = sortByDiff(rebuildBankPrompts(byCategory.sunnah));
const ummahBank = sortByDiff(rebuildBankPrompts(byCategory.ummah));
const hidayahBank = buildHidayahBank(seasonalPacks);

const manifest = {
  generatedAt: new Date().toISOString(),
  source: {
    legacy297: legacyPath,
    seasonalDir,
    hidayahPacks: HIDAYAH_PACKS,
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
