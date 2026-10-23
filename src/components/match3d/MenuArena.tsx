"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { ROSTER_WRESTLERS } from "@/data/seed";
import { ArenaLights, ArenaShell, Ring } from "./ArenaScene";
import { ArenaEnvironment } from "./Environment";
import { SafeCanvas } from "./SafeCanvas";
import { type RigDriver, WrestlerModel } from "./WrestlerModel";

function OrbitCamera() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.06;
    camera.position.set(Math.sin(t) * 11, 5.2 + Math.sin(t * 2) * 0.4, Math.cos(t) * 11);
    camera.lookAt(0, 1.6, 0);
  });
  return null;
}

function Pair() {
  const a = ROSTER_WRESTLERS.find((w) => w.id === "cody-rhodes")!;
  const b = ROSTER_WRESTLERS.find((w) => w.id === "roman-reigns")!;
  const da = useRef<RigDriver>({ x: -1, z: 0, facing: Math.PI / 2, anim: "idle", animTime: 0 });
  const db = useRef<RigDriver>({ x: 1, z: 0, facing: -Math.PI / 2, anim: "idle", animTime: 0.7 });
  useFrame((_, dt) => {
    da.current.animTime += dt;
    db.current.animTime += dt;
  });
  return (
    <>
      <WrestlerModel wrestler={a} driver={da} />
      <WrestlerModel wrestler={b} driver={db} />
    </>
  );
}

export default function MenuArena() {
  const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  return (
    <SafeCanvas
      fallback={<div className="h-full w-full bg-[radial-gradient(60%_60%_at_70%_40%,#1b2350,transparent)]" />}
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [9, 5, 9], fov: 42 }}
      frameloop={reduced ? "demand" : "always"}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#05060a"]} />
      <fog attach="fog" args={["#05060a", 16, 38]} />
      <ArenaLights />
      <ArenaEnvironment intensity={0.3} />
      <ArenaShell heat={0.35} crowdCount={1000} />
      <Ring />
      <Pair />
      <OrbitCamera />
    </SafeCanvas>
  );
}
