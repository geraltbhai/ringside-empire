/**
 * Ring and arena branding drawn at runtime on canvases: aprons, the mat,
 * turnbuckle pads, barricade boards and the stage screen, themed per show
 * (Monday Night Raw, AEW Dynamite, Legends). Personal-use replicas drawn
 * with type and shapes; no image files are loaded.
 */
import * as THREE from "three";
import type { BrandId } from "@/engine/types";

export type ShowTheme = "raw" | "aew" | "legends";

export interface Theme {
  id: ShowTheme;
  ropes: [string, string, string];
  apron: string;
  accent: string;
  accent2: string;
  led: string;
  ledDim: string;
  showName: string;
}

export const THEMES: Record<ShowTheme, Theme> = {
  raw: { id: "raw", ropes: ["#c8102e", "#c8102e", "#c8102e"], apron: "#0a0a0c", accent: "#e1061f", accent2: "#ffffff", led: "#ff1a2e", ledDim: "#7a0612", showName: "MONDAY NIGHT RAW" },
  aew: { id: "aew", ropes: ["#111111", "#c9a227", "#111111"], apron: "#08080a", accent: "#d4af37", accent2: "#f5e6b0", led: "#d4af37", ledDim: "#5c4a12", showName: "AEW DYNAMITE" },
  legends: { id: "legends", ropes: ["#c8102e", "#f8fafc", "#1d4ed8"], apron: "#0b1230", accent: "#d4a017", accent2: "#f8fafc", led: "#2f6bff", ledDim: "#152a66", showName: "LEGENDS & ICONS" },
};

export function themeFor(brands: BrandId[]): Theme {
  for (const b of brands) if (b === "mayhem") return THEMES.raw;
  for (const b of brands) if (b === "fury") return THEMES.aew;
  return THEMES.legends;
}

