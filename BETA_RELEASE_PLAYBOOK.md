# Hikmah Quest Beta Release Playbook

This is the recommended ship-ready structure for the beta release.

## Release Count

Ship **one beta package** with **four master decks** inside it.

### Included Decks

1. Quran
2. Sunnah
3. Ummah
4. Hidayah (Huda)

### Included Play Lanes

Each deck carries the same three difficulty styles:

- Easy
- Medium
- Hard

That gives the beta a clean, repeatable system without multiplying the app into separate products.

## Recommended Beta Shape

The beta should feel like one complete game with four ways to play it:

1. Study mode
2. Pass-and-play mode
3. Team timed mode
4. Local room mode

## What Ships Now

These pieces already fit the current beta shell or can be used with the current deck structure:

- Four master decks
- Difficulty selection
- Solo play
- Team play
- Offline-first behavior
- Same-browser / same-device room sync
- Room code join flow
- Scorekeeping
- Host and player lobby flow

## What to Add for the Beta Launch Experience

### 1. 1-Minute Challenge

Use a one-minute round as the main party format.

Rules:

- One question at a time
- Timer starts at round start
- Correct answers earn points
- Hard questions can earn more points than easy questions
- Highest score at the end wins

Suggested scoring:

- Easy = 1 point
- Medium = 2 points
- Hard = 3 points

### 2. Team Mode

Use this for family, friends, or small group play.

Requirements:

- Team name entry
- Team score display
- Host-controlled timer
- Turn indicator
- Final score screen

Suggested flow:

1. Create room
2. Enter team name
3. Pick deck
4. Pick difficulty mix
5. Start timer
6. Play for 1 minute or a chosen round length
7. Show winner

### 3. Pass-and-Play Phone Mode

Use this for one phone passed around a circle.

Requirements:

- One device
- One timer
- One score board
- Manual turn switch
- Next-player handoff after each round

This is the simplest family mode for homes, study circles, and small events.

### 4. Local Community / Family Space

Use this as a community table or discussion wall, not a public social network.

Suggested function:

- One question appears
- Each person answers aloud or on paper
- The group compares answers
- A host records the best response or highest score
- Optional short reflection prompt appears after each round

If you want a Reddit-style feel, keep it as a **discussion wall** with:

- prompt
- answer
- reaction
- follow-up reflection

Do not make it open-ended public posting in the beta unless moderation is in place.

### 5. Nearby QR Tournament Mode

Use this for group events where three or more players are physically near each other.

Core idea:

- A player opens a tournament lobby
- A QR code is displayed on the host screen
- Nearby players scan the QR code to join the challenge
- Players remain anonymous by default unless they explicitly allow identity sharing
- If permission is enabled, the app can show nearby participants and invite a challenge similar to a nearby-device prompt

Round rules:

- Best for 3+ participants
- One-minute or timed challenge rounds
- Highest score wins the round
- Players may battle using the same deck or a shared deck choice
- Winning can unlock a small badge, mini achievement, or streak marker

Battle styles:

- Same-deck battle: everyone answers from the same deck
- Shared-deck battle: the host chooses one deck for the round
- Deck-share reward: strong performance can unlock a shareable deck invite or next-round access

Privacy rules:

- Anonymous by default
- Identity revealed only with explicit permission
- Nearby alert should say only that another user is in range and a challenge is available
- No open user list unless the participant opts in

This is the closest fit to an "airdrop-style" encounter without making the beta dependent on always-on Bluetooth discovery.

See [Nearby Tournament Spec](TOURNAMENT_MODE_SPEC.md) for the ready-to-use rule set.

## Bluetooth Note

The current beta already supports offline-style local coordination through browser messaging and room codes.

If you want true Bluetooth team play later, treat it as a **Phase 2 feature**:

- device pairing
- nearby join
- local team sync
- no internet required

For the tournament mode, keep the beta promise as QR-first nearby play, with Bluetooth-style discovery treated as the later technical expansion.

For the beta release, keep the promise smaller and safer:

- room-code local play now
- Bluetooth support later

## Ready-to-Go Mode Map

### A. Solo Study

Best for:

- one player
- memorization
- learning the deck system

Decks:

- Quran
- Sunnah
- Ummah
- Hidayah

### B. Pass-and-Play

Best for:

- one phone
- family use
- simple offline play

Decks:

- any of the four master decks

### C. Team Timed

Best for:

- two or more teams
- timer-based competition
- score keeping

Decks:

- Quran for revelation/context rounds
- Sunnah for meaning/theme rounds
- Ummah for history/fulfillment rounds
- Hidayah for guidance/application rounds

### D. Local Room Play

Best for:

- same-browser tabs
- nearby users
- room-code join
- coordinated host/player play

## Community Score Rule

To keep the game fair and easy to explain:

- Easy questions reward recall
- Medium questions reward understanding
- Hard questions reward connection and application

Tie-breakers:

- faster answer
- fewer misses
- higher hard-question count

## Suggested Beta Launch Message

"Hikmah Quest Beta is a four-deck learning game with solo, pass-and-play, and team modes. Players can study revelation, meaning, history, and guidance through timed play, local room play, and family-friendly challenge rounds."

## Launch Recommendation

Do not split this into multiple public apps for beta.

Ship one beta package with:

- 4 master decks
- 3 difficulty levels
- 4 play modes
- 1-minute challenge option
- local room sync
- pass-and-play fallback

That keeps the release coherent and easy to explain.

## AM Next To-Do (Compact)

### Quick Summary

- Tournament flow is now in Team Hub with QR join, nearby challenge prompts, and timed rounds.
- Four-deck structure is aligned to Quran, Sunnah, Ummah, and Hidayah.
- Sub-category metadata is active via deck focus, lane, and difficulty mapping.

### Morning Priorities

1. Smoke test the new beta game flow end to end.
2. Validate tournament mode with 3+ participants.
3. Verify sub-category mapping and question quality.
4. Log issues and lock release notes.

### Quick AM Test Pass

- Confirm each master deck loads and plays across easy, medium, and hard.
- Confirm timer countdown appears and auto-ends the round.
- Confirm room create, QR invite, link copy, and join-by-code all work.
- Confirm tournament start is blocked below 3 players.
- Confirm nearby detection prompt appears after opt-in and can be accepted/dismissed.
- Confirm achievements appear after round completion.

### Release Exit Criteria

- No P1 blockers in deck loading, tournament start, timer, or score sync.
- Nearby opt-in flow is consistent.
- Category labels and sub-category mapping are coherent across all decks.