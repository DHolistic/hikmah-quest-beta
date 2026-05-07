# Hikmah Quest — Beta

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
- `quran-repository.json` — Quranic ayah lookup (loaded at runtime)
- `manifest.json`, `sw.js`, `vercel.json` — PWA + deploy config
- `assets/`, `icons/`, `card-back.*` — static art
- `deck-*-four-theme-single-pass.json` — future content drops

## License

Code is MIT (see `LICENSE`). Game content (decks, names data, art, copy)
is © Donya G. Berhan, LPC. All Rights Reserved.
