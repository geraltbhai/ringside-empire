"use client";
/** 2D top-down fallback renderer for the live match (used when WebGL is unavailable). */
import { type MutableRefObject, useEffect, useRef } from "react";
import { RING_LIMIT, type MatchState } from "@/engine/live-match";

export function TopDownView({ state, colors }: { state: MutableRefObject<MatchState>; colors: [string, string] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      if (c && ctx) {
        const w = (c.width = c.clientWidth * devicePixelRatio);
        const h = (c.height = c.clientHeight * devicePixelRatio);
        const scale = Math.min(w, h) / (RING_LIMIT * 2 + 1.6);
        const toX = (x: number) => w / 2 + x * scale;
        const toY = (z: number) => h / 2 + z * scale;
        ctx.fillStyle = "#07080c";
        ctx.fillRect(0, 0, w, h);
        // mat and ropes
        const half = (RING_LIMIT + 0.35) * scale;
        ctx.fillStyle = "#d9dde6";
        ctx.fillRect(w / 2 - half, h / 2 - half, half * 2, half * 2);
        ["#e11d48", "#f8fafc", "#2f6bff"].forEach((col, i) => {
          ctx.strokeStyle = col;
          ctx.lineWidth = 3 * devicePixelRatio;
          const o = half + (i + 1) * 4 * devicePixelRatio;
          ctx.strokeRect(w / 2 - o, h / 2 - o, o * 2, o * 2);
        });
        const s = state.current;
        // referee
        ctx.fillStyle = "#1f232b";
        ctx.beginPath();
        ctx.arc(toX(s.referee.x), toY(s.referee.z), 0.18 * scale, 0, Math.PI * 2);
        ctx.fill();
        s.fighters.forEach((f, i) => {
          const x = toX(f.x);
          const y = toY(f.z);
          const down = ["down", "getup", "pinned", "submitted", "defeat"].includes(f.state);
          ctx.fillStyle = colors[i];
          ctx.beginPath();
          if (down) ctx.ellipse(x, y, 0.45 * scale, 0.22 * scale, f.facing, 0, Math.PI * 2);
          else ctx.arc(x, y, 0.3 * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#0b0d14";
          ctx.lineWidth = 2 * devicePixelRatio;
          ctx.stroke();
          // facing marker
          ctx.strokeStyle = "#ffffff";
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.sin(f.facing) * 0.42 * scale, y + Math.cos(f.facing) * 0.42 * scale);
          ctx.stroke();
          if (f.state === "attack") {
            ctx.strokeStyle = "#ffd27a";
            ctx.beginPath();
            ctx.arc(x, y, 0.5 * scale, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = "#0b0d14";
          ctx.font = `${12 * devicePixelRatio}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(f.name, x, y - 0.42 * scale);
        });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [state, colors]);
  return <canvas ref={canvas} className="h-full w-full" aria-label="Top-down view of the ring" />;
}
