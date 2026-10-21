/**
 * Rapier ragdolls for knockdowns and slams. When a wrestler goes down, the
 * current animated pose is copied into a chain of capsule bodies (pelvis,
 * abdomen, chest, head, arms, legs) joined with ball and hinge joints, given
 * the momentum of the blow, and simulated onto the canvas. The bones then
 * follow the bodies until the wrestler starts to get up, when the model
 * blends back to animation.
 */
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { Rig } from "./rig";

let ready: Promise<typeof RAPIER> | null = null;
export function loadRapier() {
  ready ??= RAPIER.init().then(() => RAPIER);
  return ready;
}

interface Part {
  bone: string;
  tip: string;
  radius: number;
  mass: number;
}

const PARTS: Part[] = [
  { bone: "spine", tip: "spine001", radius: 0.13, mass: 14 },
  { bone: "spine002", tip: "spine003", radius: 0.14, mass: 12 },
  { bone: "spine003", tip: "spine004", radius: 0.15, mass: 16 },
  { bone: "spine005", tip: "spine005", radius: 0.1, mass: 6 },
  { bone: "upper_armL", tip: "forearmL", radius: 0.055, mass: 3 },
  { bone: "upper_armR", tip: "forearmR", radius: 0.055, mass: 3 },
  { bone: "forearmL", tip: "handL", radius: 0.045, mass: 2 },
  { bone: "forearmR", tip: "handR", radius: 0.045, mass: 2 },
  { bone: "thighL", tip: "shinL", radius: 0.08, mass: 9 },
  { bone: "thighR", tip: "shinR", radius: 0.08, mass: 9 },
  { bone: "shinL", tip: "footL", radius: 0.06, mass: 4 },
  { bone: "shinR", tip: "footR", radius: 0.06, mass: 4 },
];
/** [child, parent]: ball joints at the child's head. Heavy angular damping keeps limbs from flailing. */
const JOINTS: [string, string][] = [
  ["spine002", "spine"],
  ["spine003", "spine002"],
  ["spine005", "spine003"],
  ["upper_armL", "spine003"],
  ["upper_armR", "spine003"],
  ["forearmL", "upper_armL"],
  ["forearmR", "upper_armR"],
  ["thighL", "spine"],
  ["thighR", "spine"],
  ["shinL", "thighL"],
  ["shinR", "thighR"],
];
/** Collision groups: ragdoll parts (group 2) touch only the floor (group 1). */
const PART_GROUPS = (0x0002 << 16) | 0x0001;
const FLOOR_GROUPS = (0x0001 << 16) | 0x0002;

export class RagdollWorld {
  world: RAPIER.World;
  private acc = 0;
  constructor(
    private R: typeof RAPIER,
    floorY: number,
  ) {
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    const floor = R.RigidBodyDesc.fixed().setTranslation(0, floorY - 0.5, 0);
    const fb = this.world.createRigidBody(floor);
    this.world.createCollider(R.ColliderDesc.cuboid(4, 0.5, 4).setFriction(0.9).setRestitution(0.15).setCollisionGroups(FLOOR_GROUPS), fb);
  }
  step(dt: number) {
    this.acc += Math.min(dt, 0.1);
    const h = 1 / 60;
    this.world.timestep = h;
    while (this.acc >= h) {
      this.world.step();
      this.acc -= h;
    }
  }
  spawn(rig: Rig, group: THREE.Group, push: THREE.Vector3, spin: number) {
    return new Ragdoll(this.R, this.world, rig, group, push, spin);
  }
  dispose() {
    this.world.free();
  }
}

const tmpP = new THREE.Vector3();
const tmpT = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const pq = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);

