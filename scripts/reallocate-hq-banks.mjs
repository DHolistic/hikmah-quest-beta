import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "beta/content/banks");

const deckConfig = {
  quran: {
    deckFocus: "revelation-and-context",
    laneBySubTheme: {
      Surah: "surah-revelation",
      Ayah: "ayah-context",
    },
  },
  sunnah: {
    deckFocus: "meaning-and-theme",
    laneBySubTheme: {
      Hadith: "hadith-meaning",
      Prophet: "seerah-and-example",
    },
  },
  ummah: {
    deckFocus: "history-and-fulfillment",
    laneBySubTheme: {
      Legacy: "history-and-fulfillment",
      "Prophetic Legacy": "history-and-fulfillment",
      "Ibrahimic Legacy": "history-and-fulfillment",
      "Prophetic Order": "history-and-fulfillment",
      "Islamic History": "history-and-fulfillment",
      Sahaba: "history-and-fulfillment",
      "Pilgrimage Heritage": "history-and-fulfillment",
    },
  },
  hidayah: {
    deckFocus: "guidance-and-application",
    laneBySubTheme: {
      Hadith: "guidance-and-application",
      Pillars: "guidance-and-application",
      Dua: "guidance-and-application",
      Iman: "guidance-and-application",
      Submission: "guidance-and-application",
      Tawakkul: "guidance-and-application",
      "Hajj Practice": "guidance-and-application",
      "Pilgrim Awareness": "guidance-and-application",
      "Prophetic Journey": "guidance-and-application",
    },
  },
};

const difficultyByClusterRole = {
  anchor: "easy",
  reinforce: "medium",
  "source-practice": "hard",
  "locate-apply": "hard",
  "context-impact": "hard",
};

for (const deckName of Object.keys(deckConfig)) {
  const filePath = path.join(root, `${deckName}-99.json`);
  const cards = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const config = deckConfig[deckName];

  const updated = cards.map(card => {
    const difficulty = difficultyByClusterRole[card.clusterRole] ?? "medium";
    const deckLane = config.laneBySubTheme[card.subTheme] ?? config.deckFocus;

    return {
      ...card,
      deckFocus: config.deckFocus,
      deckLane,
      difficulty,
      questionStyle: difficulty,
      systemVersion: "hq-4-deck-reallocation-v1",
    };
  });

  fs.writeFileSync(filePath, `${JSON.stringify(updated, null, 2)}\n`);
}