/**
 * Everything a wrestler model needs, loaded once: the baked human base and its
 * textures (skin detail maps, brows, lashes, hair cards, iris). Skin maps also
 * get their average linear colour so the shader can tint them to any tone.
 */
import * as THREE from "three";
import { type HumanBase, loadHumanBase } from "./base";

export interface HumanAssets {
  base: HumanBase;
  tex: Record<string, THREE.Texture>;
  /** Mean linear RGB of each texture (used to normalise skin and hair tints). */
  mean: Record<string, THREE.Vector3>;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}

/** Average linear colour of the opaque pixels of an image (or of a sub-rectangle, in 0..1 UV units). */
function meanColor(img: HTMLImageElement, rect: [number, number, number, number] = [0, 0, 1, 1]) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  const [x0, y0, x1, y1] = rect;
  g.drawImage(img, x0 * img.width, y0 * img.height, (x1 - x0) * img.width, (y1 - y0) * img.height, 0, 0, 64, 64);
  const d = g.getImageData(0, 0, 64, 64).data;
  const acc = new THREE.Vector3();
  let n = 0;
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    acc.x += lin(d[i]);
    acc.y += lin(d[i + 1]);
    acc.z += lin(d[i + 2]);
    n++;
  }
  return n ? acc.divideScalar(n) : new THREE.Vector3(0.5, 0.5, 0.5);
}

let pending: Promise<HumanAssets> | null = null;
export function loadHumanAssets(): Promise<HumanAssets> {
  pending ??= loadHumanBase().then(async (base) => {
    const tex: Record<string, THREE.Texture> = {};
    const mean: Record<string, THREE.Vector3> = {};
    await Promise.all(
      Object.entries(base.textures).map(async ([name, file]) => {
        const img = await loadImage(`/models/${file}`);
        const t = new THREE.Texture(img);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        t.needsUpdate = true;
        tex[name] = t;
        mean[name] = meanColor(img);
        if (name.startsWith("skin_")) {
          // MakeHuman skin maps: the head sits in its own, brighter island on the right
          mean[`${name}_body`] = meanColor(img, [0.18, 0.12, 0.55, 0.5]);
          mean[`${name}_head`] = meanColor(img, [0.7, 0.3, 0.92, 0.75]);
        }
      }),
    );
    return { base, tex, mean };
  });
  return pending;
}
