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

- **Personal-use project.** Ships the real WWE / AEW / Legends men's roster and show branding (the owner
  plays it privately). Roster lives in `src/data/roster-source.ts` → `npm run roster`.
- **Local-first.** The whole universe is one versioned JSON document stored in IndexedDB (`src/lib/persistence.ts`).
  Supabase is optional cloud backup of that same document.
- **Engine is pure TypeScript** in `src/engine/` with no React imports, so it is unit-testable and runs headless.
- **All randomness is seeded** (`src/engine/rng.ts`); results replay identically for a given save.
- **3D assets.** One CC0 MakeHuman body (`public/models/human.bin`) + baked AO (`human_ao.bin`); portraits are
  rendered from the 3D model. Heavy tools (Blender) are installed only temporarily and removed afterwards.

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
| Promo dialogue | `src/engine/dialogue.ts` |
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

### Phase 3 — Booking & simulation ✅
- `/booking` index and `/booking/[showId]` card builder: show settings (venue, ticket price, marketing, live
  attendance/revenue projection), add/edit/reorder (drag + up/down) segments, participants, match type,
  stipulation, title, rivalry link, duration, AI-simulated vs booked outcome, main event, live validation,
  AI Booker recommendations with score + reasons and accept / reject / replace-all, "Play this match" link.
- `/shows/[id]` results: rating, stars, attendance, viewership, satisfaction, money breakdown, per-segment
  summaries with quality breakdown, popularity changes.
- `/rivalries`: stage tracker, intensity/fan interest, event timeline, book confrontation/match on next show,
  pause/resume/end/edit, create rivalry, storyline suggestions (contenders, turns, team splits).
- `/finances`: ledger-driven KPIs, revenue vs expenses chart, cash + forecast chart, by-category, by-brand, transactions.
- `/calendar`: 8-week schedule, PLEs, booked title matches, contract expiries, injury returns.
- `/history`: search, source / rating / title filters, sort by best, paging.
- `/settings`: difficulty, match length, booking rules, key remapping (swap on clash), rating-weight overrides per style,
  save slots / export / import / typed-confirm reset, optional Supabase cloud saves, credits.
- Supabase: `src/lib/cloud.ts`, `supabase/migrations/0001_universe_saves.sql` (RLS), `.env.example`.
- All Phase 3 screens browser-tested once; fixes applied after that pass: AI Booker max 2 talk segments per weekly show,
  talk-segment quality lowered + "too much talking" penalty, match quality soft cap above 85 + re-anchored star scale,
  rivalry rematch penalty halved, audience-demand mean reversion, default weekly venues ≥15k seats, 4 weeks of shows
  open for booking, local-date fix for the start date, finance chart cursor/forecast fixes, match-up card layout.
  24-week headless season after fixes: avg 3.3★, max 4.5★, demand stable ~60, cash 5M → 18M with good booking.
### Extra (requested): muscular models + 3D character studio ✅
- `src/components/match3d/anatomy.ts` — sculpted-tube geometry with Gaussian muscle bumps, supersampled vertex paint, cavity shading.
- `src/components/match3d/body.ts` — builds every body part from `appearance` (muscle, definition, bodyFat, bulk,
  shoulderWidth, armSize, legSize, gear, kneepads, wrist tape, face/beard/brows/mask paint, hair shells).
- `WrestlerModel.tsx` rebuilt on the sculpted body; rig gained arm-twist channels; poses: flex, lat-spread, most-muscular.
- `/roster/[id]/look` character studio (orbit, presets, turntable, poses, body/face/gear tabs, original-look reset).
- Save schema v2 + migration (`src/engine/schema.ts`), default physiques in `src/engine/appearance.ts`. Tests: 14 passing.

### Phase 4 — Playable 3D match ✅
- `/match`: quick match setup (any two wrestlers in a division, optional title defence when both are signed,
  tale of the tape) and booked matches via `/match?show=…&seg=…` ("Play this match" on a show card; choose your side).
- `src/components/match/LiveMatch.tsx`: renderer-independent game loop (fixed ≤50 ms sub-steps), keyboard controls
  from Settings (arrows always work), touch pad on phones, intro (tale of the tape), HUD (health, stamina, momentum,
  SIG/FIN), reversal prompt, lock-up prompt, referee count, kick-out / escape mash meters, move feed, pause menu
  (resume / restart / leave), results (method, time, stars, stats) and recording:
  quick match → `recordExhibition` (history, records, popularity, title changes); booked → `segment.playedResult`.
- `MatchScene.tsx`: arena, sculpted wrestlers, referee (counts kneeling, watches from the far side), carried
  defender during lifts, victory → flex, hit sparks, camera shake (respects reduced motion), hard-camera tracking.
- `TopDownView.tsx`: 2D fallback if WebGL is missing or the 3D scene crashes — the match stays playable.
- `src/lib/sfx.ts`: synthesised hits, bell, mat slaps, crowd bed that follows crowd heat (Settings toggle).
- Settings: graphics quality (low = no shadows, thinner crowd, dpr 1).
- Verified with a bot that plays through the real keyboard controls (scratch `bot.py`): quick match won by pinfall
  and recorded in history; booked match played, locked in and used when the show ran ("Played" badge).
- Not done: playable tag / battle royal (tag matches are simulated; documented).
### Phase 5–6 — Polish, tests, deploy ✅
- ESLint clean (Next.js + React Compiler rules); HUD renders from immutable snapshots; 3D view memoised.
- Autosave hardened: leading-edge write, debounce for bursts, localStorage recovery copy on unload.
- Themed 404 and error pages; 2D-mode note; phone-width fixes; low-graphics option.
- Playwright e2e (`e2e/smoke.spec.ts`, desktop + mobile), Supabase seed script, README with Vercel steps.
- Final verification against the production build: typecheck, lint, 39 unit tests, 7 e2e tests, every route
  rendered without errors, WebGL-disabled fallback playable.

## Since then
See `CHANGELOG.md` (real roster, MakeHuman wrestlers, ragdolls, engine v2, look pass 2, rivalry themes and
dialogue) and `docs/ROADMAP.md` (Wrestling Empire-style phases).

## Next up (resume here)
Follow `docs/ROADMAP.md` (Phase 2 leftovers, then Phase 3 weapons/hardcore). Older ideas:
1. Playable tag-team matches (tag in/out, partner AI on the apron) — engine currently handles 1v1.
2. Entrance sequences per wrestler (walk down the ramp, themed lighting) before the bell.
3. More moves per wrestler (move-set editor: pick animations for signatures/finisher).
4. Draft/PLE presentation polish: event posters, a weekly news digest page.

Tests: 45 passing (`npm test`).
