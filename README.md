# HikahQuest — Beta

Islamic trivia game built around the 99 Names of Allah. This repo contains
the public beta build; the workspace (xlsx authoring source, build scripts,
content intermediates) lives in a private working tree.

## Run locally

```bash
python3 -m http.server 8765 --bind 127.0.0.1
# then open http://localhost:8765/beta/index.html
```

## Layout

- `beta/` — the shipping app (HTML pages, JS modules, CSS)
- `beta/content/banks/` — generated 99-card category banks for the four master decks: Quran, Sunnah, Ummah, and Hidayah (Huda)
- `scripts/build-category-banks.mjs` — rebuilds the beta category banks from the wider authoring repo + seasonal pack sources
- `quran-repository.json` — Quranic ayah lookup (loaded at runtime)
- `manifest.json`, `sw.js`, `vercel.json` — PWA + deploy config
- `assets/`, `icons/`, `card-back.*` — static art
- `deck-*-four-theme-single-pass.json` — future content drops

## Deck System

The recommended HQ beta structure is a clean four-deck master set:

- Quran: revelation, surah, juz, and revelation timing
- Sunnah: meaning, theme, seerah, dua, deen, and lived model
- Ummah: history, fulfillment, warning, promise, and collective patterns
- Hidayah (Huda): guidance, application, connectors, and practical direction

See [HQ deck system spec](HQ_DECK_SYSTEM.md) for the final deck map and the easy/medium/hard question styles under each deck.

## License

Code is MIT (see `LICENSE`). Game content (decks, names data, art, copy)
is © Donya G. Berhan, LPC. All Rights Reserved.
