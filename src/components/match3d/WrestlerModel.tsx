"use client";
/**
 * Original, procedurally sculpted wrestler. The body (muscles, fat, frame,
 * gear and face paint) comes from `buildBody`; this component rigs the parts
 * into a joint hierarchy and drives it with the keyframed pose library.
 */
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Appearance, Division, Wrestler } from "@/engine/types";
import { buildBody, disposeBody } from "./body";
import { blendPose, NEUTRAL, type Pose, poseFor } from "./poses";

export interface RigDriver {
  x: number;
  z: number;
  y?: number;
  facing: number;
  anim: string;
  animTime: number;
  flash?: number;
}

type ModelSource = Pick<Wrestler, "appearance" | "division" | "heightIn">;

export function WrestlerModel({ wrestler, driver, castShadow = true }: { wrestler: ModelSource; driver: MutableRefObject<RigDriver>; castShadow?: boolean }) {
  const a = wrestler.appearance;
  const key = JSON.stringify(a) + wrestler.division;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const body = useMemo(() => buildBody(a as Appearance, wrestler.division as Division), [key]);
  useEffect(() => () => disposeBody(body), [body]);
  const dims = body.dims;
  const scale = wrestler.heightIn / 74;

  const mats = useMemo(() => {
    const flesh = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.5 });
    const skin = new THREE.MeshPhysicalMaterial({ color: a.skinTone, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.5 });
    const hair = new THREE.MeshStandardMaterial({ color: a.hairColor, roughness: 0.75 });
    const hairShell = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const boot = new THREE.MeshStandardMaterial({ color: a.bootColor, roughness: 0.35, metalness: 0.05 });
    const knee = new THREE.MeshStandardMaterial({ color: body.knee[0], roughness: 0.55 });
    const eyeWhite = new THREE.MeshStandardMaterial({ color: "#e8e6e3", roughness: 0.3 });
    const iris = new THREE.MeshStandardMaterial({ color: "#1b1410", roughness: 0.2 });
    const flash = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false });
    return { flesh, skin, hair, hairShell, boot, knee, eyeWhite, iris, flash };
  }, [a.skinTone, a.hairColor, a.bootColor, body.knee]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const root = useRef<THREE.Group>(null);
  const bodyG = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const lSh = useRef<THREE.Group>(null);
  const rSh = useRef<THREE.Group>(null);
  const lEl = useRef<THREE.Group>(null);
  const rEl = useRef<THREE.Group>(null);
  const lHip = useRef<THREE.Group>(null);
  const rHip = useRef<THREE.Group>(null);
  const lKn = useRef<THREE.Group>(null);
  const rKn = useRef<THREE.Group>(null);
  const pose = useRef<Pose>({ ...NEUTRAL });

  useFrame((_, dt) => {
    const d = driver.current;
    const target = poseFor(d.anim, d.animTime);
    const p = blendPose(pose.current, target, Math.min(1, dt * 18));
    if (root.current) {
      root.current.position.set(d.x, d.y ?? 1.2, d.z);
      let diff = d.facing - root.current.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      root.current.rotation.y += diff * Math.min(1, dt * 14);
    }
    if (bodyG.current) {
      bodyG.current.position.y = dims.hipY + p.rootY;
      bodyG.current.rotation.set(p.rootTilt, 0, p.rootRoll);
    }
    spine.current?.rotation.set(p.spine, p.twist, 0);
    head.current?.rotation.set(p.head, 0, 0);
    lSh.current?.rotation.set(-p.lShoulder, p.lArmTwist, p.lShoulderSide, "XZY");
    rSh.current?.rotation.set(-p.rShoulder, -p.rArmTwist, -p.rShoulderSide, "XZY");
    lEl.current?.rotation.set(-p.lElbow, 0, 0);
    rEl.current?.rotation.set(-p.rElbow, 0, 0);
    lHip.current?.rotation.set(-p.lHip, 0, 0.05);
    rHip.current?.rotation.set(-p.rHip, 0, -0.05);
    lKn.current?.rotation.set(p.lKnee, 0, 0);
    rKn.current?.rotation.set(p.rKnee, 0, 0);
    mats.flash.opacity = Math.max(0, (d.flash ?? 0) * 0.55);
  });

  const hR = dims.headR;
  const hairMesh = (() => {
    if (a.mask) return null;
    const shell = body.hair ? <mesh geometry={body.hair} material={mats.hairShell} castShadow={castShadow} /> : null;
    switch (a.hairStyle) {
      case "ponytail":
        return (
          <group>
            {shell}
            <mesh position={[0, 0.13, -hR * 0.98]} material={mats.hair}>
              <sphereGeometry args={[0.022, 10, 8]} />
            </mesh>
            <mesh position={[0, 0.03, -hR * 1.12]} rotation={[0.3, 0, 0]} material={mats.hair} castShadow={castShadow}>
              <capsuleGeometry args={[0.026, 0.2, 4, 10]} />
            </mesh>
          </group>
        );
      case "long":
        return (
          <group>
            {shell}
            <mesh position={[0, -0.03, -hR * 0.66]} rotation={[0.08, 0, 0]} scale={[1, 1, 0.45]} material={mats.hair} castShadow={castShadow}>
              <capsuleGeometry args={[hR * 0.9, 0.2, 6, 16]} />
            </mesh>
          </group>
        );
      default:
        return shell;
    }
  })();

  const arm = (side: 1 | -1, shRef: typeof lSh, elRef: typeof lEl) => {
    const i = side === 1 ? 0 : 1;
    return (
      <group ref={shRef} position={[side * dims.shoulderX, dims.shoulderY, 0]}>
        <mesh geometry={body.delt[i]} material={mats.flesh} castShadow={castShadow} />
        <mesh geometry={body.upperArm[i]} material={mats.flesh} castShadow={castShadow} />
        <group ref={elRef} position={[0, -dims.upperArm, 0]}>
          <mesh material={mats.skin}>
            <sphereGeometry args={[dims.armR * 0.82, 12, 10]} />
          </mesh>
          <mesh geometry={body.foreArm[i]} material={mats.flesh} castShadow={castShadow} />
          <mesh position={[0, -dims.foreArm - dims.handR * 0.8, 0.005]} scale={[0.92, 1.05, 1.15]} material={mats.skin} castShadow={castShadow}>
            <sphereGeometry args={[dims.handR, 14, 12]} />
          </mesh>
        </group>
      </group>
    );
  };

  const leg = (side: 1 | -1, hipRef: typeof lHip, kneeRef: typeof lKn) => {
    const i = side === 1 ? 0 : 1;
    return (
      <group ref={hipRef} position={[side * dims.hipX, -0.04, 0]}>
        <mesh geometry={body.thigh[i]} material={mats.flesh} castShadow={castShadow} />
        <group ref={kneeRef} position={[0, -dims.thigh, 0]}>
          <mesh material={mats.knee}>
            <sphereGeometry args={[dims.legR * 0.66, 14, 10]} />
          </mesh>
          <mesh geometry={body.shin[i]} material={mats.flesh} castShadow={castShadow} />
          <mesh position={[0, -dims.shin - 0.028, 0.045]} rotation={[Math.PI / 2, 0, 0]} scale={[1.15, 1, 0.72]} material={mats.boot} castShadow={castShadow}>
            <capsuleGeometry args={[0.045, 0.13, 4, 10]} />
          </mesh>
        </group>
      </group>
    );
  };

  return (
    <group ref={root} scale={scale}>
      <group ref={bodyG}>
        <mesh geometry={body.pelvis} material={mats.flesh} castShadow={castShadow} />
        <group ref={spine}>
          <mesh geometry={body.torso} material={mats.flesh} castShadow={castShadow} receiveShadow />
          <mesh geometry={body.neck} material={mats.flesh} castShadow={castShadow} />
          <group ref={head} position={[0, dims.neckTop, -0.004]}>
            <mesh geometry={body.head} material={mats.flesh} castShadow={castShadow} />
            {[1, -1].map((s) => (
              <group key={s} position={[s * 0.03, 0.112, 0.088]}>
                <mesh material={mats.eyeWhite}>
                  <sphereGeometry args={[0.0105, 10, 8]} />
                </mesh>
                <mesh position={[0, 0, 0.0075]} material={mats.iris}>
                  <sphereGeometry args={[0.0055, 8, 6]} />
                </mesh>
              </group>
            ))}
            {hairMesh}
          </group>
          {arm(1, lSh, lEl)}
          {arm(-1, rSh, rEl)}
        </group>
        {leg(1, lHip, lKn)}
        {leg(-1, rHip, rKn)}
        <mesh position={[0, 0.3, 0]} material={mats.flash}>
          <sphereGeometry args={[0.6, 12, 10]} />
        </mesh>
      </group>
    </group>
  );
}
