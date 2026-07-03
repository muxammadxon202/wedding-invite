# 🦋 Wedding Invitation — Мухаммадхон & Зилолахон

A cinematic, multilingual (RU / UZ) wedding invitation website.
Pure HTML/CSS/JS — no frameworks, no backend, deploys straight to GitHub Pages.

**Live:** https://muxammadxon202.github.io/wedding-invite/
*(opening without a personal `?invite=` link shows the "Invitation not found" screen — the guest list is never exposed)*

## Adding a guest (one command)

```bash
node tools/add-guest.mjs "Хотинжон" "Hotinjon" --f
```

Flags: `--f` female · `--m` male · `--family` family greeting · `--lang ru|uz` (default `uz`) ·
`--greeting-ru "…"` / `--greeting-uz "…"` for a custom greeting.

The script appends the guest to the private list, rebuilds the encrypted
database and prints a ready-to-send link. Then publish:

```bash
git add data/guests.json && git commit -m "guest" && git push
```

Existing links always stay valid — tokens are persisted in
`tools/guests.input.json` and survive re-runs.

To reprint every guest's link at any time:

```bash
node tools/generate-guests.mjs
```

## How the security works

- Each guest gets a random **128-bit token** (base64url) that exists only in their link.
- `data/guests.json` contains **no readable data**: per guest it stores a
  SHA-256 lookup hash and an **AES-256-GCM encrypted** payload whose key is
  derived from the token itself (different hash domains for lookup vs. key).
- Downloading `guests.json` reveals nothing — without a token no record can
  be decrypted, and tokens are infeasible to guess (2¹²⁸ space).
- `tools/guests.input.json` (plaintext names) is **gitignored** — never deploy it.

## Editing content

| What | Where |
|---|---|
| Names, date, time, venue, schedule times, contacts | [js/config.js](js/config.js) |
| All texts, both languages | [js/i18n.js](js/i18n.js) |
| Page `<title>` / OG tags | [index.html](index.html) `<head>` |
| Music | `assets/music/2.mp3` (path set in `js/config.js` → `musicSrc`) |

Per-guest `weddingDate` / `weddingTime` overrides are supported (e.g. different
banquet times for different groups).

## Local preview

WebCrypto needs `https://` or `localhost`, so don't open `index.html` from disk:

```bash
python -m http.server 8123
# → http://localhost:8123/?invite=<token from generate-guests output>
```

## Project structure

```
index.html            single page, semantic, ARIA-annotated
css/                  base tokens · intro/cinematic · sections · animations
js/                   config · i18n · guest (WebCrypto) · countdown ·
                      particles (canvas engine) · intro (sequence) ·
                      audio · scroll · main
data/guests.json      encrypted guest database (safe to publish)
tools/                add-guest.mjs · generate-guests.mjs (Node ≥ 20) + private input
assets/               floral art, favicon, music
```

## Accessibility & performance

- Full `prefers-reduced-motion` support (the cinematic collapses to a crossfade,
  particles never start).
- Keyboard navigable, focus-visible rings, skip link, semantic headings.
- Canvas effects: DPR-capped, viewport-scaled particle counts, paused on hidden
  tabs, adaptive quality governor on slow devices.
- The map is a click-to-load facade — no third-party code until the guest asks for it.
