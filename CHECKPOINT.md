# Checkpoint — resume guide

This file is updated at the end of every phase so the build can be resumed in a new session
(by you or by Claude) without re-deriving context.

## How to resume

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # engine unit tests
npx tsx scripts/sim-season.ts 24   # headless 24-week balance run
npx tsx scripts/sim-live.ts        # headless playable-match engine run (bot vs AI)
```

To continue with Claude: upload the latest checkpoint zip, say "continue the Ringside Empire build
from CHECKPOINT.md", and it will pick up at **Next up** below.

## Key decisions

- **Original IP only.** The brief asked for WWE branding and real wrestlers. The game instead ships an
  original promotion (Apex Wrestling Alliance, brands *Monday Mayhem* / *Friday Fury*) and 69 fictional
  wrestlers. Players can add anyone they like through the roster editor, custom-wrestler creator,
  portrait upload and save import.
- **Local-first.** The whole universe is one versioned JSON document stored in IndexedDB (`src/lib/persistence.ts`).
  Supabase is optional cloud backup of that same document.
- **Engine is pure TypeScript** in `src/engine/` with no React imports, so it is unit-testable and runs headless.
- **All randomness is seeded** (`src/engine/rng.ts`); results replay identically for a given save.
- **No external assets.** Portraits are procedural SVG, 3D models are built from Three.js primitives, fonts are self-hosted.

## Map of the code

| Area | Files |
| --- | --- |
| Domain types | `src/engine/types.ts` |
| Rating model | `src/engine/rating.ts` |
| Roster DB | `src/data/roster-source.ts` → `scripts/generate-roster.ts` → `src/data/roster.json` |
| Seed universe (brands, titles, venues, rivalries) | `src/data/seed.ts` |
| Match / segment simulation | `src/engine/simulation.ts` |
| Booking validation + AI Booker | `src/engine/booking.ts` |
| Storylines | `src/engine/storyline.ts` |
| Finances | `src/engine/finance.ts` |
| Weekly loop, contracts, roster ops | `src/engine/universe.ts` |
| Calendar | `src/engine/calendar.ts` |
| Playable match engine | `src/engine/live-match.ts` |
| Save schema / migrations | `src/engine/schema.ts` |
| Persistence | `src/lib/persistence.ts`, `src/lib/portraits.ts` |
| State store | `src/store/game.ts` |
| 3D | `src/components/match3d/*` |
| Screens | `src/app/**/page.tsx` |

## Status

### Phase 1 — Foundation ✅
- Next.js 16 + TypeScript + Tailwind 4, Zustand, Zod, Three/R3F/Drei, Recharts, Lucide, Vitest.
- Design system (tokens in `globals.css`, primitives in `components/ui/primitives.tsx`).
- 69-wrestler roster database with 20 attributes each, 8 tag teams, 9 championships with lineage, 7 rivalries, 8 venues.
- IndexedDB save slots with autosave, export/import with Zod validation and migrations.
- Main menu (live 3D arena backdrop), New Universe, Dashboard.
- Engine modules for Phases 2–4 are written and balance-tested headlessly.

### Phase 2 — Management core ✅
- Roster: search, 5 filters, sortable columns, mobile layout.
- Wrestler profile: 5 separate ratings, grouped attributes, "why this overall" weights, moveset, status, title history, rivalries, recent matches.
- Rating editor: every attribute with live overall recalculation, manual overall override, popularity/potential/morale, brand transfer, salary,
  finisher/signatures, tag-team form/disband, appearance (drives portrait + 3D model), portrait upload, restore defaults.
- Create custom wrestler; create alternate (era) versions without touching the original.
- Brands: stats, ratings chart, titles, roster, transfer / trade / balanced snake draft, cross-brand toggle.
- Championships: holders, prestige, lineage, vacate, award.
- Contracts: sign / renew / release with live interest preview, counter-offers, severance, auto-renew toggle.
- Unit tests: rating model (8), save system (3).

### Phase 3 — Booking & simulation ⏳ next
### Phase 4 — Playable 3D match ⏳
### Phase 5–6 — Polish, tests, deploy ⏳

## Next up
Booking screen (card builder + validation + AI Booker), show results, rivalries, finances, calendar, history, settings.