const DISPLAY = '"Anton", "Impact", "Arial Black", sans-serif';

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function texture(c: HTMLCanvasElement, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Brand logo centred at (x, y) with height h. */
export function drawLogo(g: CanvasRenderingContext2D, theme: Theme, x: number, y: number, h: number, opts: { mono?: string; alpha?: number } = {}) {
  g.save();
  g.globalAlpha = opts.alpha ?? 1;
  g.translate(x, y);
  if (theme.id === "raw") {
    // heavy italic slab letters with scratches
    g.font = `italic 900 ${h}px ${DISPLAY}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.transform(1, 0, -0.18, 1, 0, 0);
    const grad = g.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, opts.mono ?? "#ff2a3a");
    grad.addColorStop(1, opts.mono ?? "#a3000f");
    g.fillStyle = grad;
    g.fillText("RAW", 0, 0);
    g.globalCompositeOperation = "destination-out";
    g.lineWidth = Math.max(1, h * 0.018);
    seed = 11;
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      const sx = (rand() - 0.5) * h * 1.9;
      const sy = (rand() - 0.5) * h * 0.8;
      g.moveTo(sx, sy);
      g.lineTo(sx + h * (0.15 + rand() * 0.35), sy + (rand() - 0.5) * h * 0.12);
      g.stroke();
    }
  } else if (theme.id === "aew") {
    g.textAlign = "center";
    g.textBaseline = "middle";
    const grad = g.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, opts.mono ?? "#fff2b8");
    grad.addColorStop(0.5, opts.mono ?? "#d4af37");
    grad.addColorStop(1, opts.mono ?? "#8a6d14");
    g.fillStyle = grad;
    g.font = `900 ${h}px ${DISPLAY}`;
    g.fillText("AEW", 0, -h * 0.05);
    // the slash through the logo
    g.strokeStyle = opts.mono ?? "#0a0a0a";
    g.lineWidth = h * 0.06;
    g.beginPath();
    g.moveTo(-h * 0.95, h * 0.32);
    g.lineTo(h * 0.95, -h * 0.28);
    g.stroke();
    g.font = `italic 700 ${h * 0.24}px ${DISPLAY}`;
    g.fillStyle = opts.mono ?? "#f5e6b0";
    g.fillText("D Y N A M I T E", 0, h * 0.62);
  } else {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `900 ${h * 0.62}px ${DISPLAY}`;
    const grad = g.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, opts.mono ?? "#ffe08a");
    grad.addColorStop(1, opts.mono ?? "#b8860b");
    g.fillStyle = grad;
    g.fillText("LEGENDS", 0, -h * 0.12);
    g.font = `700 ${h * 0.24}px ${DISPLAY}`;
    g.fillStyle = opts.mono ?? "#f8fafc";
    g.fillText("&  ICONS", 0, h * 0.42);
  }
  g.restore();
}

function fabric(g: CanvasRenderingContext2D, w: number, h: number, base: string, amount: number) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  seed = 3;
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

export interface BrandTextures {
  apron: THREE.CanvasTexture;
  mat: THREE.CanvasTexture;
  pad: THREE.CanvasTexture;
  board: THREE.CanvasTexture;
  screen: THREE.CanvasTexture;
  dispose: () => void;
}

export function brandTextures(theme: Theme): BrandTextures {
  // Apron: one side, 2048×384
  const [ac, ag] = canvas(2048, 384);
  fabric(ag, 2048, 384, theme.apron, 10);
  const band = ag.createLinearGradient(0, 0, 0, 30);
  band.addColorStop(0, theme.accent);
  band.addColorStop(1, theme.apron);
  ag.fillStyle = band;
  ag.fillRect(0, 0, 2048, 22);
  drawLogo(ag, theme, 1024, 190, 210);
  ag.font = `700 46px ${DISPLAY}`;
  ag.fillStyle = theme.accent2;
  ag.globalAlpha = 0.85;
  ag.textAlign = "center";
  ag.textBaseline = "middle";
  ag.fillText(theme.showName, 380, 200);
  ag.fillText(theme.showName, 1668, 200);
  ag.globalAlpha = 1;

  // Mat: 1024², canvas weave, scuffs, centre logo and edge lettering
  const [mc, mg] = canvas(1024, 1024);
  fabric(mg, 1024, 1024, "#e9ebef", 14);
  seed = 5;
  for (let i = 0; i < 140; i++) {
    mg.fillStyle = `rgba(90,90,100,${0.02 + rand() * 0.05})`;
    mg.beginPath();
    mg.ellipse(rand() * 1024, rand() * 1024, 8 + rand() * 60, 4 + rand() * 20, rand() * 3, 0, Math.PI * 2);
    mg.fill();
  }
  drawLogo(mg, theme, 512, 512, 230, { alpha: 0.85 });
  mg.font = `700 44px ${DISPLAY}`;
  mg.textAlign = "center";
  mg.fillStyle = theme.id === "aew" ? "#8a6d14" : theme.accent;
  mg.globalAlpha = 0.75;
  mg.fillText(theme.showName, 512, 960);
  mg.save();
  mg.translate(512, 64);
  mg.rotate(Math.PI);
  mg.fillText(theme.showName, 0, 0);
  mg.restore();
  mg.globalAlpha = 1;

  // Turnbuckle pad
  const [pc, pg] = canvas(256, 256);
  fabric(pg, 256, 256, theme.id === "aew" ? "#0d0d0d" : theme.accent, 16);
  drawLogo(pg, theme, 128, 128, 92, { mono: theme.id === "aew" ? undefined : "#ffffff" });

  // Barricade / LED board strip
  const [bc, bg] = canvas(2048, 128);
  bg.fillStyle = "#050507";
  bg.fillRect(0, 0, 2048, 128);
  for (let x = 160; x < 2048; x += 512) drawLogo(bg, theme, x, 64, 80);
  bg.font = `700 54px ${DISPLAY}`;
  bg.fillStyle = theme.led;
  bg.textAlign = "center";
  bg.textBaseline = "middle";
  for (let x = 416; x < 2048; x += 512) bg.fillText(theme.showName, x, 66);

  // Stage screen
  const [sc, sg] = canvas(1024, 576);
  const sky = sg.createRadialGradient(512, 288, 40, 512, 288, 620);
  sky.addColorStop(0, theme.ledDim);
  sky.addColorStop(1, "#020205");
  sg.fillStyle = sky;
  sg.fillRect(0, 0, 1024, 576);
  drawLogo(sg, theme, 512, 270, 250);

  const apron = texture(ac);
  const mat = texture(mc);
  const pad = texture(pc);
  const board = texture(bc, [1, 1]);
  const screen = texture(sc);
  return { apron, mat, pad, board, screen, dispose: () => [apron, mat, pad, board, screen].forEach((t) => t.dispose()) };
}
