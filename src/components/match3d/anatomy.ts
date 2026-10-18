/**
 * Procedural anatomy for the original wrestler models.
 *
 * Every body part is a "sculpted tube": rings of vertices stacked along the
 * part's long axis, with an elliptical cross-section whose radius is pushed out
 * (or in) by Gaussian "muscle" bumps defined in (t, φ) space:
 *   t ∈ [0,1] runs along the part, φ is the angle around it (0 = front/+Z,
 *   +π/2 = the model's left/+X, π = back).
 * Gear, skin, brows, beard and masks are painted with vertex colours, and a
 * cheap cavity pass (Laplacian of the bump field) darkens the grooves between
 * muscles so definition reads even under flat arena lighting.
 */
import * as THREE from "three";

export interface Bump {
  t: number;
  phi: number;
  /** Spread along t (fraction of length). */
  st: number;
  /** Spread around the circumference (radians). */
  sp: number;
  /** Radial amplitude in metres (negative carves a groove). */
  a: number;
  /** Optional sharper falloff below the centre (e.g. the lower edge of a pec). */
  stBelow?: number;
}

export interface TubeSpec {
  /** y at t = 0 and t = 1 (local space). */
  y0: number;
  y1: number;
  /** Elliptical base radii [x, z] along the tube. */
  radius: (t: number) => [number, number];
  bumps: Bump[];
  radial?: number;
  rings?: number;
  /** Paint a colour for a surface point. */
  color: (t: number, phi: number) => THREE.Color;
  /** 0..1 strength of groove darkening. */
  cavity?: number;
  /** Close the tube ends with a pole vertex. */
  capStart?: boolean;
  capEnd?: boolean;
  /** Offset the centre line in z along t (e.g. to push the chest forward). */
  centerZ?: (t: number) => number;
  centerX?: (t: number) => number;
}

const TAU = Math.PI * 2;
const angDiff = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
};

export function bumpField(bumps: Bump[], t: number, phi: number) {
  let sum = 0;
  for (const b of bumps) {
    const dt = t - b.t;
    const st = dt > 0 && b.stBelow ? b.stBelow : b.st;
    const dp = angDiff(phi, b.phi);
    sum += b.a * Math.exp(-((dt * dt) / (2 * st * st) + (dp * dp) / (2 * b.sp * b.sp)));
  }
  return sum;
}

