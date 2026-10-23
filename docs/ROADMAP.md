# Ringside Empire — roadmap to a Wrestling Empire-style game

Goal: the feel of MDickie's *Wrestling Empire* in the ring (chunky, readable, characterful wrestlers;
fast arcade grappling; brawls that spill anywhere; weapons; chaotic multi-man matches) combined with
deep promotion management (ratings, match quality, booking, contracts, injuries).

Wrestling Empire is a reference for **feel and style only**. No assets, code or data are copied from it.

## Phase 1 — Wrestler models ✅
- MakeHuman CC0 body baked headlessly in Blender (MPFB2) into `public/models/human.bin`: 13k-vertex body,
  game skeleton with fingers, 100 sparse anatomical morphs (build, race structure, jaw, chin, cheeks, nose,
  brow, eyes, ears, head shapes, torso and limbs), eyes/brows/lashes/hair. Blender is removed afterwards.
- Wrestling Empire-style readability: slightly heroic proportions, strong silhouettes, bold gear colours,
  high-contrast faces (brows, beards, eyes) that read at match-camera distance.
- Per-wrestler morphs drive build and face; skin texture + existing gear/tattoo shader on top.
- Pass 2: V-taper physiques, baked AO and curvature shading, fur-shell beards/stubble/brows, image-based
  lighting, costume patterns, back lettering, mask styles/patterns, footwear, gloves and sleeves.

## Storylines ✅ (first pass)
- Rivalry themes (betrayal, chasing the gold, legacy, revenge, …), payoff stipulations, editable sides,
  custom story beats, delete.
- Generated promo and confrontation dialogue from theme, stage, alignment, titles and finishers; shown in
  show results and previewable from the Rivalries screen.

## Phase 2 — Engine v2: any number of wrestlers, the whole arena ✅ (first pass)
- Rewrite `live-match.ts` around N fighters (2–30), each with an AI brain and a current target.
- Arena geography: inside the ring, on the apron, on the floor, by the barricade, up the ramp.
  Roll out / climb in through the ropes, climb onto the apron and turnbuckles.
- Referee 10-count for count-outs; ring-out brawling; diving moves to the floor.
- Body-part damage (head, body, arms, legs) behind the health bar; limb damage affects moves and
  submissions. Stamina, adrenaline (comeback state), selling and "busted open" visuals.
- Longer, paced matches: a match pacing model (feeling out → heat → comeback → finish) so AI matches
  build like real ones; adjustable lengths up to 60 minutes.
- Done: N-wrestler engine (singles, Triple Threat, Fatal 4-Way), roll out/in, over-the-top spills,
  count-outs, body-part damage, fired-up comebacks, pin break-ups, pacing, match lengths to 60 min.
  Still to come: apron and turnbuckle spots, dives to the floor, selling/blood visuals.

## Phase 3 — Hardcore and weapons
- Physics props (Rapier): steel chair, kendo stick, table (breakable), ladder, steel steps, trash can,
  barbed bat. Pick up, swing, throw, set up, slam opponents onto/through them.
- Rules: DQ in normal matches (referee sees weapons), No DQ, Hardcore, Falls Count Anywhere,
  Extreme Rules, Last Man Standing (10-count to stand), Street Fight.

## Phase 4 — Match types
- Tag team (legal man, tags, hot tags, double teams, saves), Triple Threat, Fatal 4-Way.
- Ladder match (set up, climb, push off, retrieve the belt), TLC.
- Royal Rumble: 30 entrants, timed entries with countdown, over-the-top eliminations, playable as any
  entrant, up to ~6 wrestlers in the ring at once for performance.
- Steel cage (escape over/through the door), Iron Man (most falls), Submission, I Quit, Elimination.

## Phase 5 — Presentation
- Entrances (walk down the ramp, pyro, theme sting), introductions, title belts on screen.
- Broadcast camera with replays of big spots; commentary feed; crowd chants and signs.
- Blood, sweat, bruising on damaged body parts.

## Phase 6 — Management realism
- Played and simulated matches share one quality model: workrate, psychology, near-falls, pacing,
  crowd heat, match length vs card position, stipulation and rivalry heat → star rating.
- Booking supports every new match type and stipulation; Rumble and ladder matches on PLEs.
- Injuries and fatigue from hardcore matches; morale, contracts, push and popularity react to results.
- Show ratings, viewership, ticket sales and merch respond to match quality over time.

## Performance budget (MacBook Air M4, fanless)
- 60 fps target with 2–4 wrestlers, 45+ with 6 in the ring.
- Physics only for ragdolls and props near the action; models share one geometry where possible.
- "Low graphics" setting keeps working (fewer crowd members, no shadows).
