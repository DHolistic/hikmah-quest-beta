import { shuffleDeck } from "../gameplay/state.js";

let quranRepositoryPromise;

function splitAnswerDetails(answerText) {
  const text = String(answerText ?? "").trim();
  const parenRef = text.match(/^(.*)\(([^()]+)\)\s*$/);
  if (parenRef) {
    return {
      answerStem: parenRef[1].trim().replace(/[.\s]+$/, ""),
      referenceText: parenRef[2].trim(),
    };
  }

  const dashRef = text.match(/^(.*?)(?:\s+[—-]\s+)([^—-]*(?:\d+:\d+|Surah\s+\d+).*)$/i);
  if (dashRef) {
    return {
      answerStem: dashRef[1].trim().replace(/[.\s]+$/, ""),
      referenceText: dashRef[2].trim(),
    };
  }

  return { answerStem: text, referenceText: "" };
}

function sanitizeLegacyAnswer(answerText) {
  const text = String(answerText ?? "").trim();
  if (!text) return "";

  const anchored = text.match(/Anchor (?:answer|reference):\s*(.+)$/i);
  if (anchored) return anchored[1].trim();

  return text
    .replace(/^Learner\s+(?:explains|states)[^.]*\.\s*/i, "")
    .trim();
}

function isAuthoringStylePrompt(promptText) {
  const text = String(promptText ?? "").toLowerCase();
  return (
    text.includes("reinforce ") ||
    text.includes("source and practice") ||
    text.includes("in your own words") ||
    text.includes("restate this hadith teaching") ||
    text.includes("what key seerah/history lesson") ||
    text.includes("what practical lesson") ||
    text.includes("locate and apply") ||
    text.includes("explain what it means") ||
    text.includes("verify meaning")
  );
}

function extractVerseReference(...candidates) {
  for (const value of candidates) {
    const text = String(value ?? "");
    const ayahMatch = text.match(/(\d{1,3}):(\d{1,3})/);
    if (ayahMatch) {
      return { surah: Number(ayahMatch[1]), ayah: Number(ayahMatch[2]) };
    }
  }
  return null;
}

function buildArabicExcerpt(arabicText, wordLimit = 10) {
  const words = String(arabicText ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= wordLimit) return words.join(" ");
  return `${words.slice(0, wordLimit).join(" ")} ...`;
}

function buildArabicPromptWithBlank(arabicText, tailWordCount = 4) {
  const words = String(arabicText ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= tailWordCount + 2) return `${words.slice(0, -1).join(" ")} ...`;
  return `${words.slice(0, -tailWordCount).join(" ")} ...`;
}

