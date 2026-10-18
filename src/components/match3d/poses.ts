/**
 * Procedural keyframe animation library. A pose is a set of joint rotations
 * (radians) plus root offsets; each animation is a function of time.
 */
export interface Pose {
  rootY: number; // vertical offset of hips
  rootTilt: number; // whole-body pitch (falls / lying)
  rootRoll: number;
  spine: number; // forward lean
  twist: number;
  head: number;
  lShoulder: number; // pitch: positive raises arm forward
  rShoulder: number;
  lShoulderSide: number; // abduction
  rShoulderSide: number;
  lArmTwist: number; // rotation about the upper-arm axis (needed for flexing poses)
  rArmTwist: number;
  lElbow: number;
  rElbow: number;
  lHip: number;
  rHip: number;
  lKnee: number;
  rKnee: number;
}

export const NEUTRAL: Pose = {
  rootY: 0,
  rootTilt: 0,
  rootRoll: 0,
  spine: 0.05,
  twist: 0,
  head: 0,
  lShoulder: 0.1,
  rShoulder: 0.1,
  lShoulderSide: 0.25,
  rShoulderSide: 0.25,
  lArmTwist: 0,
  rArmTwist: 0,
  lElbow: 0.5,
  rElbow: 0.5,
  lHip: 0,
  rHip: 0,
  lKnee: 0,
  rKnee: 0,
};

const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
const p = (over: Partial<Pose>): Pose => ({ ...NEUTRAL, ...over });
/** Piecewise blend through keyframes [time, pose]. */
function keys(t: number, frames: [number, Partial<Pose>][]): Pose {
  if (t <= frames[0][0]) return p(frames[0][1]);
  for (let i = 0; i < frames.length - 1; i++) {
    const [t0, a] = frames[i];
    const [t1, b] = frames[i + 1];
    if (t >= t0 && t <= t1) {
      const k = ease((t - t0) / (t1 - t0));
      const pa = p(a);
      const pb = p(b);
      const out = {} as Pose;
      for (const key of Object.keys(pa) as (keyof Pose)[]) out[key] = pa[key] + (pb[key] - pa[key]) * k;
      return out;
    }
  }
  return p(frames[frames.length - 1][1]);
}

const STANCE: Partial<Pose> = { spine: 0.25, lShoulder: 0.7, rShoulder: 0.7, lElbow: 1.4, rElbow: 1.4, lShoulderSide: 0.35, rShoulderSide: 0.35, lHip: 0.25, rHip: -0.1, lKnee: 0.35, rKnee: 0.3, rootY: -0.06 };

