"use client";
/**
 * Original 3D arena built entirely from Three.js primitives: ring (mat, apron,
 * posts, turnbuckles, ropes), floor, barricade, entrance stage, instanced crowd
 * and arena lighting. No external models are loaded, so nothing can fail to fetch.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export const RING = {
  half: 3.05, // ring is 6.1 m (20 ft) square, measured between posts
  matY: 1.2,
  ropeHeights: [0.45, 0.85, 1.25],
};

function Rope({ from, to, y, color }: { from: [number, number]; to: [number, number]; y: number; color: string }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  return (
    <mesh position={[(from[0] + to[0]) / 2, y, (from[1] + to[1]) / 2]} rotation={[Math.PI / 2, 0, -angle]} castShadow>
      <cylinderGeometry args={[0.035, 0.035, len, 8]} />
      <meshStandardMaterial color={color} roughness={0.45} />
    </mesh>
  );
}

export function Ring({ ropeColors = ["#e11d48", "#f8fafc", "#2f6bff"], apronColor = "#0b0e16" }: { ropeColors?: string[]; apronColor?: string }) {
  const h = RING.half;
  const corners: [number, number][] = [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ];
  return (
    <group>
      {/* mat */}
      <mesh position={[0, RING.matY - 0.05, 0]} receiveShadow>
        <boxGeometry args={[h * 2 + 0.6, 0.1, h * 2 + 0.6]} />
        <meshStandardMaterial color="#d9dde6" roughness={0.9} />
      </mesh>
      {/* center logo ring */}
      <mesh position={[0, RING.matY + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.0, 1.15, 48]} />
        <meshStandardMaterial color="#9aa1b2" roughness={0.9} />
      </mesh>
      {/* apron skirt */}
      <mesh position={[0, RING.matY / 2 - 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[h * 2 + 0.6, RING.matY - 0.1, h * 2 + 0.6]} />
        <meshStandardMaterial color={apronColor} roughness={0.7} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, RING.matY * 0.55, 0]} rotation={[0, (i * Math.PI) / 2, 0]}>
          <boxGeometry args={[h * 2 + 0.62, 0.08, h * 2 + 0.62]} />
          <meshStandardMaterial color={i % 2 ? "#2f6bff" : "#e11d48"} emissive={i % 2 ? "#1d3fa8" : "#8a0f2b"} emissiveIntensity={0.6} />
        </mesh>
      ))}
      {/* posts and turnbuckles */}
      {corners.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, (RING.matY + 1.45) / 2, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, RING.matY + 1.45, 10]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.3} />
          </mesh>
          {RING.ropeHeights.map((ry) => (
            <mesh key={ry} position={[-Math.sign(x) * 0.08, RING.matY + ry, -Math.sign(z) * 0.08]} castShadow>
              <boxGeometry args={[0.2, 0.22, 0.2]} />
              <meshStandardMaterial color={i % 2 ? "#2f6bff" : "#e11d48"} roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}
      {/* ropes */}
      {RING.ropeHeights.map((ry, ri) =>
        corners.map((c, i) => <Rope key={`${ri}-${i}`} from={c} to={corners[(i + 1) % 4]} y={RING.matY + ry} color={ropeColors[ri % ropeColors.length]} />),
      )}
      {/* steps */}
      {[
        [h + 0.9, -h + 0.6],
        [-h - 0.9, h - 0.6],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.45, z]} castShadow>
          <boxGeometry args={[0.9, 0.9, 1.2]} />
          <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** Instanced crowd: thousands of simple figures that bob when the crowd is hot. */
export function Crowd({ heat = 0.5, count = 1400 }: { heat?: number; count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const seats = useMemo(() => {
    const out: { x: number; y: number; z: number; phase: number; color: THREE.Color }[] = [];
    const palette = ["#e11d48", "#2f6bff", "#f8fafc", "#d9a520", "#475569", "#1f2937", "#9333ea"];
    let s = 1;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const sides = [
      { axis: "z", sign: 1 },
      { axis: "z", sign: -1 },
      { axis: "x", sign: 1 },
      { axis: "x", sign: -1 },
    ] as const;
    const perSide = Math.floor(count / 4);
    for (const side of sides) {
      for (let i = 0; i < perSide; i++) {
        const row = Math.floor(i / 70);
        const col = i % 70;
        const along = -17 + col * 0.5 + rand() * 0.15;
        const depth = 9.5 + row * 0.85;
        const y = 0.6 + row * 0.55;
        if (side.axis === "z" && side.sign === -1 && Math.abs(along) < 4) continue; // entrance gap
        const x = side.axis === "x" ? side.sign * depth : along;
        const z = side.axis === "z" ? side.sign * depth : along;
        out.push({ x, y, z, phase: rand() * Math.PI * 2, color: new THREE.Color(palette[Math.floor(rand() * palette.length)]).multiplyScalar(0.35 + rand() * 0.3) });
      }
    }
    return out;
  }, [count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    seats.forEach((p, i) => {
      const bob = Math.max(0, Math.sin(t * (3 + heat * 5) + p.phase)) * 0.18 * heat;
      dummy.position.set(p.x, p.y + bob, p.z);
      dummy.lookAt(0, p.y, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, seats.length]}
      onUpdate={(m) => {
        seats.forEach((p, i) => m.setColorAt(i, p.color));
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }}
    >
      <capsuleGeometry args={[0.16, 0.45, 2, 6]} />
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
  );
}

export function ArenaShell({ heat = 0.5, crowdCount = 1400 }: { heat?: number; crowdCount?: number }) {
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#07080c" roughness={0.95} />
      </mesh>
      {/* ringside mats */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[13, 13]} />
        <meshStandardMaterial color="#15182a" roughness={0.9} />
      </mesh>
      {/* barricade */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.sin((i * Math.PI) / 2) * 6.6, 0.55, Math.cos((i * Math.PI) / 2) * 6.6]} rotation={[0, (i * Math.PI) / 2, 0]}>
          <boxGeometry args={[13.2, 1.1, 0.12]} />
          <meshStandardMaterial color="#111827" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {/* entrance stage with big screen */}
      <group position={[0, 0, -16]}>
        <mesh position={[0, 0.6, 0]} receiveShadow>
          <boxGeometry args={[10, 1.2, 4]} />
          <meshStandardMaterial color="#0b0d14" />
        </mesh>
        <mesh position={[0, 5.5, -1.6]}>
          <boxGeometry args={[12, 7, 0.3]} />
          <meshStandardMaterial color="#0f172a" emissive="#1e3a8a" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, 5.5, -1.4]}>
          <planeGeometry args={[11, 6.2]} />
          <meshBasicMaterial color="#1b1f3b" />
        </mesh>
        {/* ramp */}
        <mesh position={[0, 0.3, 6]} receiveShadow>
          <boxGeometry args={[3, 0.6, 8]} />
          <meshStandardMaterial color="#111421" />
        </mesh>
      </group>
      <Crowd heat={heat} count={crowdCount} />
    </group>
  );
}

export function ArenaLights({ shadows = true }: { shadows?: boolean }) {
  return (
    <>
      <ambientLight intensity={0.25} />
      <hemisphereLight args={["#9fb4ff", "#120a12", 0.35]} />
      <spotLight position={[0, 14, 0]} angle={0.5} penumbra={0.5} intensity={420} distance={30} castShadow={shadows} shadow-mapSize={[1024, 1024]} color="#fff6e8" />
      <spotLight position={[9, 10, 9]} angle={0.4} penumbra={0.7} intensity={180} distance={30} color="#ffd6e0" target-position={[0, 1.2, 0]} />
      <spotLight position={[-9, 10, -9]} angle={0.4} penumbra={0.7} intensity={180} distance={30} color="#d6e4ff" target-position={[0, 1.2, 0]} />
      <pointLight position={[0, 6, -14]} intensity={60} distance={18} color="#3b5bff" />
    </>
  );
}
