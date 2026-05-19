# Nearby Tournament Mode Spec

This is the recommended structure for the QR-based tournament layer.

## Purpose

Create a lightweight challenge mode for 3 or more nearby players that feels like a friendly battle round:

- family event
- community gathering
- study circle challenge
- friendly competition at a shared space

## Core Flow

1. Host opens a tournament lobby.
2. Host selects a deck.
3. The app generates a QR code for that round.
4. Nearby players scan to join.
5. Players enter a challenge queue.
6. The round starts when the host begins the timer.
7. Scores are shown at the end of the round.

## Privacy Rules

- Anonymous by default.
- No identity display unless permission is enabled.
- Nearby detection should only announce that another player is available to challenge.
- No public profile browsing in the beta.

## Permission States

### Anonymous

- Shows only a nickname or hidden avatar.
- Best default for public spaces.

### Shared Identity

- Shows name, team name, or avatar.
- Requires explicit opt-in.

### Challenge Only

- Allows challenge matching without revealing identity.
- Best for safe public use.

## Round Types

### 1-Minute Battle

- One timer.
- One player or one team answers at a time.
- Highest score wins.

### Same-Deck Battle

- Everyone plays the same deck.
- Best for fairness.
- Good for comparing Quran, Sunnah, Ummah, or Hidayah mastery.

### Shared-Deck Battle

- Host picks one deck for the whole room.
- Best for quick event play.

### Deck-Share Reward

- Strong performance can unlock a badge.
- Can also unlock a deck invite or a next-round advantage.

## Scoring

Suggested score weights:

- Easy = 1 point
- Medium = 2 points
- Hard = 3 points

Optional bonuses:

- fast answer bonus
- perfect round bonus
- no-miss streak bonus

## Mini Achievements

Keep achievements small and shareable.

Examples:

- 3 correct in a row
- perfect easy round
- hard-question streak
- deck master for the round
- fastest responder

## Team and Battle Names

Players should be able to choose:

- team name
- battle name
- room name
- round title

## Community Use

This mode is suitable for:

- youth group nights
- family gatherings
- masjid events
- study circles
- classroom-style review

## Beta Scope Rule

For beta, keep the implementation simple:

- QR join
- anonymous default
- timed rounds
- score display
- team name support
- badge unlocks

Leave true Bluetooth auto-discovery, proximity notifications, and full device pairing as a later phase unless the technical layer is already available.