export function sculptTube(spec: TubeSpec): THREE.BufferGeometry {
  const R = spec.radial ?? 28;
  const N = spec.rings ?? 24;
  const cols = R + 1; // duplicate seam column for clean UV-less wrap
  const field: number[] = [];
  const positions: number[] = [];
  const colors: number[] = [];
  const tmp = new THREE.Color();

  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [rx, rz] = spec.radius(t);
    const y = spec.y0 + (spec.y1 - spec.y0) * t;
    const cz = spec.centerZ?.(t) ?? 0;
    const cx = spec.centerX?.(t) ?? 0;
    for (let j = 0; j <= R; j++) {
      const phi = (j / R) * TAU;
      const b = bumpField(spec.bumps, t, phi);
      field.push(b);
      const sx = Math.sin(phi);
      const sz = Math.cos(phi);
      positions.push(cx + sx * (rx + b), y, cz + sz * (rz + b));
      // 5-tap supersampling softens paint boundaries (beards, gear edges).
      const dt = 0.5 / N;
      const dp = Math.PI / R;
      tmp.setRGB(0, 0, 0);
      const taps: [number, number, number][] = [
        [0, 0, 0.36],
        [dt, 0, 0.16],
        [-dt, 0, 0.16],
        [0, dp, 0.16],
        [0, -dp, 0.16],
      ];
      for (const [ot, op, w] of taps) {
        const c = spec.color(Math.min(1, Math.max(0, t + ot)), phi + op);
        tmp.r += c.r * w;
        tmp.g += c.g * w;
        tmp.b += c.b * w;
      }
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  // Cavity shading: compare each vertex's bump height with its neighbours.
  const strength = spec.cavity ?? 0;
  if (strength > 0) {
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= R; j++) {
        const idx = i * cols + j;
        const up = field[Math.max(0, i - 1) * cols + j];
        const dn = field[Math.min(N, i + 1) * cols + j];
        const lf = field[i * cols + ((j - 1 + R) % R)];
        const rt = field[i * cols + ((j + 1) % R)];
        const lap = (up + dn + lf + rt) / 4 - field[idx];
        // positive laplacian = valley
        const shade = 1 - Math.min(0.35, Math.max(0, lap) * 160 * strength);
        const hi = 1 + Math.min(0.06, Math.max(0, -lap) * 60 * strength);
        tmp.setRGB(colors[idx * 3], colors[idx * 3 + 1], colors[idx * 3 + 2]).multiplyScalar(shade * hi);
        colors[idx * 3] = tmp.r;
        colors[idx * 3 + 1] = tmp.g;
        colors[idx * 3 + 2] = tmp.b;
      }
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < R; j++) {
      const a = i * cols + j;
      const b = a + cols;
      const c = b + 1;
      const d = a + 1;
      // winding chosen so normals face outward when y1 < y0 (limbs) and are fixed below otherwise
      indices.push(a, b, d, b, c, d);
    }
  }

  const addCap = (row: number, end: boolean) => {
    const t = row / N;
    const y = spec.y0 + (spec.y1 - spec.y0) * t;
    const cz = spec.centerZ?.(t) ?? 0;
    const cx = spec.centerX?.(t) ?? 0;
    const center = positions.length / 3;
    positions.push(cx, y, cz);
    const c = spec.color(t, 0);
    colors.push(c.r, c.g, c.b);
    for (let j = 0; j < R; j++) {
      const a = row * cols + j;
      const b = a + 1;
      if (end) indices.push(a, center, b);
      else indices.push(b, center, a);
    }
  };
  if (spec.capStart) addCap(0, false);
  if (spec.capEnd) addCap(N, true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  // Tubes running upward (y1 > y0) have the opposite winding.
  if (spec.y1 > spec.y0) {
    for (let k = 0; k < indices.length; k += 3) {
      const tmpI = indices[k + 1];
      indices[k + 1] = indices[k + 2];
      indices[k + 2] = tmpI;
    }
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();
  // Average normals along the duplicated seam so there is no visible crease.
  const nrm = geo.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i <= N; i++) {
    const a = i * cols;
    const b = a + R;
    const nx = (nrm.getX(a) + nrm.getX(b)) / 2;
    const ny = (nrm.getY(a) + nrm.getY(b)) / 2;
    const nz = (nrm.getZ(a) + nrm.getZ(b)) / 2;
    const len = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(a, nx / len, ny / len, nz / len);
    nrm.setXYZ(b, nx / len, ny / len, nz / len);
  }
  nrm.needsUpdate = true;
  geo.computeBoundingSphere();
  return geo;
}

/** Smooth interpolation through (t, value) keys. */
export function curve(keys: [number, number][]) {
  return (t: number) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i];
      const [t1, v1] = keys[i + 1];
      if (t <= t1) {
        const k = (t - t0) / (t1 - t0);
        const s = k * k * (3 - 2 * k);
        return v0 + (v1 - v0) * s;
      }
    }
    return keys[keys.length - 1][1];
  };
}

/** Angular distance from the front (φ = 0), in [0, π]. */
export const frontness = (phi: number) => Math.abs(angDiff(phi, 0));

export const smoothstep = (e0: number, e1: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return k * k * (3 - 2 * k);
};

/** Narrow band test around an angle (handles wrap-around). */
export const nearPhi = (phi: number, center: number, half: number) => Math.abs(angDiff(phi, center)) <= half;