export class Ragdoll {
  private bodies = new Map<string, { body: RAPIER.RigidBody; half: number; offset: THREE.Quaternion }>();
  private joints: RAPIER.ImpulseJoint[] = [];
  age = 0;
  constructor(
    R: typeof RAPIER,
    private world: RAPIER.World,
    private rig: Rig,
    private group: THREE.Group,
    push: THREE.Vector3,
    spin: number,
  ) {
    group.updateMatrixWorld(true);
    const scale = group.scale.x;
    for (const p of PARTS) {
      const bone = rig.by(p.bone);
      bone.matrixWorld.decompose(tmpP, tmpQ, tmpS);
      const tip = rig.by(p.tip).getWorldPosition(tmpT);
      let len = p.bone === p.tip ? 0.2 * scale : tmpP.distanceTo(tip);
      len = Math.max(len, 0.05);
      const dir = p.bone === p.tip ? new THREE.Vector3(0, 1, 0).applyQuaternion(tmpQ) : tip.clone().sub(tmpP).normalize();
      // body frame: +Y along the segment; remember how the bone sits in it
      const bodyQ = new THREE.Quaternion().setFromUnitVectors(Y, dir);
      const offset = bodyQ.clone().invert().multiply(tmpQ);
      const center = tmpP.clone().addScaledVector(dir, len / 2);
      const desc = R.RigidBodyDesc.dynamic()
        .setTranslation(center.x, center.y, center.z)
        .setRotation({ x: bodyQ.x, y: bodyQ.y, z: bodyQ.z, w: bodyQ.w })
        .setLinearDamping(0.4)
        .setAngularDamping(3.5)
        .setCanSleep(false);
      const body = world.createRigidBody(desc);
      const r = p.radius * scale;
      const half = Math.max(0.005, len / 2 - r * 0.6);
      world.createCollider(R.ColliderDesc.capsule(half, r).setMass(p.mass).setFriction(0.8).setRestitution(0.1).setCollisionGroups(PART_GROUPS), body);
      // momentum of the blow: more on the upper body, plus a little spin
      const k = p.bone.startsWith("spine") ? 1 : 0.8;
      body.setLinvel({ x: push.x * k, y: push.y * k, z: push.z * k }, true);
      body.setAngvel({ x: -push.z * spin, y: (Math.random() - 0.5) * spin, z: push.x * spin }, true);
      this.bodies.set(p.bone, { body, half: len / 2, offset });
    }
    for (const [child, parent] of JOINTS) {
      const c = this.bodies.get(child)!;
      const pa = this.bodies.get(parent)!;
      // joint at the child's head, expressed in both bodies' frames
      const anchorW = rig.by(child).getWorldPosition(new THREE.Vector3());
      const toLocal = (b: RAPIER.RigidBody, w: THREE.Vector3) => {
        const t = b.translation();
        const r = b.rotation();
        return w.clone().sub(new THREE.Vector3(t.x, t.y, t.z)).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w).invert());
      };
      const a1 = toLocal(pa.body, anchorW);
      const a2 = toLocal(c.body, anchorW);
      const j = world.createImpulseJoint(R.JointData.spherical(a1, a2), pa.body, c.body, true);
      j.setContactsEnabled(false);
      this.joints.push(j);
    }
  }

  /** Copy body transforms onto the bones. */
  apply(dt: number) {
    this.age += dt;
    const g = this.group;
    g.updateMatrixWorld(true);
    for (const p of PARTS) {
      const part = this.bodies.get(p.bone)!;
      const bone = this.rig.by(p.bone);
      const r = part.body.rotation();
      const bodyQ = tmpQ.set(r.x, r.y, r.z, r.w);
      const worldQ = bodyQ.clone().multiply(part.offset);
      const parent = bone.parent as THREE.Object3D;
      if (p.bone === "spine") {
        // the root bone also takes its position from the pelvis body
        const t = part.body.translation();
        const head = new THREE.Vector3(0, -part.half, 0).applyQuaternion(bodyQ).add(new THREE.Vector3(t.x, t.y, t.z));
        bone.position.copy(parent.worldToLocal(head));
        parent.getWorldQuaternion(pq);
      } else parent.getWorldQuaternion(pq);
      bone.quaternion.copy(pq.invert().multiply(worldQ));
      bone.updateMatrixWorld(true);
    }
  }

  /** How settled the body is (0 = still). */
  energy() {
    let e = 0;
    for (const { body } of this.bodies.values()) {
      const v = body.linvel();
      e += v.x * v.x + v.y * v.y + v.z * v.z;
    }
    return e / this.bodies.size;
  }

  dispose() {
    for (const j of this.joints) this.world.removeImpulseJoint(j, false);
    for (const { body } of this.bodies.values()) this.world.removeRigidBody(body);
    this.bodies.clear();
    this.joints = [];
  }
}