function extractArabicCompletion(arabicText, tailWordCount = 4) {
  const words = String(arabicText ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  return words.slice(-Math.min(tailWordCount, words.length)).join(" ");
}

function formatQuranLocation(verse) {
  return `Surah ${verse.surahName || verse.surah} ${verse.surah}:${verse.ayah} · Juz ${verse.juzNumber}`;
}

function choiceLabelFor(card) {
  return String(card.answerChoice ?? card.answerText ?? "").trim();
}

function uniqueChoices(cards) {
  const seen = new Set();
  return cards.filter(card => {
    const label = choiceLabelFor(card);
    if (!label || seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

async function loadQuranRepository() {
  if (!quranRepositoryPromise) {
    const url = new URL("../../../quran-repository.json", import.meta.url);
    quranRepositoryPromise = fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const lookup = new Map();
        for (const ayah of data) {
          lookup.set(`${ayah.surah}:${ayah.ayah}`, ayah);
        }
        return lookup;
      })
      .catch(err => {
        console.warn("[deck-loader] Quran repository unavailable:", err.message);
        return new Map();
      });
  }
  return quranRepositoryPromise;
}

// ─── Transform: cards-99.json → internal card format ────────────────────────

function transformLegacyCard(card) {
  const pts = Number(card.pts ?? 1);
  const cleanedAnswer = sanitizeLegacyAnswer(card.answer || "");
  const { answerStem, referenceText } = splitAnswerDetails(cleanedAnswer);
  return {
    id: String(card.id),
    type: "legacy",
    packId: card.packId || "",
    deckName: card.deckName || "",
    category: card.cat,
    subTheme: card.subTheme || "Knowledge",
    promptText: card.question || "",
    answerText: answerStem,
    answerChoice: answerStem,
    nameOfAllah: card.nameOfAllah || "",
    nameMeaning: card.nameMeaning || "",
    icon: card.icon || "",
    label: card.label || "",
    promptArabicText: card.promptArabicText || "",
    arabicText: card.arabicText || card.ayahReveal?.arabic || "",
    transliterationText: card.transliterationText || "",
    translationText: card.translationText || card.ayahReveal?.meaning || "",
    questionMode: card.questionMode || "open",
    questionType: card.questionType || (card.questionMode === "multiple-choice" ? "multiple-choice" : "open"),
    referenceText: card.referenceText || card.ayahReveal?.source || referenceText,
    referenceHint: card.referenceHint || "",
    sourceTitle: card.sourceTitle || card.ayahReveal?.source || referenceText || "HQuest",
    sourceUrl: "",
    explanation: card.explanation || "",
    themeAnchorText: card.themeAnchorText || card.themeOutcome || card.nameMeaning || "",
    options: Array.isArray(card.options) ? card.options : null,
    correctIndex: typeof card.correctIndex === "number" ? card.correctIndex : null,
    ayahReveal: card.ayahReveal || null,
    points: pts,
    difficulty: pts === 1 ? "easy" : pts === 2 ? "medium" : "hard",
  };
}

function pickByCategoryAndDifficulty(cards, catId, difficulty, limit = 11) {
  return shuffleDeck(
    cards.filter(card => card.category === catId && card.difficulty === difficulty)
  ).slice(0, limit);
}

function pickByDifficulty(cards, difficulty) {
  return cards.filter(card => card.difficulty === difficulty);
}

// Realm deck stays inside the selected difficulty tier.
function pickRealmDeck(cards, catId, difficulty) {
  return pickByCategoryAndDifficulty(cards, catId, difficulty, 11);
}

// Ultimate: 11 from each category at the selected difficulty, shuffled together.
function pickUltimate(cards, difficulty) {
  const perCat = ["quran", "sunnah", "ummah"].map(cat =>
    pickByCategoryAndDifficulty(cards, cat, difficulty, 11)
  );
  return shuffleDeck(perCat.flat());
}

function pickJamiBank(cards, difficulty) {
  const selectedDifficulty = shuffleDeck(pickByDifficulty(cards, difficulty));
  const categoryOrder = ["quran", "sunnah", "ummah", "hidayah"];
  const base = categoryOrder.flatMap(cat =>
    shuffleDeck(selectedDifficulty.filter(card => card.category === cat)).slice(0, 8)
  );
  const used = new Set(base.map(card => card.id));
  const wildcardPool = selectedDifficulty.filter(card => !used.has(card.id));
  const wildcard = shuffleDeck(wildcardPool).slice(0, 1);
  return shuffleDeck([...base, ...wildcard]);
}

function applyEasyMultipleChoice(card, selectedCards, allCards) {
  if (card.options?.length) return card;

  const correct = choiceLabelFor(card);
  if (!correct) return card;

  const pool = uniqueChoices([
    ...allCards.filter(candidate =>
      candidate.id !== card.id &&
      candidate.category === card.category &&
      candidate.difficulty === card.difficulty &&
      candidate.subTheme === card.subTheme
    ),
    ...allCards.filter(candidate =>
      candidate.id !== card.id &&
      candidate.category === card.category &&
      candidate.difficulty === card.difficulty
    ),
  ]).filter(candidate => choiceLabelFor(candidate) !== correct);

  const distractors = shuffleDeck(pool).slice(0, 3).map(choiceLabelFor);
  if (distractors.length < 3) return card;

  const options = shuffleDeck([correct, ...distractors]);
  return {
    ...card,
    questionMode: "multiple-choice",
    questionType: "multiple-choice",
    options,
    correctIndex: options.indexOf(correct),
  };
}

function applyQuranDifficultyBehavior(card, difficulty, quranLookup) {
  const verseRef = extractVerseReference(
    card.referenceText,
    card.sourceTitle,
    card.answerText,
    card.promptText,
    card.ayahReveal?.source,
  );
  const verse = verseRef ? quranLookup.get(`${verseRef.surah}:${verseRef.ayah}`) : null;

  const enriched = {
    ...card,
    sourceTitle: card.referenceText || card.sourceTitle,
  };

  if (card.ayahReveal) {
    enriched.arabicText = card.ayahReveal.arabic;
    enriched.translationText = card.ayahReveal.meaning;
    enriched.sourceTitle = card.ayahReveal.source;
    enriched.promptArabicText = card.promptArabicText || buildArabicExcerpt(card.ayahReveal.arabic);
  }

  if (!verse) return enriched;

  // Prefer canonical script from Quran repository when a verse is identified.
  enriched.arabicText = verse.arabic || enriched.arabicText || "";
  enriched.transliterationText = enriched.transliterationText || verse.transliteration || "";
  enriched.translationText = enriched.translationText || verse.translation_si || verse.translation_ya || "";
  enriched.sourceTitle = `${verse.surahName || `Surah ${verse.surah}`} ${verse.surah}:${verse.ayah}`;
  enriched.promptArabicText = enriched.promptArabicText || buildArabicExcerpt(verse.arabic);
  enriched.quranLocationChoice = formatQuranLocation(verse);
  enriched.quranCompletionChoice = extractArabicCompletion(verse.arabic);

  return enriched;
}

function applyReferenceBehavior(card) {
  if (!card.referenceText) return card;
  return {
    ...card,
    sourceTitle: card.referenceText,
  };
}

function applyMeaningAnchorBehavior(card) {
  return card;
}

function buildLegacyPrompt(card) {
  const lane = String(card.deckLane || "").toLowerCase();
  const subTheme = String(card.subTheme || "").toLowerCase();
  const source = String(card.sourceTitle || card.referenceText || "").toLowerCase();
  const currentPrompt = String(card.promptText || "");
  const answer = String(card.answerText || "").trim();

  if (!isAuthoringStylePrompt(currentPrompt)) return currentPrompt;

  if (lane.includes("hadith") || subTheme.includes("hadith") || source.includes("bukhari") || source.includes("muslim")) {
    if (answer.startsWith("...")) return "Complete this hadith teaching.";
    return "Which answer best matches this hadith teaching?";
  }

  if (lane.includes("history") || lane.includes("seerah") || subTheme.includes("history") || subTheme.includes("seerah")) {
    return "Which answer best matches this Seerah or Ummah clue?";
  }

  if (card.category === "sunnah") {
    return "Which answer best matches this Sunnah teaching?";
  }

  if (card.category === "hidayah") {
    return "Which answer best matches this Hidayah clue?";
  }

  if (card.category === "ummah") {
    return "Which answer best matches this Ummah clue?";
  }

  return "Which answer best matches this clue?";
}

function buildLegacyPromptSupport(card) {
  const lane = String(card.deckLane || "").toLowerCase();
  const subTheme = String(card.subTheme || "").toLowerCase();
  const source = String(card.sourceTitle || card.referenceText || "").trim();
  if (lane.includes("hadith") || subTheme.includes("hadith") || /bukhari|muslim/i.test(source)) {
    return source || "";
  }
  return "";
}

function isHadithStyleCard(card) {
  const lane = String(card.deckLane || "").toLowerCase();
  const subTheme = String(card.subTheme || "").toLowerCase();
  const source = String(card.sourceTitle || card.referenceText || "").toLowerCase();
  return lane.includes("hadith") || subTheme.includes("hadith") || /bukhari|muslim/.test(source);
}

function isCompletionStyleCard(card) {
  const prompt = String(card.promptText || "").toLowerCase();
  const answer = String(card.answerText || "").trim();
  return (
    answer.startsWith("...") ||
    prompt.includes(" complete") ||
    prompt.startsWith("complete") ||
    prompt.includes("___") ||
    prompt.includes(" fill in") ||
    prompt.includes("missing word")
  );
}

function buildSunnahSourceChoice(card) {
  const source = String(card.sourceTitle || card.referenceText || "").trim();
  if (source) return source;
  const answer = String(card.answerText || "").trim();
  const m = answer.match(/\(([^()]*?(?:Bukhari|Muslim)[^()]*)\)\s*$/i);
  return m ? m[1].trim() : "";
}

function inferLegacyQuestionType(card) {
  const difficulty = String(card.difficulty || "").toLowerCase();
  if (difficulty === "easy") return "multiple-choice";
  if (isCompletionStyleCard(card)) {
    return "fill-blank";
  }
  return "multiple-choice";
}

function applySunnahHardPatterns(card, selectedCards, allCards) {
  if (card.category !== "sunnah" || String(card.difficulty || "").toLowerCase() !== "hard" || !isHadithStyleCard(card)) {
    return null;
  }

  if (isCompletionStyleCard(card)) {
    const correct = choiceLabelFor(card);
    if (!correct) return null;
    const distractors = shuffleDeck(
      uniqueChoices([
        ...selectedCards.filter(candidate => candidate.id !== card.id && candidate.category === "sunnah" && candidate.subTheme === card.subTheme),
        ...allCards.filter(candidate => candidate.id !== card.id && candidate.category === "sunnah" && candidate.subTheme === card.subTheme),
      ]).map(choiceLabelFor).filter(choice => choice && choice !== correct)
    ).slice(0, 3);
    if (distractors.length < 3) return null;
    const options = shuffleDeck([correct, ...distractors]);
    return {
      ...card,
      promptText: "Complete this hadith teaching.",
      promptSupportText: buildSunnahSourceChoice(card),
      questionMode: "multiple-choice",
      questionType: "fill-blank",
      options,
      correctIndex: options.indexOf(correct),
    };
  }

  const correct = buildSunnahSourceChoice(card);
  if (!correct) return null;
  const distractors = shuffleDeck([
    ...new Set(
      [...selectedCards, ...allCards]
        .filter(candidate => candidate.id !== card.id && candidate.category === "sunnah" && isHadithStyleCard(candidate))
        .map(buildSunnahSourceChoice)
        .filter(choice => choice && choice !== correct)
    ),
  ]).slice(0, 3);
  if (distractors.length < 3) return null;
  const options = shuffleDeck([correct, ...distractors]);
  return {
    ...card,
    promptText: "Which source best matches this hadith teaching?",
    promptSupportText: card.answerText || "",
    answerText: correct,
    answerChoice: correct,
    questionMode: "multiple-choice",
    questionType: "multiple-choice",
    options,
    correctIndex: options.indexOf(correct),
  };
}

function applyHidayahHardPatterns(card, selectedCards, allCards) {
  if (card.category !== "hidayah" || String(card.difficulty || "").toLowerCase() !== "hard") {
    return null;
  }

  const basePool = uniqueChoices([
    ...selectedCards.filter(candidate => candidate.id !== card.id && candidate.category === "hidayah" && candidate.subTheme === card.subTheme),
    ...allCards.filter(candidate => candidate.id !== card.id && candidate.category === "hidayah" && candidate.subTheme === card.subTheme),
    ...allCards.filter(candidate => candidate.id !== card.id && candidate.category === "hidayah" && candidate.deckLane === card.deckLane),
  ]);

  if (isCompletionStyleCard(card)) {
    const correct = choiceLabelFor(card);
    if (!correct) return null;
    const distractors = shuffleDeck(
      basePool.map(choiceLabelFor).filter(choice => choice && choice !== correct)
    ).slice(0, 3);
    if (distractors.length < 3) return null;
    const options = shuffleDeck([correct, ...distractors]);
    return {
      ...card,
      promptText: "Complete this guidance teaching.",
      promptSupportText: buildLegacyPromptSupport(card),
      questionMode: "multiple-choice",
      questionType: "fill-blank",
      options,
      correctIndex: options.indexOf(correct),
    };
  }

  const correct = choiceLabelFor(card);
  if (!correct) return null;
  const distractors = shuffleDeck(
    basePool.map(choiceLabelFor).filter(choice => choice && choice !== correct)
  ).slice(0, 3);
  if (distractors.length < 3) return null;
  const options = shuffleDeck([correct, ...distractors]);
  return {
    ...card,
    promptText: "Which guidance answer best matches this prompt?",
    promptSupportText: buildLegacyPromptSupport(card),
    questionMode: "multiple-choice",
    questionType: "multiple-choice",
    options,
    correctIndex: options.indexOf(correct),
  };
}

function applyLegacyTriviaMultipleChoice(card, selectedCards, allCards) {
  if (card.category === "quran") return card;
  const sunnahHardOverride = applySunnahHardPatterns(card, selectedCards, allCards);
  if (sunnahHardOverride) return sunnahHardOverride;
  const hidayahHardOverride = applyHidayahHardPatterns(card, selectedCards, allCards);
  if (hidayahHardOverride) return hidayahHardOverride;
  if (["multiple-choice", "fill-blank", "sequence", "match", "speech"].includes(card.questionType)) {
    return {
      ...card,
      promptText: buildLegacyPrompt(card),
      promptSupportText: buildLegacyPromptSupport(card),
    };
  }

  const correct = choiceLabelFor(card);
  if (!correct) return card;

  const pool = uniqueChoices([
    ...selectedCards.filter(candidate =>
      candidate.id !== card.id &&
      candidate.category === card.category &&
      candidate.subTheme === card.subTheme &&
      candidate.deckLane === card.deckLane
    ),
    ...selectedCards.filter(candidate =>
      candidate.id !== card.id &&
      candidate.category === card.category &&
      candidate.subTheme === card.subTheme
    ),
    ...allCards.filter(candidate =>
      candidate.id !== card.id &&
      candidate.category === card.category &&
      candidate.subTheme === card.subTheme
    ),
    ...allCards.filter(candidate =>
      candidate.id !== card.id &&
      candidate.category === card.category &&
      candidate.deckLane === card.deckLane
    ),
  ]).filter(candidate => choiceLabelFor(candidate) !== correct);

  let distractors = shuffleDeck(pool).slice(0, 3).map(choiceLabelFor);
  if (distractors.length < 3) {
    const fallbackPool = uniqueChoices(
      allCards.filter(candidate => candidate.id !== card.id)
    )
      .map(choiceLabelFor)
      .filter(choice => choice && choice !== correct && !distractors.includes(choice));
    distractors = distractors.concat(shuffleDeck(fallbackPool).slice(0, 3 - distractors.length));
  }
  if (distractors.length < 3) {
    return {
      ...card,
      promptText: buildLegacyPrompt(card),
      promptSupportText: buildLegacyPromptSupport(card),
    };
  }

  const options = shuffleDeck([correct, ...distractors]);
  const questionType = inferLegacyQuestionType(card);
  return {
    ...card,
    promptText: buildLegacyPrompt(card),
    promptSupportText: buildLegacyPromptSupport(card),
    questionMode: "multiple-choice",
    questionType,
    options,
    correctIndex: options.indexOf(correct),
  };
}

function quranMeaningChoiceLabel(card) {
  return String(
    card.translationText ||
    card.answerChoice ||
    card.answerText ||
    ""
  ).trim();
}

function quranLocationChoiceLabel(card) {
  return String(card.quranLocationChoice || card.sourceTitle || card.referenceText || "").trim();
}

function quranCompletionChoiceLabel(card) {
  return String(card.quranCompletionChoice || "").trim();
}

function applyQuranMultipleChoice(card, selectedCards, allCards) {
  const quranPool = [
    ...selectedCards.filter(candidate => candidate.id !== card.id && candidate.category === "quran"),
    ...allCards.filter(candidate => candidate.id !== card.id && candidate.category === "quran"),
  ];

  if (card.difficulty === "medium") {
    const correct = quranLocationChoiceLabel(card);
    if (!correct) return card;
    const distractors = shuffleDeck(
      [...new Set(quranPool.map(quranLocationChoiceLabel).filter(choice => choice && choice !== correct))]
    ).slice(0, 3);
    if (distractors.length < 3) return card;
    const options = shuffleDeck([correct, ...distractors]);
    return {
      ...card,
      promptText: "Which Quran location matches this passage?",
      promptSupportText: card.translationText || "",
      answerText: correct,
      answerChoice: correct,
      questionMode: "multiple-choice",
      questionType: "multiple-choice",
      options,
      correctIndex: options.indexOf(correct),
    };
  }

  if (card.difficulty === "hard") {
    const correct = quranCompletionChoiceLabel(card);
    if (!correct) return card;
    const distractors = shuffleDeck(
      [...new Set(quranPool.map(quranCompletionChoiceLabel).filter(choice => choice && choice !== correct))]
    ).slice(0, 3);
    if (distractors.length < 3) return card;
    const options = shuffleDeck([correct, ...distractors]);
    return {
      ...card,
      promptText: "Which phrase best completes this Quran passage?",
      promptArabicText: buildArabicPromptWithBlank(card.arabicText || card.promptArabicText || ""),
      promptSupportText: card.translationText || "",
      answerText: correct,
      answerChoice: correct,
      questionMode: "multiple-choice",
      questionType: "fill-blank",
      options,
      correctIndex: options.indexOf(correct),
    };
  }

  const correct = quranMeaningChoiceLabel(card);
  if (!correct) return card;
  const distractors = shuffleDeck(
    [...new Set(quranPool.map(quranMeaningChoiceLabel).filter(choice => choice && choice !== correct))]
  ).slice(0, 3);
  if (distractors.length < 3) return card;
  const options = shuffleDeck([correct, ...distractors]);

  return {
    ...card,
    promptText: "Which meaning best matches this Quran passage?",
    answerText: correct,
    answerChoice: correct,
    questionMode: "multiple-choice",
    questionType: "multiple-choice",
    options,
    correctIndex: options.indexOf(correct),
  };
}

function buildQuranRepositoryChoicePool(quranLookup) {
  return Array.from(quranLookup.values()).map(verse => ({
    translationChoice: (verse.translation_si || verse.translation_ya || "").trim(),
    locationChoice: formatQuranLocation(verse),
    completionChoice: extractArabicCompletion(verse.arabic),
  }));
}

function applyQuranStudyCard(card, selectedCards, allCards, quranLookup) {
  const repoPool = buildQuranRepositoryChoicePool(quranLookup);
  const localPool = [
    ...selectedCards.filter(candidate => candidate.id !== card.id && candidate.category === "quran"),
    ...allCards.filter(candidate => candidate.id !== card.id && candidate.category === "quran"),
  ];
  const hasVerseBackedPassage = Boolean(card.arabicText && card.translationText && card.quranLocationChoice && card.quranCompletionChoice);
  const buildMeaningFallback = () => {
    const correct = quranMeaningChoiceLabel(card);
    if (!correct) {
      return {
        ...card,
        promptText: "Which meaning best matches this Quran passage?",
        promptSupportText: "",
        questionMode: "multiple-choice",
        questionType: "multiple-choice",
      };
    }
    const fallbackDistractors = shuffleDeck([
      ...new Set([
        ...repoPool.map(item => item.translationChoice),
        ...localPool.map(quranMeaningChoiceLabel),
      ].filter(choice => choice && choice !== correct)),
    ]).slice(0, 3);
    const options = fallbackDistractors.length >= 3
      ? shuffleDeck([correct, ...fallbackDistractors])
      : null;
    return {
      ...card,
      promptText: "Which meaning best matches this Quran passage?",
      promptSupportText: "",
      answerText: correct,
      answerChoice: correct,
      questionMode: "multiple-choice",
      questionType: "multiple-choice",
      options,
      correctIndex: options ? options.indexOf(correct) : null,
    };
  };

  if (card.difficulty === "medium" && hasVerseBackedPassage) {
    const correct = quranLocationChoiceLabel(card);
    if (!correct) return buildMeaningFallback();
    const distractors = shuffleDeck([
      ...new Set([
        ...repoPool.map(item => item.locationChoice),
        ...localPool.map(quranLocationChoiceLabel),
      ].filter(choice => choice && choice !== correct)),
    ]).slice(0, 3);
    if (distractors.length < 3) return buildMeaningFallback();
    const options = shuffleDeck([correct, ...distractors]);
    return {
      ...card,
      promptText: "Which Quran location matches this passage?",
      promptSupportText: card.translationText || "",
      answerText: correct,
      answerChoice: correct,
      questionMode: "multiple-choice",
      questionType: "multiple-choice",
      options,
      correctIndex: options.indexOf(correct),
    };
  }

  if (card.difficulty === "hard" && hasVerseBackedPassage) {
    const correct = quranCompletionChoiceLabel(card);
    if (!correct) return buildMeaningFallback();
    const distractors = shuffleDeck([
      ...new Set([
        ...repoPool.map(item => item.completionChoice),
        ...localPool.map(quranCompletionChoiceLabel),
      ].filter(choice => choice && choice !== correct)),
    ]).slice(0, 3);
    if (distractors.length < 3) return buildMeaningFallback();
    const options = shuffleDeck([correct, ...distractors]);
    return {
      ...card,
      promptText: "Which phrase best completes this Quran passage?",
      promptArabicText: buildArabicPromptWithBlank(card.arabicText || card.promptArabicText || ""),
      promptSupportText: card.translationText || "",
      answerText: correct,
      answerChoice: correct,
      questionMode: "multiple-choice",
      questionType: "fill-blank",
      options,
      correctIndex: options.indexOf(correct),
    };
  }

  return buildMeaningFallback();
}

async function shapeLegacyDeck(selectedCards, allCards, difficulty) {
  const needsQuranLookup = selectedCards.some(card => card.category === "quran");
  const quranLookup = needsQuranLookup ? await loadQuranRepository() : new Map();
  const firstPass = selectedCards.map(card => {
    let shaped = { ...card };

    if (difficulty === "easy") {
      shaped = applyEasyMultipleChoice(shaped, selectedCards, allCards);
    }

    if (shaped.category === "quran") {
      shaped = applyQuranDifficultyBehavior(shaped, difficulty, quranLookup);
    }

    shaped = applyReferenceBehavior(shaped);
    shaped = applyMeaningAnchorBehavior(shaped);
    return shaped;
  });

  return firstPass.map(card =>
    card.category === "quran"
      ? applyQuranStudyCard(card, firstPass, firstPass, quranLookup)
      : applyLegacyTriviaMultipleChoice(card, firstPass, firstPass)
  );
}

async function shapeLegacyDeckForReview(selectedCards, allCards) {
  const needsQuranLookup = selectedCards.some(card => card.category === "quran");
  const quranLookup = needsQuranLookup ? await loadQuranRepository() : new Map();

  const firstPass = selectedCards.map(card => {
    let shaped = { ...card };

    if (card.difficulty === "easy") {
      shaped = applyEasyMultipleChoice(shaped, allCards, allCards);
    }

    if (shaped.category === "quran") {
      shaped = applyQuranDifficultyBehavior(shaped, shaped.difficulty, quranLookup);
    }

    shaped = applyReferenceBehavior(shaped);
    shaped = applyMeaningAnchorBehavior(shaped);
    return shaped;
  });

  return firstPass.map(card =>
    card.category === "quran"
      ? applyQuranStudyCard(card, firstPass, firstPass, quranLookup)
      : applyLegacyTriviaMultipleChoice(card, firstPass, firstPass)
  );
}

// ─── Fallback decks (used if fetch fails) ───────────────────────────────────

const FALLBACK_QURAN = [
  {
    id: "quran-1-1", type: "quran",
    promptText: "In the name of Allāh, the Entirely Merciful, the Especially Merciful.",
    arabicText: "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
    transliterationText: "Bismi Allahi arrahmani arraheem",
    answerText: "Surah Al-Fatihah, Ayah 1",
    sourceTitle: "Quran.com",
    sourceUrl: "https://quran.com/1/1",
    points: 1,
  },
  {
    id: "quran-1-2", type: "quran",
    promptText: "[All] praise is [due] to Allāh, Lord of the worlds -",
    arabicText: "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ",
    transliterationText: "Alhamdu lillahi rabbi alAAalameen",
    answerText: "Surah Al-Fatihah, Ayah 2",
    sourceTitle: "Quran.com",
    sourceUrl: "https://quran.com/1/2",
    points: 1,
  },
  {
    id: "quran-112-1", type: "quran",
    promptText: "Say, 'He is Allāh, [who is] One,'",
    arabicText: "قُلْ هُوَ ٱللَّهُ أَحَدٌ",
    transliterationText: "Qul huwa Allahu ahad",
    answerText: "Surah Al-Ikhlas, Ayah 1",
    sourceTitle: "Quran.com",
    sourceUrl: "https://quran.com/112/1",
    points: 1,
  },
];

const FALLBACK_TWO_TILE = [
  {
    id: "ttc-fallback-1", type: "two-tile",
    symbol: "🕋", symbolName: "The Kaaba",
    promptText: "And proclaim to the people the ___ — they will come to you on foot and on every lean camel.",
    options: ["Hajj", "Salah", "Adhan", "Zakat"],
    correctIndex: 0,
    answerText: "Hajj",
    sourceTitle: "Quran 22:27",
    sourceUrl: null,
    explanation: "The Kaaba is the destination of the Hajj — the pilgrimage proclaimed in this ayah.",
    points: 1,
  },
  {
    id: "ttc-fallback-2", type: "two-tile",
    symbol: "🌙", symbolName: "Crescent Moon",
    promptText: "The month of Ramadan [is that] in which was revealed the ___, a guidance for the people.",
    options: ["Quran", "Torah", "Injeel", "Zabur"],
    correctIndex: 0,
    answerText: "Quran",
    sourceTitle: "Quran 2:185",
    sourceUrl: null,
    explanation: "The crescent moon announces Ramadan — the month in which the Quran was sent down.",
    points: 1,
  },
  {
    id: "ttc-fallback-3", type: "two-tile",
    symbol: "📖", symbolName: "Open Mushaf",
    promptText: "Read in the name of your ___ who created —",
    options: ["Lord", "Prophet", "Father", "Nation"],
    correctIndex: 0,
    answerText: "Lord",
    sourceTitle: "Quran 96:1",
    sourceUrl: null,
    explanation: "The mushaf begins with the first revealed command: Iqra — Read.",
    points: 1,
  },
];

// ─── Transform helpers ───────────────────────────────────────────────────────

function transformQuranCard(ayah) {
  return {
    id: `quran-${ayah.surah}-${ayah.ayah}`,
    type: "quran",
    promptText: ayah.translation_si || ayah.translation_ya || "",
    arabicText: ayah.arabic || "",
    transliterationText: ayah.transliteration || "",
    answerText: `Surah ${ayah.surahName || ayah.surah}, Ayah ${ayah.ayah}`,
    sourceTitle: "Quran.com",
    sourceUrl: `https://quran.com/${ayah.surah}/${ayah.ayah}`,
    points: 1,
  };
}

function transformTwoTileCard(card) {
  return {
    id: card.id,
    type: "two-tile",
    symbol: card.symbol.glyph,
    symbolName: card.symbol.name,
    promptText: card.quote.text_with_blank,
    options: card.quote.options,
    correctIndex: card.quote.correctIndex,
    answerText: card.quote.options[card.quote.correctIndex],
    sourceTitle: card.quote.source,
    sourceUrl: null,
    explanation: card.theme,
    points: 1,
  };
}

function normalizeSeasonalCard(card, config, difficulty) {
  const sourceLabel = config.label || "HQuest";
  const questionType = card.questionType || (config.id === "bonus" ? "speech" : "multiple-choice");
  const sequenceSteps = Array.isArray(card.sequenceSteps) ? card.sequenceSteps : null;
  const matchPairs = Array.isArray(card.matchPairs) ? card.matchPairs : null;
  const options = Array.isArray(card.options) ? card.options : null;
  return {
    id: String(card.id ?? `${config.id}-${Math.random().toString(36).slice(2, 8)}`),
    type: "trivia",
    packId: card.packId || config.id,
    deckName: sourceLabel,
    category: card.category || config.id,
    title: card.title || sourceLabel,
    promptText: card.promptText || card.question || "",
    answerText: card.answerText || card.answer || "",
    sourceTitle: card.sourceTitle || sourceLabel,
    sourceUrl: card.sourceUrl || "",
    explanation: card.explanation || "",
    difficulty: card.difficulty || difficulty || "medium",
    points: Number(card.points ?? (difficulty === "hard" ? 3 : difficulty === "easy" ? 1 : 2)),
    promptArabicText: card.promptArabicText || "",
    arabicText: card.arabicText || "",
    transliterationText: card.transliterationText || "",
    translationText: card.translationText || "",
    themeAnchorText: card.themeAnchorText || "",
    questionType,
    options: options ? [...options] : null,
    correctIndex: typeof card.correctIndex === "number" ? card.correctIndex : null,
    sequenceSteps,
    sequenceOptions: sequenceSteps ? shuffleDeck(sequenceSteps) : null,
    matchPairs,
    matchLeftOptions: matchPairs ? matchPairs.map(pair => pair.left) : null,
    matchRightOptions: matchPairs ? shuffleDeck(matchPairs.map(pair => pair.right)) : null,
    speechTargets: Array.isArray(card.speechTargets) ? card.speechTargets : [card.answerText || card.answer || ""].filter(Boolean),
    speechLocales: Array.isArray(card.speechLocales) ? [...card.speechLocales] : null,
    accuracyThreshold: typeof card.accuracyThreshold === "number" ? card.accuracyThreshold : 0.67,
    badgeLabel: card.badgeLabel || card.title || sourceLabel,
  };
}

function flattenSinglePassDeck(data) {
  if (!data || !Array.isArray(data.packs)) return [];

  return data.packs.flatMap(pack =>
    (Array.isArray(pack.cards) ? pack.cards : []).map(card => transformLegacyCard({
      id: card.id,
      packId: pack.packId || "",
      deckName: pack.deckName || data.deckName || "",
      cat: card.category,
      pts: Number(card.difficulty ?? 1),
      subTheme: card.subTheme || pack.packName || "Knowledge",
      question: card.question || "",
      answer: card.answer || "",
      referenceHint: card.referenceHint || "",
      referenceText: card.referenceHint || "",
      sourceTitle: card.referenceHint || pack.packName || data.deckName || "HQuest",
      nameOfAllah: card.nameOfAllah || "",
      nameMeaning: card.nameMeaning || "",
      explanation: card.formula || "",
      themeOutcome: card.themeOutcome || "",
    }))
  );
}

function transformFinaleNameCard(card) {
  return {
    id: String(card.id),
    type: "name-finale",
    packId: "allah-names-finale",
    deckName: "Ultimate",
    category: "names",
    title: "Allah's Names Finale",
    badgeLabel: "Allah's Names Finale",
    promptText: card.promptText || `Say the Name of Allah that means "${card.meaning}".`,
    answerText: `${card.transliteration} — ${card.meaning}`,
    sourceTitle: "99 Names of Allah",
    sourceUrl: "",
    explanation: card.reflectionPrompt || "",
    difficulty: "medium",
    points: 2,
    questionType: "speech",
    arabicText: card.arabic || "",
    transliterationText: card.transliteration || "",
    translationText: card.reflectionPrompt || "",
    themeAnchorText: card.meaning || "",
    options: null,
    correctIndex: null,
    sequenceSteps: null,
    sequenceOptions: null,
    matchPairs: null,
    matchLeftOptions: null,
    matchRightOptions: null,
    speechTargets: [card.transliteration || "", card.meaning || "", card.arabic || ""].filter(Boolean),
    speechLocales: ["en-US", "ar-SA"],
    accuracyThreshold: 0.67,
  };
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Main loaders ────────────────────────────────────────────────────────────

export async function loadDeck(config, difficulty = "medium") {
  try {
    if (config.deckType === "bank99") {
      const urls = Array.isArray(config.deckUrls) ? config.deckUrls : [config.deckUrl].filter(Boolean);
      const fetched = await Promise.all(urls.map(fetchJson));
      const all = fetched.flatMap(data => Array.isArray(data) ? data.map(transformLegacyCard) : []);
      const selected = config.id === "jami"
        ? pickJamiBank(all, difficulty)
        : pickByDifficulty(all, difficulty);
      return shapeLegacyDeck(selected, all, difficulty);
    }

    if (config.deckType === "single-pass-deck") {
      const urls = Array.isArray(config.deckUrls) ? config.deckUrls : [config.deckUrl].filter(Boolean);
      const decks = await Promise.all(urls.map(fetchJson));
      const all = decks.flatMap(flattenSinglePassDeck);
      const selected = config.id === "jami"
        ? pickUltimate(all, difficulty)
        : pickRealmDeck(all, config.id, difficulty);
      return shapeLegacyDeck(selected, all, difficulty);
    }

    if (config.deckType === "seasonal-pack") {
      const data = await fetchJson(config.deckUrl);
      const triviaCards = Array.isArray(data)
        ? (config.id === "bonus"
          ? data.map(transformFinaleNameCard)
          : data.map(card => normalizeSeasonalCard(card, config, difficulty)))
        : [];

      if (!config.finaleDeckUrl) return triviaCards;

      const finaleData = await fetchJson(config.finaleDeckUrl);
      const finaleCards = Array.isArray(finaleData)
        ? finaleData.map(transformFinaleNameCard)
        : [];
      return [...triviaCards, ...finaleCards];
    }

    const data = await fetchJson(config.deckUrl);

    if (config.deckType === "cards99") {
      const all = Array.isArray(data) ? data.map(transformLegacyCard) : [];
      const selected = config.id === "ultimate"
        ? pickUltimate(all, difficulty)
        : pickRealmDeck(all, config.id, difficulty);
      return shapeLegacyDeck(selected, all, difficulty);
    }

    // Legacy paths (kept for non-cards99 fallback)
    let cards;
    if (config.deckType === "quran") {
      const ayahs = Array.isArray(data) ? data : data.ayahs ?? [];
      cards = ayahs.map(transformQuranCard);
    } else {
      const challenges = Array.isArray(data) ? data : [];
      cards = challenges.map(transformTwoTileCard);
    }
    return shuffleDeck(cards).slice(0, 20);
  } catch (err) {
    console.warn("[deck-loader] Fetch failed, using fallback:", err.message);
    const fallback = config.deckType === "quran" ? FALLBACK_QURAN : FALLBACK_TWO_TILE;
    return shuffleDeck([...fallback]);
  }
}

export async function loadDeckForReview(config) {
  try {
    if (config.deckType === "bank99") {
      const urls = Array.isArray(config.deckUrls) ? config.deckUrls : [config.deckUrl].filter(Boolean);
      const fetched = await Promise.all(urls.map(fetchJson));
      const all = fetched.flatMap(data => Array.isArray(data) ? data.map(transformLegacyCard) : []);
      return shapeLegacyDeckForReview(all, all);
    }

    if (config.deckType === "single-pass-deck") {
      const urls = Array.isArray(config.deckUrls) ? config.deckUrls : [config.deckUrl].filter(Boolean);
      const decks = await Promise.all(urls.map(fetchJson));
      const all = decks.flatMap(flattenSinglePassDeck);
      return shapeLegacyDeckForReview(all, all);
    }

    if (config.deckType === "seasonal-pack") {
      const data = await fetchJson(config.deckUrl);
      return Array.isArray(data)
        ? (config.id === "bonus"
          ? data.map(transformFinaleNameCard)
          : data.map(card => normalizeSeasonalCard(card, config, card.difficulty || "medium")))
        : [];
    }

    const data = await fetchJson(config.deckUrl);

    if (config.deckType === "cards99") {
      const all = Array.isArray(data) ? data.map(transformLegacyCard) : [];
      return shapeLegacyDeckForReview(all, all);
    }

    if (config.deckType === "quran") {
      const ayahs = Array.isArray(data) ? data : data.ayahs ?? [];
      return ayahs.map(transformQuranCard);
    }

    const challenges = Array.isArray(data) ? data : [];
    return challenges.map(transformTwoTileCard);
  } catch (err) {
    console.warn("[deck-loader] Review fetch failed, using fallback:", err.message);
    const fallback = config.deckType === "quran" ? FALLBACK_QURAN : FALLBACK_TWO_TILE;
    return [...fallback];
  }
}

// Legacy — Ultimate now routes through loadDeck(ultimateConfig) directly.
export async function loadUltimateDeck(quranConfig, _twoTileConfig, difficulty) {
  return loadDeck({ ...quranConfig, id: "ultimate" }, difficulty);
}

export async function loadNamesDeck() {
  // Inline 99 Names — small dataset, no fetch needed
  const names = [
    { transliteration: "Ar-Rahman",           arabic: "الرحمن",               meaning: "The Most Gracious" },
    { transliteration: "Ar-Raheem",            arabic: "الرحيم",               meaning: "The Most Merciful" },
    { transliteration: "Al-Malik",             arabic: "الملك",                meaning: "The King / Sovereign" },
    { transliteration: "Al-Quddus",            arabic: "القدوس",               meaning: "The Most Pure / Holy" },
    { transliteration: "As-Salam",             arabic: "السلام",               meaning: "The Source of Peace" },
    { transliteration: "Al-Mu'min",            arabic: "المؤمن",               meaning: "The Guardian of Faith" },
    { transliteration: "Al-Muhaymin",          arabic: "المهيمن",              meaning: "The Overseer / Protector" },
    { transliteration: "Al-Aziz",              arabic: "العزيز",               meaning: "The Almighty" },
    { transliteration: "Al-Jabbar",            arabic: "الجبار",               meaning: "The Compeller" },
    { transliteration: "Al-Mutakabbir",        arabic: "المتكبر",              meaning: "The Supreme in Greatness" },
    { transliteration: "Al-Khaliq",            arabic: "الخالق",               meaning: "The Creator" },
    { transliteration: "Al-Bari'",             arabic: "البارئ",               meaning: "The Originator" },
    { transliteration: "Al-Musawwir",          arabic: "المصور",               meaning: "The Fashioner of Forms" },
    { transliteration: "Al-Ghaffar",           arabic: "الغفار",               meaning: "The Repeatedly Forgiving" },
    { transliteration: "Al-Qahhar",            arabic: "القهار",               meaning: "The All-Subduer" },
    { transliteration: "Al-Wahhab",            arabic: "الوهاب",               meaning: "The Bestower of Gifts" },
    { transliteration: "Ar-Razzaq",            arabic: "الرزاق",               meaning: "The Provider" },
    { transliteration: "Al-Fattah",            arabic: "الفتاح",               meaning: "The Opener" },
    { transliteration: "Al-'Alim",             arabic: "العليم",               meaning: "The All-Knowing" },
    { transliteration: "Al-Qabid",             arabic: "القابض",               meaning: "The Constrictor" },
    { transliteration: "Al-Basit",             arabic: "الباسط",               meaning: "The Expander" },
    { transliteration: "Al-Khafid",            arabic: "الخافض",               meaning: "The Abaser" },
    { transliteration: "Ar-Rafi'",             arabic: "الرافع",               meaning: "The Exalter" },
    { transliteration: "Al-Mu'izz",            arabic: "المعز",                meaning: "The Giver of Honour" },
    { transliteration: "Al-Mudhill",           arabic: "المذل",                meaning: "The Humiliator" },
    { transliteration: "As-Sami'",             arabic: "السميع",               meaning: "The All-Hearing" },
    { transliteration: "Al-Basir",             arabic: "البصير",               meaning: "The All-Seeing" },
    { transliteration: "Al-Hakam",             arabic: "الحكم",                meaning: "The Judge" },
    { transliteration: "Al-'Adl",              arabic: "العدل",                meaning: "The Just" },
    { transliteration: "Al-Latif",             arabic: "اللطيف",               meaning: "The Subtle / Kind" },
    { transliteration: "Al-Khabir",            arabic: "الخبير",               meaning: "The All-Aware" },
    { transliteration: "Al-Halim",             arabic: "الحليم",               meaning: "The Forbearing" },
    { transliteration: "Al-'Azim",             arabic: "العظيم",               meaning: "The Magnificent" },
    { transliteration: "Al-Ghafur",            arabic: "الغفور",               meaning: "The Forgiving" },
    { transliteration: "Ash-Shakur",           arabic: "الشكور",               meaning: "The Appreciative" },
    { transliteration: "Al-'Aliy",             arabic: "العلي",                meaning: "The Most High" },
    { transliteration: "Al-Kabir",             arabic: "الكبير",               meaning: "The Most Great" },
    { transliteration: "Al-Hafiz",             arabic: "الحفيظ",               meaning: "The Preserver" },
    { transliteration: "Al-Muqit",             arabic: "المقيت",               meaning: "The Sustainer" },
    { transliteration: "Al-Hasib",             arabic: "الحسيب",               meaning: "The Reckoner" },
    { transliteration: "Al-Jalil",             arabic: "الجليل",               meaning: "The Majestic" },
    { transliteration: "Al-Karim",             arabic: "الكريم",               meaning: "The Generous" },
    { transliteration: "Ar-Raqib",             arabic: "الرقيب",               meaning: "The Watchful" },
    { transliteration: "Al-Mujib",             arabic: "المجيب",               meaning: "The Responsive" },
    { transliteration: "Al-Wasi'",             arabic: "الواسع",               meaning: "The All-Encompassing" },
    { transliteration: "Al-Hakim",             arabic: "الحكيم",               meaning: "The Wise" },
    { transliteration: "Al-Wadud",             arabic: "الودود",               meaning: "The Loving" },
    { transliteration: "Al-Majid",             arabic: "المجيد",               meaning: "The Glorious" },
    { transliteration: "Al-Majeed",            arabic: "المجيد",               meaning: "The Most Glorious" },
    { transliteration: "Al-Ba'ith",            arabic: "الباعث",               meaning: "The Resurrector" },
    { transliteration: "Ash-Shahid",           arabic: "الشهيد",               meaning: "The Witness" },
    { transliteration: "Al-Haqq",              arabic: "الحق",                 meaning: "The Truth" },
    { transliteration: "Al-Wakil",             arabic: "الوكيل",               meaning: "The Trustee" },
    { transliteration: "Al-Qawiy",             arabic: "القوي",                meaning: "The All-Powerful" },
    { transliteration: "Al-Matin",             arabic: "المتين",               meaning: "The Firm" },
    { transliteration: "Al-Waliy",             arabic: "الولي",                meaning: "The Protecting Friend" },
    { transliteration: "Al-Hamid",             arabic: "الحميد",               meaning: "The Praiseworthy" },
    { transliteration: "Al-Muhsi",             arabic: "المحصي",               meaning: "The Counter" },
    { transliteration: "Al-Mubdi'",            arabic: "المبدئ",               meaning: "The Originator" },
    { transliteration: "Al-Mu'id",             arabic: "المعيد",               meaning: "The Restorer" },
    { transliteration: "Al-Muhyi",             arabic: "المحيي",               meaning: "The Giver of Life" },
    { transliteration: "Al-Mumit",             arabic: "المميت",               meaning: "The Taker of Life" },
    { transliteration: "Al-Hayy",              arabic: "الحي",                 meaning: "The Ever-Living" },
    { transliteration: "Al-Qayyum",            arabic: "القيوم",               meaning: "The Self-Subsisting" },
    { transliteration: "Al-Wajid",             arabic: "الواجد",               meaning: "The Finder" },
    { transliteration: "Al-Ahad",              arabic: "الأحد",                meaning: "The One" },
    { transliteration: "Al-Wahid",             arabic: "الواحد",               meaning: "The Unique / Singular" },
    { transliteration: "As-Samad",             arabic: "الصمد",                meaning: "The Eternal Refuge" },
    { transliteration: "Al-Qadir",             arabic: "القادر",               meaning: "The Able" },
    { transliteration: "Al-Muqtadir",          arabic: "المقتدر",              meaning: "The Powerful" },
    { transliteration: "Al-Muqaddim",          arabic: "المقدم",               meaning: "The Expediter" },
    { transliteration: "Al-Mu'akhkhir",        arabic: "المؤخر",               meaning: "The Delayer" },
    { transliteration: "Al-Awwal",             arabic: "الأول",                meaning: "The First" },
    { transliteration: "Al-Akhir",             arabic: "الآخر",                meaning: "The Last" },
    { transliteration: "Az-Zahir",             arabic: "الظاهر",               meaning: "The Manifest" },
    { transliteration: "Al-Batin",             arabic: "الباطن",               meaning: "The Hidden" },
    { transliteration: "Al-Wali",              arabic: "الوالي",               meaning: "The Governor" },
    { transliteration: "Al-Muta'ali",          arabic: "المتعالي",             meaning: "The Most Exalted" },
    { transliteration: "Al-Barr",              arabic: "البر",                 meaning: "The Source of Goodness" },
    { transliteration: "At-Tawwab",            arabic: "التواب",               meaning: "The Acceptor of Repentance" },
    { transliteration: "Al-Muntaqim",          arabic: "المنتقم",              meaning: "The Avenger" },
    { transliteration: "Al-'Afuw",             arabic: "العفو",                meaning: "The Pardoner" },
    { transliteration: "Ar-Ra'uf",             arabic: "الرؤوف",               meaning: "The Compassionate" },
    { transliteration: "Malik al-Mulk",        arabic: "مالك الملك",           meaning: "Owner of All Sovereignty" },
    { transliteration: "Dhul-Jalali wal-Ikram",arabic: "ذو الجلال والإكرام",   meaning: "Lord of Majesty and Honour" },
    { transliteration: "Al-Muqsit",            arabic: "المقسط",               meaning: "The Equitable" },
    { transliteration: "Al-Jami'",             arabic: "الجامع",               meaning: "The Gatherer" },
    { transliteration: "Al-Ghaniy",            arabic: "الغني",                meaning: "The Self-Sufficient" },
    { transliteration: "Al-Mughni",            arabic: "المغني",               meaning: "The Enricher" },
    { transliteration: "Al-Mani'",             arabic: "المانع",               meaning: "The Withholder" },
    { transliteration: "Ad-Darr",              arabic: "الضار",                meaning: "The Distresser" },
    { transliteration: "An-Nafi'",             arabic: "النافع",               meaning: "The Propitious" },
    { transliteration: "An-Nur",               arabic: "النور",                meaning: "The Light" },
    { transliteration: "Al-Hadi",              arabic: "الهادي",               meaning: "The Guide" },
    { transliteration: "Al-Badi'",             arabic: "البديع",               meaning: "The Incomparable Originator" },
    { transliteration: "Al-Baqi",              arabic: "الباقي",               meaning: "The Everlasting" },
    { transliteration: "Al-Warith",            arabic: "الوارث",               meaning: "The Inheritor" },
    { transliteration: "Ar-Rashid",            arabic: "الرشيد",               meaning: "The Guide to the Right Path" },
    { transliteration: "As-Sabur",             arabic: "الصبور",               meaning: "The Patient" },
  ];

  return shuffleDeck(names);
}
