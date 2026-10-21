/**
 * Builds a three.js skeleton from the base rest pose and maps the game's pose
 * library (joint angles in character space, see poses.ts) onto the bones.
 *
 * Each joint delta Dj is a rotation expressed in the character's rest frame
 * (+Z forward, +X the model's left). With W0 the bone's rest world rotation,
 * the bone's local rotation is  L = L0 · W0⁻¹ · Dj · W0,  so a child's world
 * rotation becomes (ancestors' deltas) · Dj · W0, exactly like nested groups.
 * The base mesh is in an A-pose; a fixed "virtual rest" first drops the arms
 * to the sides so the poses (authored for hanging arms) line up.
 */
import * as THREE from "three";
import type { Pose } from "../poses";
import type { HumanBase } from "./base";

export interface Rig {
  bones: THREE.Bone[];
  skeleton: THREE.Skeleton;
  root: THREE.Bone;
  by: (name: string) => THREE.Bone;
  index: Record<string, number>;
  /** Rest-space world positions of every bone (for sculpting and IK). */
  restWorld: THREE.Vector3[];
  apply: (p: Pose, extra: RigExtras) => void;
}

export interface RigExtras {
  /** 0 = open hand, 1 = tight fist. */
  fistL: number;
  fistR: number;
  /** Extra character-space rotations per bone (IK, recoil), applied on top of the pose. */
  overrides?: Map<number, THREE.Quaternion>;
  /** Keep feet flat on the floor. */
  plantFeet: boolean;
}

const FINGERS = ["f_index", "f_middle", "f_ring", "f_pinky"];
const e = new THREE.Euler();
const qTmp = new THREE.Quaternion();

export function buildRig(base: HumanBase): Rig {
  const bones = base.bones.map((b) => {
    const bone = new THREE.Bone();
    bone.name = b.name;
    bone.position.copy(b.position);
    bone.quaternion.copy(b.quaternion);
    return bone;
  });
  base.bones.forEach((b, i) => {
    if (b.parent >= 0) bones[b.parent].add(bones[i]);
  });
  const root = bones[base.bones.findIndex((b) => b.parent < 0)];
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const index = base.boneIndex;
  const by = (n: string) => bones[index[n]];
  const restWorld = bones.map((b) => b.getWorldPosition(new THREE.Vector3()));

  // ── Virtual rest: arms hanging straight down ──
  const W0 = bones.map((b) => b.getWorldQuaternion(new THREE.Quaternion()));
  const L0 = bones.map((b) => b.quaternion.clone());
  const order = bones.map((_, i) => i); // parents precede children in the glb
  const down = new THREE.Vector3(0, -1, 0);
  const base0 = new Map<number, THREE.Quaternion>();
  for (const s of ["L", "R"]) {
    const ua = index[`upper_arm${s}`];
    const fa = index[`forearm${s}`];
    const dir = restWorld[fa].clone().sub(restWorld[ua]).normalize();
    base0.set(ua, new THREE.Quaternion().setFromUnitVectors(dir, down));
  }
  const solve = (deltas: Map<number, THREE.Quaternion>, rest: THREE.Quaternion[], restLocal: THREE.Quaternion[]) => {
    for (const i of order) {
      const d = deltas.get(i);
      if (!d) {
        bones[i].quaternion.copy(restLocal[i]);
        continue;
      }
      // L = L0 · W0⁻¹ · D · W0
      qTmp.copy(rest[i]).invert().multiply(d).multiply(rest[i]);
      bones[i].quaternion.copy(restLocal[i]).multiply(qTmp);
    }
  };
  solve(base0, W0, L0);
  root.updateMatrixWorld(true);
  const W0v = bones.map((b) => b.getWorldQuaternion(new THREE.Quaternion()));
  const L0v = bones.map((b) => b.quaternion.clone());
  const rootRestPos = root.position.clone();
  // back to the true bind pose for skinning
  solve(new Map(), W0, L0);
  root.updateMatrixWorld(true);

  const q = (x: number, y: number, z: number, ord: THREE.EulerOrder = "XYZ") => new THREE.Quaternion().setFromEuler(e.set(x, y, z, ord));
  const deltas = new Map<number, THREE.Quaternion>();

  const fingerCurl = (side: "L" | "R", k: number) => {
    const sign = side === "L" ? 1 : -1;
    for (const f of FINGERS)
      for (let j = 1; j <= 3; j++) {
        const i = index[`${f}0${j}${side}`];
        // local bend axis of Rigify finger bones is +X
        bones[i].quaternion.copy(L0v[i]).multiply(qTmp.setFromAxisAngle(new THREE.Vector3(1, 0, 0), k * (j === 1 ? 1.35 : j === 2 ? 1.6 : 1.1)));
      }
    for (let j = 1; j <= 3; j++) {
      const i = index[`thumb0${j}${side}`];
      bones[i].quaternion.copy(L0v[i]).multiply(qTmp.setFromAxisAngle(new THREE.Vector3(1, 0, 0), k * (j === 1 ? 0.25 : 0.7)));
    }
    void sign;
  };

  const apply = (p: Pose, x: RigExtras) => {
    deltas.clear();
    const set = (n: string, quat: THREE.Quaternion) => deltas.set(index[n], quat);
    set("spine", q(p.rootTilt, 0, p.rootRoll));
    const third = q(p.spine / 3, p.twist / 3, 0);
    set("spine001", third);
    set("spine002", third.clone());
    set("spine003", third.clone());
    set("spine004", q(p.head * 0.4, 0, 0));
    set("spine005", q(p.head * 0.6, 0, 0));
    set("upper_armL", q(-p.lShoulder, p.lArmTwist, p.lShoulderSide, "XZY"));
    set("upper_armR", q(-p.rShoulder, -p.rArmTwist, -p.rShoulderSide, "XZY"));
    set("forearmL", q(-p.lElbow, 0, 0));
    set("forearmR", q(-p.rElbow, 0, 0));
    set("thighL", q(-p.lHip, 0, 0.05));
    set("thighR", q(-p.rHip, 0, -0.05));
    set("shinL", q(p.lKnee, 0, 0));
    set("shinR", q(p.rKnee, 0, 0));
    if (x.plantFeet) {
      const clampA = (v: number) => Math.max(-0.9, Math.min(0.9, v));
      set("footL", q(clampA(p.lHip - p.lKnee - p.rootTilt), 0, 0));
      set("footR", q(clampA(p.rHip - p.rKnee - p.rootTilt), 0, 0));
    }
    if (x.overrides) for (const [i, o] of x.overrides) deltas.set(i, (deltas.get(i) ?? new THREE.Quaternion()).clone().premultiply(o));
    solve(deltas, W0v, L0v);
    root.position.set(rootRestPos.x, rootRestPos.y + p.rootY, rootRestPos.z);
    fingerCurl("L", x.fistL);
    fingerCurl("R", x.fistR);
  };

  return { bones, skeleton, root, by, index, restWorld, apply };
}
