"use client";
/** Studio viewport for the character editor: orbitable, lit like a photo shoot. */
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type React from "react";
import { useEffect, useRef } from "react";

import type { Wrestler } from "@/engine/types";
import { SafeCanvas } from "./SafeCanvas";
import { type RigDriver, WrestlerModel } from "./WrestlerModel";

export type CameraPreset = "full" | "upper" | "face";
const CAMERA: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  full: { pos: [0, 1.25, 4.1], target: [0, 1.0, 0] },
  upper: { pos: [0, 1.6, 2.1], target: [0, 1.45, 0] },
  face: { pos: [0, 1.78, 0.95], target: [0, 1.76, 0] },
};

type ModelSource = Pick<Wrestler, "appearance" | "division" | "heightIn">;

function Rig({ wrestler, anim, turntable, preset }: { wrestler: ModelSource; anim: string; turntable: boolean; preset: CameraPreset }) {
  const driver = useRef<RigDriver>({ x: 0, z: 0, y: 0, facing: 0, anim, animTime: 0 });
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  const scale = wrestler.heightIn / 74;

  useEffect(() => {
    driver.current.anim = anim;
    driver.current.animTime = 0;
  }, [anim]);

  useEffect(() => {
    const c = CAMERA[preset];
    camera.position.set(c.pos[0], c.pos[1] * scale, c.pos[2]);
    controls.current?.target.set(c.target[0], c.target[1] * scale, c.target[2]);
    controls.current?.update();
  }, [preset, camera, scale]);

  useFrame((_, dt) => {
    driver.current.animTime += dt;
    if (turntable) driver.current.facing += dt * 0.5;
  });

  return (
    <>
      <WrestlerModel wrestler={wrestler} driver={driver} />
      <OrbitControls ref={controls} enablePan={false} minDistance={0.6} maxDistance={7} maxPolarAngle={Math.PI * 0.55} makeDefault />
    </>
  );
}

export default function CharacterStage({ wrestler, anim, turntable, preset, accent }: { wrestler: ModelSource; anim: string; turntable: boolean; preset: CameraPreset; accent: string }) {
  return (
    <SafeCanvas
      fallback={
        <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">
          3D preview unavailable in this browser (WebGL is off). You can still edit and save the look; the portrait updates live.
        </div>
      }
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.25, 4.1], fov: 35 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#0b0d14"]} />
      <fog attach="fog" args={["#0b0d14", 6, 14]} />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#c7d2fe", "#1a0f12", 0.45]} />
      {/* key */}
      <directionalLight position={[2.5, 4, 3]} intensity={2.6} castShadow shadow-mapSize={[1024, 1024]} color="#fff4e6" />
      {/* brand-coloured rim lights carve out the muscle silhouette */}
      <pointLight position={[-2.2, 2.2, -1.6]} intensity={14} distance={8} color={accent} />
      <pointLight position={[2.2, 1.6, -1.8]} intensity={10} distance={8} color="#7aa2ff" />
      <pointLight position={[0, 0.6, 2.5]} intensity={3} distance={6} color="#ffffff" />
      <mesh position={[0, -0.03, 0]} receiveShadow>
        <cylinderGeometry args={[1.1, 1.18, 0.06, 64]} />
        <meshStandardMaterial color="#141824" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.02, 1.1, 64]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      <ContactShadows position={[0, 0.003, 0]} opacity={0.6} scale={4} blur={2.4} far={2} />
      <Rig wrestler={wrestler} anim={anim} turntable={turntable} preset={preset} />
    </SafeCanvas>
  );
}
