"use client";
/**
 * Studio headshots rendered from each wrestler's actual 3D model, used as their
 * portrait across the app. One small offscreen renderer works through a queue,
 * one wrestler at a time, and results are cached per look for the session.
 */
import * as THREE from "three";
import type { Wrestler } from "@/engine/types";
import { loadHumanBase } from "./human/base";
import { NEUTRAL } from "./poses";
import { build } from "./WrestlerModel";

const W = 300;
const H = 360;
const BRAND_BG: Record<Wrestler["brand"], [string, string]> = {
  mayhem: ["#3a0410", "#c8102e"],
  fury: ["#14110a", "#c9a227"],
  legends: ["#0b1230", "#2f6bff"],
  "free-agents": ["#15171c", "#6b7280"],
};

let renderer: THREE.WebGLRenderer | null = null;
let unavailable = false;
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();
let chain: Promise<unknown> = Promise.resolve();

export const portraitKey = (w: Wrestler) => `${w.id}|${w.brand}|${w.heightIn}|${JSON.stringify(w.appearance)}`;
export const peekPortrait = (w: Wrestler) => cache.get(portraitKey(w));

function getRenderer() {
  if (renderer || unavailable) return renderer;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } catch {
    unavailable = true;
    renderer = null;
  }
  return renderer;
}

function backdrop([dark, light]: [string, string]) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 40, 4, 32, 64, 90);
  grad.addColorStop(0, light);
  grad.addColorStop(0.55, dark);
  grad.addColorStop(1, "#050507");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

async function renderOne(w: Wrestler): Promise<string | null> {
  const r = getRenderer();
  if (!r) return null;
  const base = await loadHumanBase();
  const model = build(base, w, false);
  const scene = new THREE.Scene();
  const bg = backdrop(BRAND_BG[w.brand]);
  scene.background = bg;
  scene.add(new THREE.HemisphereLight("#dfe6ff", "#1a1012", 0.7));
  const key = new THREE.DirectionalLight("#fff1e0", 3.2);
  key.position.set(1.2, 2.6, 2.2);
  scene.add(key);
  const rim1 = new THREE.PointLight(BRAND_BG[w.brand][1], 9, 6);
  rim1.position.set(-1.1, 2.0, -0.9);
  scene.add(rim1);
  const rim2 = new THREE.PointLight("#9fb8ff", 5, 6);
  rim2.position.set(1.1, 1.9, -1.0);
  scene.add(rim2);
  const fill = new THREE.PointLight("#ffffff", 1.2, 5);
  fill.position.set(-0.6, 1.5, 1.6);
  scene.add(fill);

  const s = w.heightIn / 74;
  model.group.scale.setScalar(s);
  model.rig.apply({ ...NEUTRAL, lShoulderSide: 0.16, rShoulderSide: 0.16, lElbow: 0.25, rElbow: 0.25, head: -0.04 }, { fistL: 0.5, fistR: 0.5, plantFeet: true });
  scene.add(model.group);
  scene.updateMatrixWorld(true);

  const camera = new THREE.PerspectiveCamera(22, W / H, 0.1, 20);
  camera.position.set(0.32 * s, 1.68 * s, 1.75 * s);
  camera.lookAt(0, 1.6 * s, 0);
  r.render(scene, camera);
  const url = r.domElement.toDataURL("image/webp", 0.88);
  model.dispose();
  bg.dispose();
  return url;
}

/** Render (or fetch from cache) a wrestler's 3D headshot. Null when WebGL is unavailable. */
export function requestPortrait(w: Wrestler): Promise<string | null> {
  const k = portraitKey(w);
  const hit = cache.get(k);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(k);
  if (!p) {
    p = chain.then(async () => {
      // yield between renders so long roster pages stay responsive
      await new Promise((res) => setTimeout(res, 0));
      const url = await renderOne(w).catch(() => null);
      if (url) cache.set(k, url);
      inflight.delete(k);
      return url;
    });
    chain = p;
    inflight.set(k, p);
  }
  return p;
}
