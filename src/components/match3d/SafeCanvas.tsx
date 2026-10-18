"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";
import { Component, type ReactNode, useState } from "react";

export function webglAvailable() {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode; onError?: (e: Error) => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("3D renderer failed:", error);
    this.props.onError?.(error);
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}

/**
 * Canvas wrapper that never takes the app down: if WebGL is missing, the
 * context is lost, or anything inside the scene throws, the fallback renders.
 */
export function SafeCanvas({ fallback, onError, ...props }: CanvasProps & { fallback: ReactNode; onError?: (e: Error) => void }) {
  const [supported] = useState(() => webglAvailable());
  const [lost, setLost] = useState(false);
  if (!supported || lost) return <>{fallback}</>;
  return (
    <Boundary fallback={fallback} onError={onError}>
      <Canvas
        {...props}
        onCreated={(state) => {
          state.gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setLost(true);
          });
          props.onCreated?.(state);
        }}
      />
    </Boundary>
  );
}
