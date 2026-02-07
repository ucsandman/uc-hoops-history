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

---

## Key pages
- `/draft` – draft builder
- `/account` – manage drafts (rename, public/private)
- `/d/[id]` – draft page (team profile + compete)
- `/m/[id]` – match recap page
- `/leaderboard` – rankings
- `/players` – player list

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
- "Last possessions" derives from the actual possession timeline (real buzzer tags)

---

## Local development

```bash
npm install
npm run dev
```

Lint/build:

```bash
npm run lint
npm run build
```

> The app expects environment variables in `.env.local` (database connection, etc.).

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
