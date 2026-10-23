"use client";
/**
 * Image-based lighting from a procedurally generated room (three.js
 * RoomEnvironment, no files): soft reflections and fill light so skin, sweat
 * and gear read as real materials instead of flat plastic. Built once.
 */
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

let cached: { renderer: THREE.WebGLRenderer; tex: THREE.Texture } | null = null;

export function roomEnvironment(renderer: THREE.WebGLRenderer) {
  if (cached?.renderer === renderer) return cached.tex;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  cached = { renderer, tex };
  return tex;
}

export function ArenaEnvironment({ intensity = 0.35 }: { intensity?: number }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    scene.environment = roomEnvironment(gl);
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
    };
  }, [gl, scene, intensity]);
  return null;
}
