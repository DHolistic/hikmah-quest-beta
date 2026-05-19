# AM Next To-Do (Compact)

## Quick Summary

- Beta now includes the new tournament flow in Team Hub with QR join, nearby challenge prompts, and timed rounds.
- Four deck system is reallocated and aligned to Quran, Sunnah, Ummah, and Hidayah.
- New sub-category structure is active via deck metadata (deck focus, lane, and difficulty mapping).

## AM Priorities

1. Smoke test the new beta game flow end to end.
2. Validate tournament mode behavior with 3+ participants.
3. Verify new sub-category mapping and question style quality.
4. Capture issues and lock release notes.

## Test Plan (AM)

### A. Core Beta Flow

- Open index, pick each of the 4 master decks, and enter gameplay.
- Confirm easy, medium, and hard behavior still scores correctly.
- Confirm timed round appears and counts down in gameplay.
- Confirm round ends correctly when timer reaches zero.

### B. Team Hub + Tournament

- Create room as host and verify code display.
- Verify QR invite renders and link copy works.
- Join from second device/tab using code and using invite query.
- Confirm tournament start remains disabled until at least 3 players are present.
- Start tournament and verify team score updates during play.
- Confirm final result and achievement unlock behavior.

### C. Nearby / Phase-2 Proximity

- Enable nearby detection with opt-in checked.
- Verify nearby challenge prompt appears when peer is detected.
- Confirm accept flow starts or prepares tournament correctly.
- Confirm disable turns off prompts cleanly.

### D. Sub-Category / Deck Mapping QA

- Spot-check each bank for deck focus correctness:
  - Quran -> revelation-and-context
  - Sunnah -> meaning-and-theme
  - Ummah -> history-and-fulfillment
  - Hidayah -> guidance-and-application
- Spot-check lane labels and difficulty mapping on sample cards.
- Confirm no duplicate or contradictory category labels in visible UI text.

## Bug Logging Format

For each issue, log:

- Page
- Deck
- Mode
- Steps
- Expected
- Actual
- Severity (P1/P2/P3)

## Release-Ready Exit Criteria

- No P1 blockers in tournament, timer, or deck loading.
- Nearby opt-in and prompt flow behaves consistently.
- Deck/category labeling is coherent across all 4 master decks.
- AM smoke test passes on web and at least one native shell target.

## If Time Allows

- Polish tournament prompt wording for family/community events.
- Add one achievement card or banner in results for top performer.
- Prepare a short beta announcement line for testers.
