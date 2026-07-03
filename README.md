# 🦋 Wedding Invitation — Мухаммадхон

A cinematic, multilingual (RU / UZ) wedding invitation website. Pure HTML/CSS/JS,
no frameworks, no backend — deploys straight to GitHub Pages.

## Demo invitation links (replace before the real wedding!)

The repository ships with three encrypted demo guests:

| Guest | Link |
|---|---|
| Тётя Ксения (RU) | `?invite=1f-WNuYxVP38n380IsO2DA` |
| Азиз и семья (UZ) | `?invite=8GE09ZnEIaSJAntsni9tWg` |
| Сергей и Анна (RU) | `?invite=SI8wjGhPYnFsJIQVCPL8qg` |

Opening the site without a valid `?invite=` shows the elegant
"Invitation not found" screen — the guest list is never exposed.

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
| Music | put your file at `assets/music.mp3` (control appears automatically) |

## Managing guests

1. Edit `tools/guests.input.json` (see the format inside `tools/generate-guests.mjs`).
2. Run:
   ```bash
   node tools/generate-guests.mjs --base https://YOURNAME.github.io/REPO/
   ```
3. Commit the regenerated `data/guests.json` and send each guest their printed link.

Per-guest `weddingDate` / `weddingTime` overrides are supported (e.g. different
banquet times for different groups).

## Local preview

WebCrypto needs `https://` or `localhost`, so don't open `index.html` from disk:

```bash
python -m http.server 8080
# → http://localhost:8080/?invite=1f-WNuYxVP38n380IsO2DA
```

## Deploy to GitHub Pages

1. Create a repository and push this folder's contents to its root.
2. Settings → Pages → Deploy from branch → `main` / root.
3. Your invitations live at `https://YOURNAME.github.io/REPO/?invite=…`

## Project structure

```
index.html            single page, semantic, ARIA-annotated
css/                  base tokens · intro/cinematic · sections · animations
js/                   config · i18n · guest (WebCrypto) · countdown ·
                      particles (canvas engine) · intro (sequence) ·
                      audio · scroll · main
data/guests.json      encrypted guest database (safe to publish)
tools/                guest generator (Node ≥ 20) + private input
assets/               favicon, music.mp3 (added manually)
```

## Accessibility & performance

- Full `prefers-reduced-motion` support (the cinematic collapses to a crossfade,
  particles never start).
- Keyboard navigable, focus-visible rings, skip link, semantic headings.
- Canvas effects: DPR-capped, viewport-scaled particle counts, paused on hidden tabs.
- The map is a click-to-load facade — no third-party code until the guest asks for it.