export function poseFor(anim: string, t: number): Pose {
  switch (anim) {
    case "idle": {
      const b = Math.sin(t * 2.4) * 0.03;
      return p({ ...STANCE, rootY: -0.06 + b, spine: 0.25 + b, lElbow: 1.4 + b * 2 });
    }
    case "walk": {
      const s = Math.sin(t * 8);
      return p({ ...STANCE, lHip: s * 0.6, rHip: -s * 0.6, lKnee: Math.max(0, -s) * 0.8 + 0.1, rKnee: Math.max(0, s) * 0.8 + 0.1, rootY: Math.abs(s) * 0.04 - 0.05 });
    }
    case "run": {
      const s = Math.sin(t * 13);
      return p({ spine: 0.45, lHip: s * 1.0, rHip: -s * 1.0, lKnee: Math.max(0, -s) * 1.4 + 0.2, rKnee: Math.max(0, s) * 1.4 + 0.2, lShoulder: -s * 1.0, rShoulder: s * 1.0, lElbow: 1.5, rElbow: 1.5, rootY: Math.abs(s) * 0.08 - 0.05 });
    }
    case "light":
      return keys(t, [
        [0, STANCE],
        [0.12, { ...STANCE, twist: -0.4, rShoulder: 0.4 }],
        [0.2, { ...STANCE, twist: 0.5, rShoulder: 1.55, rElbow: 0.1, rShoulderSide: 0.1, spine: 0.35 }],
        [0.45, STANCE],
      ]);
    case "heavy":
      return keys(t, [
        [0, STANCE],
        [0.35, { ...STANCE, twist: -0.8, rShoulder: 0.2, rShoulderSide: 1.3, rElbow: 0.2, spine: 0.1 }],
        [0.48, { ...STANCE, twist: 0.9, rShoulder: 1.5, rShoulderSide: 1.2, rElbow: 0.05, spine: 0.4 }],
        [0.85, STANCE],
      ]);
    case "running":
      return keys(t, [
        [0, { spine: 0.45, rShoulderSide: 1.5, rElbow: 0 }],
        [0.25, { spine: 0.3, twist: 0.7, rShoulderSide: 1.5, rShoulder: 1.3, rElbow: 0, lHip: 0.6, lKnee: 0.4 }],
        [0.8, STANCE],
      ]);
    case "ground":
      return keys(t, [
        [0, STANCE],
        [0.2, { ...STANCE, rHip: 1.3, rKnee: 1.6, spine: 0.1 }],
        [0.3, { ...STANCE, rHip: 0.5, rKnee: 0.2, spine: 0.3 }],
        [0.6, STANCE],
      ]);
    case "grapple":
    case "lockup":
      return p({ spine: 0.55, lShoulder: 1.6, rShoulder: 1.6, lElbow: 0.6, rElbow: 0.6, lShoulderSide: 0.05, rShoulderSide: 0.05, lHip: 0.4, rHip: -0.3, lKnee: 0.5, rKnee: 0.2, rootY: -0.1 });
    case "grapple-quick":
      return keys(t, [
        [0, { spine: 0.55, lShoulder: 1.6, rShoulder: 1.6, lElbow: 0.6, rElbow: 0.6 }],
        [0.3, { spine: -0.6, rootTilt: -0.4, lShoulder: 2.6, rShoulder: 2.6, lElbow: 0.4, rElbow: 0.4, lKnee: 0.6, rKnee: 0.6, rootY: -0.2 }],
        [0.55, { spine: -0.2, rootTilt: -1.4, lShoulder: 2.8, rShoulder: 2.8, rootY: -0.65 }],
        [1.0, STANCE],
      ]);
    case "grapple-power":
      return keys(t, [
        [0, { spine: 0.55, lShoulder: 1.6, rShoulder: 1.6 }],
        [0.45, { spine: 0.1, lShoulder: 2.9, rShoulder: 2.9, lElbow: 0.3, rElbow: 0.3, rootY: 0.05 }],
        [0.7, { spine: 0.9, lShoulder: 1.2, rShoulder: 1.2, lKnee: 1.2, rKnee: 1.2, lHip: 1.0, rHip: 1.0, rootY: -0.45 }],
        [1.3, STANCE],
      ]);
    case "signature":
      return keys(t, [
        [0, STANCE],
        [0.38, { ...STANCE, rootY: 0.25, lHip: 1.0, lKnee: 1.5, rShoulder: 2.6, lShoulder: 2.6, spine: -0.2 }],
        [0.6, { spine: 1.0, rShoulder: 1.6, lShoulder: 1.6, rootY: -0.35, lKnee: 1.2, rKnee: 1.2, lHip: 1.0, rHip: 1.0 }],
        [1.25, STANCE],
      ]);
    case "finisher":
      return keys(t, [
        [0, STANCE],
        [0.25, { ...STANCE, rootY: -0.15, spine: 0.6, lShoulder: 2.0, rShoulder: 2.0 }],
        [0.5, { rootY: 0.55, spine: -0.5, rootTilt: -0.6, lShoulder: 3.0, rShoulder: 3.0, lHip: 0.8, rHip: 0.8, lKnee: 1.4, rKnee: 1.4 }],
        [0.8, { rootY: -0.4, rootTilt: 0.5, spine: 1.0, lShoulder: 1.4, rShoulder: 1.4, lKnee: 1.6, rKnee: 1.6, lHip: 1.4, rHip: 1.4 }],
        [1.6, STANCE],
      ]);
    case "submission":
      return p({ rootY: -0.75, rootTilt: 0.2, spine: 1.1, lShoulder: 1.6, rShoulder: 1.6, lElbow: 1.2, rElbow: 1.2, lHip: 1.6, rHip: 1.6, lKnee: 2.2, rKnee: 2.2, twist: Math.sin(t * 6) * 0.1 });
    case "submitted":
      return p({ rootY: -1.0, rootTilt: -1.45, spine: -0.1, lShoulder: 2.5 + Math.sin(t * 10) * 0.3, rShoulder: 0.2, rShoulderSide: 1.3, lElbow: 0.2, lHip: 0.3, rHip: 0.6, lKnee: 0.4, rKnee: 0.2 });
    case "counter":
      return keys(t, [
        [0, { ...STANCE, twist: 0.6 }],
        [0.15, { ...STANCE, twist: -0.6, lShoulder: 1.6, lElbow: 0.1, spine: 0.4 }],
        [0.45, STANCE],
      ]);
    case "hit":
    case "stagger":
      return keys(t, [
        [0, STANCE],
        [0.08, { ...STANCE, spine: -0.45, head: -0.4, rootTilt: -0.15, lShoulderSide: 0.9, rShoulderSide: 0.9, lElbow: 0.4, rElbow: 0.4 }],
        [0.5, { ...STANCE, spine: 0.5, head: 0.2 }],
      ]);
    case "fall":
      return keys(t, [
        [0, { spine: -0.3, head: -0.4 }],
        [0.35, { rootY: -0.6, rootTilt: -1.2, spine: -0.2, lShoulderSide: 1.2, rShoulderSide: 1.2, lHip: 0.6, rHip: 0.3, lKnee: 0.6 }],
        [0.6, { rootY: -1.02, rootTilt: -1.5, spine: 0, lShoulderSide: 1.4, rShoulderSide: 1.4, lShoulder: 0.2, lHip: 0.2, rHip: 0.1, lKnee: 0.3, rKnee: 0.1, head: 0.1 }],
      ]);
    case "down":
      return p({ rootY: -1.02, rootTilt: -1.5, spine: 0, lShoulderSide: 1.4, rShoulderSide: 1.2 + Math.sin(t * 1.5) * 0.05, lShoulder: 0.2, lHip: 0.2, rHip: 0.1, lKnee: 0.5 + Math.sin(t * 1.2) * 0.1, rKnee: 0.1, head: 0.1 });
    case "getup":
      return keys(t, [
        [0, { rootY: -1.02, rootTilt: -1.5, lKnee: 0.5 }],
        [0.35, { rootY: -0.75, rootTilt: -0.4, spine: 1.0, lHip: 1.6, rHip: 1.6, lKnee: 2.2, rKnee: 2.2, lShoulder: 0.6, rShoulder: 0.6 }],
        [0.7, STANCE],
      ]);
    case "dodge":
      return keys(t, [
        [0, STANCE],
        [0.15, { ...STANCE, rootY: -0.3, spine: 0.9, lKnee: 1.2, rKnee: 1.2, lHip: 1.0, rHip: 1.0, rootRoll: 0.5 }],
        [0.4, STANCE],
      ]);
    case "pin":
      return p({ rootY: -0.82, rootTilt: 1.2, spine: 0.2, lShoulder: 1.2, rShoulder: 1.2, lElbow: 0.2, rElbow: 0.2, lHip: 0.9, rHip: 1.4, lKnee: 1.6, rKnee: 1.2 });
    case "pinned":
      return p({ rootY: -1.02, rootTilt: -1.5, lShoulderSide: 1.4, rShoulderSide: 1.4, lKnee: 0.3 + Math.max(0, Math.sin(t * 9)) * 0.4, lHip: 0.3 });
    case "victory": {
      const pump = Math.abs(Math.sin(t * 3));
      return p({ spine: -0.15, head: -0.3, lShoulder: 2.9, rShoulder: 2.4 + pump * 0.5, lShoulderSide: 0.5, rShoulderSide: 0.4, lElbow: 0.3, rElbow: 0.6 * pump, rootY: pump * 0.05 });
    }
    case "defeat":
      return p({ rootY: -1.02, rootTilt: -1.5, lShoulderSide: 1.5, rShoulderSide: 1.5, head: 0.2 });
    case "flex": {
      // double biceps, with a little pulse
      const pulse = Math.max(0, Math.sin(t * 2.2)) * 0.12;
      return p({ spine: -0.08, head: -0.12, lShoulderSide: 1.45, rShoulderSide: 1.45, lArmTwist: Math.PI / 2, rArmTwist: Math.PI / 2, lElbow: 1.95 + pulse, rElbow: 1.95 + pulse, lShoulder: 0.05, rShoulder: 0.05, lHip: 0.08, rHip: -0.08, lKnee: 0.08, rKnee: 0.08 });
    }
    case "lat-spread":
      return p({ spine: -0.05, head: -0.1, lShoulderSide: 0.75, rShoulderSide: 0.75, lArmTwist: -0.9, rArmTwist: -0.9, lElbow: 1.75, rElbow: 1.75, lShoulder: -0.25, rShoulder: -0.25, lHip: 0.05, rHip: -0.05 });
    case "most-muscular":
      return p({ spine: 0.35, head: 0.05, lShoulder: 0.5, rShoulder: 0.5, lShoulderSide: 0.35, rShoulderSide: 0.35, lArmTwist: 0.9, rArmTwist: 0.9, lElbow: 1.7, rElbow: 1.7, lKnee: 0.35, rKnee: 0.35, lHip: 0.3, rHip: 0.3, rootY: -0.06 });
    case "taunt":
      return p({ spine: -0.2, head: -0.3, lShoulder: 0.6, rShoulder: 2.9, rShoulderSide: 0.6, rElbow: 0.4 * Math.abs(Math.sin(t * 4)) });
    default:
      return p(STANCE);
  }
}

export function blendPose(current: Pose, target: Pose, k: number) {
  for (const key of Object.keys(target) as (keyof Pose)[]) current[key] += (target[key] - current[key]) * k;
  return current;
}
