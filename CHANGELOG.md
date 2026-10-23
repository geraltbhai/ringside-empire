# Changelog

Newest first. Dates are commit dates.

## 2026-10-23 — Wrestler look pass 2, rivalry themes, promo dialogue (`e75e74a`)
**Bodies and faces**
- V-taper physiques (broader shoulders, narrower waist, less thigh/torso bloat).
- Baked per-vertex ambient occlusion (`public/models/human_ao.bin`, `npx tsx scripts/bake-ao.ts`, three-mesh-bvh)
  and curvature shading for muscle definition; no runtime cost.
- Fur-shell beards, goatees, stubble, brows and short hair that follow the jawline and stop above the neck;
  strands merge at distance instead of sparkling.
- Image-based arena lighting (`Environment.tsx`); portraits rendered at 2× with less washed-out light.
- Boots smoothed so toes no longer show through.

**Costumes** (Character Studio)
- Gear patterns, back lettering (e.g. "3:16", "HULKSTER", "YEET").
- Mask styles (luchador, full, half, skull) with patterns and colours.
- Footwear, glove and sleeve options; real-life gear presets for many roster wrestlers
  (needs a new universe to pick up the presets).

**Rivalries and dialogue**
- Rivalry themes: personal, chasing the gold, betrayal, respect, legacy, jealousy, revenge, invasion.
- Payoff stipulation, editable sides, fan interest, custom story beats, delete; starting intensity on create.
- Blow-off match (stage "Major match" or later) books longer, with the stipulation and title.
- `src/engine/dialogue.ts`: scripts for promos, interviews and confrontations from theme, stage, alignment,
  titles, finishers and series record. Shown in show results ("What was said"), previewable per rivalry
  ("Promo preview" → "Another take"), best line quoted in the rivalry history.

**Checks:** typecheck, lint, 45 unit tests pass; match scene at 60 fps.

## 2026-10-22 — Engine v2 (`7a1a189`)
- Live match engine for any number of wrestlers (singles, Triple Threat, Fatal 4-Way).
- Roll out / roll in, over-the-top spills, floor brawling, count-outs, body-part damage, comebacks,
  pin break-ups, match pacing, lengths up to 60 minutes.

## 2026-10-22 — MakeHuman-based wrestlers (`0c4a4ed`)
- CC0 MakeHuman body baked headlessly in Blender (then uninstalled): 13k vertices, game skeleton with fingers,
  100 anatomical morphs, eyes, brows, lashes and hair; per-wrestler face and build sculpting; skin maps.

## 2026-10-21 — Rigged wrestlers and physics (`4487064`)
- Rigged human wrestlers, Rapier ragdolls, grapple IK, show branding (aprons, mats, logos), 3D portraits.

## 2026-10-21 — Real roster (`5d69ba5`)
- WWE, AEW and Legends men's roster; rebuilt bodies, spring physics, new sound effects.

## 2026-10-18 → 2026-10-21 — Original build
- Foundation, management core, booking and simulation, finances, calendar, history, settings, cloud saves,
  sculpted 3D models and Character Studio, playable 3D match, polish, e2e tests, Vercel deploy.
  Details in `CHECKPOINT.md`.

## Next up
- Phase 2 leftovers: apron and turnbuckle spots, dives to the floor, selling and blood visuals.
- Phase 3: weapons and hardcore rules. Phase 4: ladder, Rumble, playable tag. Phase 5: entrances and
  presentation. Phase 6: management realism. See `docs/ROADMAP.md`.
- Faces: closer likenesses are still the weakest visual area.
