# HQ Deck System Spec

This is the clean recommended setup for the HQ game.

## Master Decks

1. Quran
- Focus: revelation and context
- Core content: surah, juz, revelation timing
- Purpose: teach where the message came from and how it is situated in the revelation flow

2. Sunnah
- Focus: meaning and theme
- Core content: dua, deen, faith, seerah, prophets, lived model
- Purpose: teach what the message means in practice and how it is lived

3. Ummah
- Focus: history and fulfillment
- Core content: historical fulfillment, future warning, promise, collective lessons
- Purpose: teach the communal and historical pattern of the message

4. Hidayah (Huda)
- Focus: guidance and application
- Core content: connectors, practical direction, decision-making, path correction
- Purpose: teach how to use the message

## Difficulty Ladder

Each deck should use the same three difficulty levels.

### Easy
- Pattern: direct recall
- Goal: identify the item, the source, or the category
- Answer style: short, concrete, usually one fact

### Medium
- Pattern: meaning recall
- Goal: explain the main idea in plain language
- Answer style: one short sentence or a brief theme statement

### Hard
- Pattern: connective or applied recall
- Goal: link the item to context, history, or application
- Answer style: explain the connection, not just the fact

## Question Styles by Deck

### Quran

Easy
- "Which surah is this?"
- "Is this Makki or Madani?"
- "Which juz does this belong to?"

Medium
- "What is the main theme of this surah?"
- "What broader message does this juz carry?"
- "What kind of revelation context is this passage in?"

Hard
- "How does this surah connect to the larger flow of the juz?"
- "What does this passage reveal about the situation of the ummah at the time?"
- "Why does this revelation matter in the larger revelation timeline?"

### Sunnah

Easy
- "Which hadith or seerah moment is this?"
- "Who is the Prophet or companion involved?"
- "What is the basic meaning of this teaching?"

Medium
- "What theme does this hadith teach?"
- "What is the lived lesson of this seerah moment?"
- "How does this reflect deen, faith, or adab?"

Hard
- "How does this Sunnah teaching shape practical behavior today?"
- "What deeper meaning connects this hadith to a Qur'an theme?"
- "How does this example model guidance in real life?"

### Ummah

Easy
- "What historical event or community pattern is this?"
- "Is this a warning, promise, or fulfillment question?"
- "Which group or era is being referenced?"

Medium
- "What does this event teach about the community?"
- "What pattern repeats here across history?"
- "What promise or warning is being made to the ummah?"

Hard
- "How does this event show the outcome of obedience or disobedience?"
- "What fulfillment does this point to later in history?"
- "How does this shape collective responsibility?"

### Hidayah (Huda)

Easy
- "What is the practical guidance here?"
- "What should the believer do?"
- "What connector or bridge links this to another deck?"

Medium
- "How does this guidance apply in daily life?"
- "What correction or direction is being given?"
- "How does this help the user move from knowledge to action?"

Hard
- "How does this guidance tie Quran, Sunnah, and Ummah together?"
- "What is the applied path this card is teaching?"
- "How does this change behavior, not just understanding?"

## Recommended Card Shape

Each card should have:

- deck
- difficulty
- question
- answer
- theme tag
- connector tag
- source note

## Existing Bank Reallocation

The current generated banks are already reclassified into this system by metadata:

- `deckFocus` marks the master deck lane
- `deckLane` marks the internal question lane within that deck
- `difficulty` and `questionStyle` map the old generated roles into easy, medium, and hard

## Design Rule

Keep the decks distinct:

- Quran = revelation and context
- Sunnah = meaning and theme
- Ummah = history and fulfillment
- Hidayah = guidance and application

That keeps duplication low and makes the HQ game easier to learn.