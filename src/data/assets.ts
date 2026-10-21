/**
 * Local asset manifest.
 *
 * The game ships with NO photographs of real people. Every wrestler is built
 * at runtime from one bundled CC0 base mesh and their `appearance` data, and
 * portraits are rendered from that 3D model — nothing is hotlinked.
 *
 * To bundle your own artwork, put files in /public/portraits/ and list them here,
 * e.g.  "cody-rhodes": "/portraits/cody-rhodes.webp".
 * Only add images you own or that are licensed for this use.
 * Players can also upload a portrait per wrestler from the editor; those are
 * stored locally in the browser and take priority over this manifest.
 */
export const PORTRAIT_MANIFEST: Record<string, string> = {};

export const ASSET_CREDITS = [
  { asset: "Wrestler portraits", source: "Rendered from each 3D model at runtime; procedural SVG fallback (original)", license: "Project license" },
  { asset: "Human base mesh (rigged, with finger bones)", source: "Godot Male Base Mesh, github.com/BoQsc/Godot-Male-Base-Mesh (public/models/base-male.glb)", license: "CC0 1.0" },
  { asset: "Wrestler sculpting, skin, gear and tattoo shading", source: "Generated at runtime from the base mesh (original)", license: "Project license" },
  { asset: "Ragdoll physics", source: "Rapier (@dimforge/rapier3d-compat)", license: "Apache-2.0" },
  { asset: "Simplex noise (shader)", source: "Ashima Arts / Stefan Gustavson", license: "MIT" },
  { asset: "3D ring, arena and show branding", source: "Three.js primitives and canvas-drawn textures at runtime (original)", license: "Project license" },
  { asset: "Fonts: Anton, Barlow, Barlow Condensed", source: "Fontsource (self-hosted)", license: "SIL Open Font License 1.1" },
  { asset: "Icons", source: "Lucide", license: "ISC" },
  { asset: "Sound effects", source: "Synthesised at runtime with the Web Audio API (original)", license: "Project license" },
];
