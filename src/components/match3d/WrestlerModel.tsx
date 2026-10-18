"use client";
/**
 * Stylised, original modular wrestler built from primitives. Body proportions,
 * outfit, hair and colours come from the wrestler's appearance data, so every
 * character looks distinct without any external model files.
 */
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Wrestler } from "@/engine/types";
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

export function WrestlerModel({ wrestler, driver }: { wrestler: Wrestler; driver: MutableRefObject<RigDriver> }) {
  const a = wrestler.appearance;
  const women = wrestler.division === "women";
  const scale = wrestler.heightIn / 74;
  const bulk = a.bulk;
  const dims = useMemo(() => {
    const w = 1 + bulk * 0.45 - (women ? 0.1 : 0);
    return {
      hip: 0.95,
      torsoLen: 0.62,
      shoulderW: 0.21 * w,
      chestR: 0.17 * w,
      waistR: 0.14 * (1 + bulk * 0.55) * (women ? 0.85 : 1),
      armR: 0.055 * (1 + bulk * 0.6),
      legR: 0.075 * (1 + bulk * 0.5),
      upperArm: 0.3,
      foreArm: 0.28,
      thigh: 0.45,
      shin: 0.45,
      headR: 0.115,
    };
  }, [bulk, women]);

  const mats = useMemo(() => {
    const skin = new THREE.MeshStandardMaterial({ color: a.skinTone, roughness: 0.55 });
    const primary = new THREE.MeshStandardMaterial({ color: a.primaryColor, roughness: 0.4, metalness: 0.05 });
    const secondary = new THREE.MeshStandardMaterial({ color: a.secondaryColor, roughness: 0.45 });
    const hair = new THREE.MeshStandardMaterial({ color: a.hairColor, roughness: 0.8 });
    const boot = new THREE.MeshStandardMaterial({ color: "#111318", roughness: 0.5 });
    const flash = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0 });
    return { skin, primary, secondary, hair, boot, flash };
  }, [a.skinTone, a.primaryColor, a.secondaryColor, a.hairColor]);

  const torsoMat = a.outfit === "singlet" || a.outfit === "bodysuit" || women ? mats.primary : mats.skin;
  const legMat = a.outfit === "trunks" ? mats.skin : mats.primary;

  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
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
      // smooth facing
      let diff = d.facing - root.current.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      root.current.rotation.y += diff * Math.min(1, dt * 14);
    }
    if (body.current) {
      body.current.position.y = (dims.hip + p.rootY) * 1;
      body.current.rotation.set(p.rootTilt, 0, p.rootRoll);
    }
    spine.current?.rotation.set(p.spine, p.twist, 0);
    head.current?.rotation.set(p.head, 0, 0);
    lSh.current?.rotation.set(-p.lShoulder, 0, p.lShoulderSide);
    rSh.current?.rotation.set(-p.rShoulder, 0, -p.rShoulderSide);
    lEl.current?.rotation.set(-p.lElbow, 0, 0);
    rEl.current?.rotation.set(-p.rElbow, 0, 0);
    lHip.current?.rotation.set(-p.lHip, 0, 0.04);
    rHip.current?.rotation.set(-p.rHip, 0, -0.04);
    lKn.current?.rotation.set(p.lKnee, 0, 0);
    rKn.current?.rotation.set(p.rKnee, 0, 0);
    mats.flash.opacity = Math.max(0, (d.flash ?? 0) * 0.6);
  });

  const limb = (r: number, len: number, mat: THREE.Material) => (
    <mesh position={[0, -len / 2, 0]} castShadow material={mat}>
      <capsuleGeometry args={[r, len - r, 4, 10]} />
    </mesh>
  );

  const hairMesh = (() => {
    if (a.mask) return null;
    const r = dims.headR;
    switch (a.hairStyle) {
      case "bald":
        return null;
      case "buzz":
        return (
          <mesh position={[0, 0.015, -0.005]} material={mats.hair} scale={[1.02, 0.85, 1.02]}>
            <sphereGeometry args={[r * 1.01, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
          </mesh>
        );
      case "short":
        return (
          <mesh position={[0, 0.02, -0.01]} material={mats.hair}>
            <sphereGeometry args={[r * 1.08, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        );
      case "mohawk":
        return (
          <mesh position={[0, r * 0.95, -0.01]} material={mats.hair}>
            <boxGeometry args={[0.035, 0.08, r * 2]} />
          </mesh>
        );
      case "ponytail":
        return (
          <group>
            <mesh position={[0, 0.02, -0.01]} material={mats.hair}>
              <sphereGeometry args={[r * 1.08, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
            <mesh position={[0, -0.06, -r * 1.2]} rotation={[0.4, 0, 0]} material={mats.hair}>
              <capsuleGeometry args={[0.035, 0.22, 4, 8]} />
            </mesh>
          </group>
        );
      case "long":
        return (
          <group>
            <mesh position={[0, 0.02, -0.01]} material={mats.hair}>
              <sphereGeometry args={[r * 1.1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
            </mesh>
            <mesh position={[0, -0.14, -r * 0.55]} material={mats.hair}>
              <boxGeometry args={[r * 2.1, 0.3, r * 0.9]} />
            </mesh>
          </group>
        );
    }
  })();

  return (
    <group ref={root} scale={scale}>
      <group ref={body}>
        {/* pelvis / trunks */}
        <mesh position={[0, 0.02, 0]} castShadow material={a.outfit === "trunks" ? mats.primary : legMat}>
          <capsuleGeometry args={[dims.waistR, 0.08, 4, 12]} />
        </mesh>
        {a.outfit === "trunks" && (
          <mesh position={[0, 0.07, 0]} material={mats.secondary}>
            <torusGeometry args={[dims.waistR * 1.02, 0.012, 6, 20]} />
          </mesh>
        )}
        {/* spine */}
        <group ref={spine} position={[0, 0.08, 0]}>
          <mesh position={[0, dims.torsoLen * 0.42, 0]} castShadow material={torsoMat} scale={[1, 1, 0.72]}>
            <capsuleGeometry args={[dims.chestR, dims.torsoLen * 0.45, 4, 14]} />
          </mesh>
          {a.outfit === "singlet" && (
            <mesh position={[0, dims.torsoLen * 0.42, 0]} material={mats.secondary} scale={[1.02, 1, 0.74]}>
              <capsuleGeometry args={[dims.chestR, dims.torsoLen * 0.08, 4, 14]} />
            </mesh>
          )}
          {/* neck + head */}
          <mesh position={[0, dims.torsoLen * 0.85, 0]} material={mats.skin}>
            <cylinderGeometry args={[0.05 + bulk * 0.025, 0.06 + bulk * 0.03, 0.12, 10]} />
          </mesh>
          <group ref={head} position={[0, dims.torsoLen * 0.85 + 0.15, 0]}>
            <mesh castShadow material={a.mask ? mats.primary : mats.skin} scale={[0.9, 1.08, 0.98]}>
              <sphereGeometry args={[dims.headR, 18, 14]} />
            </mesh>
            {a.mask && (
              <mesh material={mats.secondary} scale={[0.92, 1.1, 1]}>
                <torusGeometry args={[dims.headR * 0.98, 0.012, 6, 24, Math.PI]} />
              </mesh>
            )}
            {/* eyes */}
            <mesh position={[0.04, 0.02, dims.headR * 0.9]} material={mats.boot}>
              <sphereGeometry args={[0.014, 8, 6]} />
            </mesh>
            <mesh position={[-0.04, 0.02, dims.headR * 0.9]} material={mats.boot}>
              <sphereGeometry args={[0.014, 8, 6]} />
            </mesh>
            {!a.mask && a.facialHair === "beard" && (
              <mesh position={[0, -0.06, 0.04]} material={mats.hair} scale={[1, 0.8, 0.9]}>
                <sphereGeometry args={[dims.headR * 0.78, 12, 10, 0, Math.PI * 2, Math.PI / 2.4, Math.PI / 2]} />
              </mesh>
            )}
            {!a.mask && a.facialHair === "goatee" && (
              <mesh position={[0, -0.095, 0.08]} material={mats.hair}>
                <sphereGeometry args={[0.03, 8, 6]} />
              </mesh>
            )}
            {hairMesh}
          </group>
          {/* arms */}
          {(
            [
              [lSh, lEl, 1],
              [rSh, rEl, -1],
            ] as const
          ).map(([sh, el, side]) => (
            <group key={side} ref={sh} position={[side * (dims.shoulderW + dims.armR * 0.8), dims.torsoLen * 0.72, 0]}>
              <mesh material={torsoMat} castShadow>
                <sphereGeometry args={[dims.armR * 1.35, 10, 8]} />
              </mesh>
              {limb(dims.armR * 1.1, dims.upperArm, mats.skin)}
              <group ref={el} position={[0, -dims.upperArm, 0]}>
                {limb(dims.armR, dims.foreArm, mats.skin)}
                <mesh position={[0, -dims.foreArm * 0.55, 0]} material={mats.secondary}>
                  <cylinderGeometry args={[dims.armR * 1.05, dims.armR * 1.05, 0.08, 10]} />
                </mesh>
                <mesh position={[0, -dims.foreArm - 0.03, 0]} material={mats.skin}>
                  <sphereGeometry args={[dims.armR * 1.15, 8, 8]} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
        {/* legs */}
        {(
          [
            [lHip, lKn, 1],
            [rHip, rKn, -1],
          ] as const
        ).map(([hip, knee, side]) => (
          <group key={side} ref={hip} position={[side * dims.waistR * 0.55, -0.02, 0]}>
            {limb(dims.legR * 1.15, dims.thigh, legMat)}
            <group ref={knee} position={[0, -dims.thigh, 0]}>
              <mesh material={mats.secondary}>
                <sphereGeometry args={[dims.legR * 1.2, 10, 8]} />
              </mesh>
              {limb(dims.legR, dims.shin, a.outfit === "trunks" ? mats.boot : legMat)}
              <mesh position={[0, -dims.shin - 0.02, 0.05]} material={mats.boot} castShadow>
                <boxGeometry args={[dims.legR * 1.6, 0.07, 0.22]} />
              </mesh>
            </group>
          </group>
        ))}
        {/* hit flash shell */}
        <mesh position={[0, 0.35, 0]} material={mats.flash}>
          <sphereGeometry args={[0.55, 12, 10]} />
        </mesh>
      </group>
    </group>
  );
}
