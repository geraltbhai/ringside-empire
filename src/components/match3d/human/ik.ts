/**
 * Analytic two-bone IK for the arms (shoulder → elbow → wrist), used so hands
 * actually take hold of the opponent in tie-ups, lifts and slams. Works in
 * world space on an already-posed skeleton and writes back local rotations.
 */
import * as THREE from "three";
import type { Rig } from "./rig";

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();
const t = new THREE.Vector3();
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const axis = new THREE.Vector3();
const q = new THREE.Quaternion();
const wq = new THREE.Quaternion();
const pq = new THREE.Quaternion();
const before = new THREE.Quaternion();

/** Rotate a bone by a world-space rotation, keeping its parent fixed. */
function rotateWorld(bone: THREE.Bone, rot: THREE.Quaternion) {
  bone.getWorldQuaternion(wq);
  wq.premultiply(rot);
  (bone.parent as THREE.Object3D).getWorldQuaternion(pq);
  bone.quaternion.copy(pq.invert().multiply(wq));
  bone.updateMatrixWorld(true);
}

export function solveArmIK(rig: Rig, side: "L" | "R", target: THREE.Vector3, weight: number) {
  if (weight <= 0.001) return;
  const upper = rig.by(`upper_arm${side}`);
  const fore = rig.by(`forearm${side}`);
  const hand = rig.by(`hand${side}`);
  const u0 = before.copy(upper.quaternion);
  const f0 = fore.quaternion.clone();
  upper.getWorldPosition(a);
  fore.getWorldPosition(b);
  hand.getWorldPosition(c);
  t.copy(target);
  const l1 = a.distanceTo(b);
  const l2 = b.distanceTo(c);
  const reach = Math.min(t.distanceTo(a), (l1 + l2) * 0.999);

  // 1) set the elbow angle with the law of cosines
  const cur = Math.acos(THREE.MathUtils.clamp(v1.subVectors(a, b).normalize().dot(v2.subVectors(c, b).normalize()), -1, 1));
  const want = Math.acos(THREE.MathUtils.clamp((l1 * l1 + l2 * l2 - reach * reach) / (2 * l1 * l2), -1, 1));
  axis.crossVectors(v1, v2);
  if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0);
  axis.normalize();
  q.setFromAxisAngle(axis, want - cur);
  rotateWorld(fore, q);

  // 2) swing the upper arm so the wrist lands on the target
  hand.getWorldPosition(c);
  v1.subVectors(c, a).normalize();
  v2.subVectors(t, a).normalize();
  q.setFromUnitVectors(v1, v2);
  rotateWorld(upper, q);

  // blend with the animated pose
  if (weight < 1) {
    upper.quaternion.copy(u0.slerp(upper.quaternion, weight));
    fore.quaternion.copy(f0.slerp(fore.quaternion, weight));
    upper.updateMatrixWorld(true);
  }
}
