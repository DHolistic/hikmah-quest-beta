/* ═══════════════════════════════════════════════════════════════
   HIKMAH QUEST · MULTIPLE-CHOICE AUGMENTER
   Most cards in cards-99.json don't ship with options/correctIndex.
   When MCQ mode is on, we generate 3 distractors per card from the
   pool of answers in the same deck.
   ═══════════════════════════════════════════════════════════════ */

function pick(arr, n, exclude) {
  const pool = arr.filter(x => x && x !== exclude);
  // Fisher-Yates partial shuffle
  for (let i = pool.length - 1; i > 0 && i > pool.length - 1 - n; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(-n);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getCorrectAnswer(card) {
  // Prefer the choice label if the deck-loader split it from the reference.
  // Falls back to the raw answerText.
  return (card.answerChoice ?? card.answerText ?? card.answer ?? "").trim();
}

export function augmentDeckWithMcq(deck) {
  if (!Array.isArray(deck) || deck.length === 0) return deck;

  // Pool by category for more relevant distractors; fall back to whole deck.
  const byCategory = {};
  for (const c of deck) {
    const cat = c.category ?? c.cat ?? "_default";
    (byCategory[cat] ??= []).push(getCorrectAnswer(c));
  }
  const allAnswers = deck.map(getCorrectAnswer);

  return deck.map(card => {
    if (Array.isArray(card.options) && card.options.length >= 2) {
      // Already has options — leave them alone, just normalise correctIndex
      return card;
    }
    const correct = getCorrectAnswer(card);
    if (!correct) return card;

    const cat = card.category ?? card.cat ?? "_default";
    const sameCat = byCategory[cat] ?? allAnswers;
    let distractors = pick(sameCat, 3, correct);
    // Top up from the global pool if a small category leaves us short
    if (distractors.length < 3) {
      const need = 3 - distractors.length;
      const extra = pick(allAnswers, need, correct).filter(x => !distractors.includes(x));
      distractors = distractors.concat(extra);
    }
    // De-dupe defensively
    distractors = [...new Set(distractors)].slice(0, 3);

    const options = shuffle([correct, ...distractors]);
    return {
      ...card,
      options,
      correctIndex: options.indexOf(correct),
    };
  });
}
