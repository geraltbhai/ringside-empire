/**
 * Local asset manifest.
 *
 * The game ships with NO photographs of real people. Every wrestler is drawn
 * procedurally (see components/Portrait.tsx) from their `appearance` data, and
 * every 3D wrestler is built from primitives at runtime — nothing is hotlinked.
 *
 * To bundle your own artwork, put files in /public/portraits/ and list them here,
 * e.g.  "marcus-vale": "/portraits/marcus-vale.webp".
 * Only add images you own or that are licensed for this use.
 * Players can also upload a portrait per wrestler from the editor; those are
 * stored locally in the browser and take priority over this manifest.
 */
export const PORTRAIT_MANIFEST: Record<string, string> = {};

export const ASSET_CREDITS = [
  { asset: "Wrestler portraits", source: "Procedurally generated SVG (original)", license: "Project license" },
  { asset: "3D ring, arena and wrestler models", source: "Built from Three.js primitives at runtime (original)", license: "Project license" },
  { asset: "Fonts: Anton, Barlow, Barlow Condensed", source: "Fontsource (self-hosted)", license: "SIL Open Font License 1.1" },
  { asset: "Icons", source: "Lucide", license: "ISC" },
  { asset: "Sound effects", source: "Synthesised at runtime with the Web Audio API (original)", license: "Project license" },
];
