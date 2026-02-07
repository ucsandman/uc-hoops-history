# UC Hoops History

**Live:** https://uc-hoops-history.vercel.app

UC hoops draft playground + matchup simulator.

Build drafts, make them public, then run head-to-head matchups (random opponent or pick a specific public opponent). Match pages include a win probability timeline, highlights, and a full recap.

---

## Stack
- Next.js App Router
- Postgres (Neon)
- Tailwind CSS
- Vercel

## Data
- Sports-Reference (College Basketball) → scraped into static JSON in `src/data/`
- Data builder script: `npm run build:data`
  - Supports ranges: `node scripts/build_uc_data.mjs --from 1950 --to 1969 --append`
  - Use `--append` for chunked builds (recommended to avoid rate limits)

## Eras
- Era definitions live in `src/data/eras.json`
- Draft UI reads eras dynamically and groups them by `group` (Coach / Conference / Decade / etc.)
- Optional helper: `node scripts/generate_eras_from_seasons.mjs` (generates coach spans from `seasons.json`)

---

## Key pages
- `/draft` – draft builder
- `/account` – manage drafts (rename, public/private)
- `/d/[id]` – draft page (team profile + compete)
- `/m/[id]` – match recap page
- `/leaderboard` – rankings
- `/players` – player list (supports `?era=`)
- `/compare` – all-time coach comparison
- `/hall` – quick links / starting points

---

## Core features

### Drafts
- Create and save a 5-man lineup (PG/SG/SF/PF/C)
- Rename drafts
- Public drafts (used for matchmaking / opponent picker)

### Compete
- **Compete**: generate a matchup vs a random public opponent in the same league
- **Choose opponent**: pick any public draft as your opponent

### Match pages
- Final score + halves + OT support
- Player of the game + box score
- Auto-generated highlights
- Score breakdown (debug math)
- Share match button
- **Win probability timeline chart** (scrubbable)
- NCAA halves clock (1H/2H), OT 5:00
- "Last possessions" derives from the actual possession timeline
  - includes buzzer/lead-change tags
  - adds plausible **player names + actions** (e.g., "Gary Clark offensive rebound, putback made 2")

---

## Local development

```bash
npm install
npm run dev
```

## Deploy notes (Vercel)
- Deployments are done on Vercel.
- If `vercel --prod` hangs on Windows (seen: socket hang ups during file upload), use the Vercel dashboard to redeploy the latest commit.
- Avoid running `vercel build` on Windows: it may fail with `EPERM` due to symlink creation in `.vercel/output`.

### Rebuild data

```bash
# full rebuild (may hit Sports-Reference rate limits)
npm run build:data

# safer chunked builds
node scripts/build_uc_data.mjs --from 2010 --to 2025 --append
```

Lint/build:

```bash
npm run lint
npm run build
```

> The app expects environment variables in `.env.local` (database connection, etc.).
>
> Quickstart: copy `.env.example` to `.env.local` and fill in `DATABASE_URL`.

---

## API routes
- `POST /api/match` – matchup vs random opponent
- `POST /api/rematch` – matchup between two specific drafts
- `GET /api/opponents?mode=top|sicko&exclude=<draftId>&q=<optional>` – list public opponents

---

## Simulation notes
The sim is possession-based (not a single formula score). It generates a possession timeline and derives:
- final score
- win probability series (simple model)
- last possessions

Simulation code:
- `src/lib/sim.ts`
