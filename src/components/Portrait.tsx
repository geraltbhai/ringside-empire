"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { PORTRAIT_MANIFEST } from "@/data/assets";
import type { Wrestler } from "@/engine/types";
import { cn } from "@/lib/cn";
import { getCustomPortrait, peekCustomPortrait, subscribePortraits } from "@/lib/portraits";

const BRAND_BG: Record<Wrestler["brand"], [string, string]> = {
  mayhem: ["#4c0519", "#e11d48"],
  fury: ["#0b1a4a", "#2f6bff"],
  legends: ["#3b2a07", "#d9a520"],
  "free-agents": ["#1f232c", "#6b7280"],
};

function shade(hex: string, amount: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Original procedurally-drawn portrait built from the wrestler's appearance. */
export function ProceduralPortrait({ w, className }: { w: Wrestler; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const a = w.appearance;
  const [bg0, bg1] = BRAND_BG[w.brand];
  const bulk = a.bulk;
  const shoulder = 58 + bulk * 22 + (w.division === "women" ? -8 : 0);
  const neck = 14 + bulk * 7 + (w.division === "women" ? -3 : 0);
  const headW = 30 + bulk * 3 + (w.division === "women" ? -2 : 0);
  const skin = a.skinTone;
  const skinDark = shade(skin, -28);
  const heel = w.alignment === "heel";
  const rim = heel ? "#ff2d55" : w.alignment === "tweener" ? "#c084fc" : "#bfe1ff";
  const bareChest = a.outfit === "trunks" || a.outfit === "singlet";
  const browTilt = heel ? 5 : 0;

  const hair = (() => {
    const c = a.hairColor;
    switch (a.hairStyle) {
      case "bald":
        return null;
      case "buzz":
        return <path d={`M${100 - headW} 92 Q100 ${52} ${100 + headW} 92 Q${100 + headW - 4} 70 100 64 Q${100 - headW + 4} 70 ${100 - headW} 92Z`} fill={c} opacity={0.75} />;
      case "short":
        return <path d={`M${100 - headW - 2} 98 Q${100 - headW} 56 100 54 Q${100 + headW} 56 ${100 + headW + 2} 98 Q${100 + headW - 6} 74 100 72 Q${100 - headW + 6} 74 ${100 - headW - 2} 98Z`} fill={c} />;
      case "mohawk":
        return <path d={`M92 96 L96 40 L100 34 L104 40 L108 96Z`} fill={c} />;
      case "ponytail":
        return (
          <g fill={c}>
            <path d={`M${100 - headW - 2} 100 Q${100 - headW} 54 100 52 Q${100 + headW} 54 ${100 + headW + 2} 100 Q${100 + headW - 8} 72 100 70 Q${100 - headW + 8} 72 ${100 - headW - 2} 100Z`} />
            <path d={`M${100 + headW - 4} 70 Q${100 + headW + 22} 90 ${100 + headW + 10} 140 Q${100 + headW + 6} 100 ${100 + headW - 8} 84Z`} />
          </g>
        );
      case "long":
        return (
          <path
            d={`M${100 - headW - 4} 150 Q${100 - headW - 10} 54 100 50 Q${100 + headW + 10} 54 ${100 + headW + 4} 150 L${100 + headW - 6} 150 Q${100 + headW - 2} 90 ${100 + headW - 6} 80 Q100 70 ${100 - headW + 6} 80 Q${100 - headW + 2} 90 ${100 - headW + 6} 150Z`}
            fill={c}
          />
        );
    }
  })();

  const facialHair = (() => {
    if (a.mask) return null;
    const c = a.hairColor;
    switch (a.facialHair) {
      case "beard":
        return <path d={`M${100 - headW + 4} 108 Q${100 - headW + 6} 146 100 150 Q${100 + headW - 6} 146 ${100 + headW - 4} 108 Q${100 + headW - 10} 130 100 132 Q${100 - headW + 10} 130 ${100 - headW + 4} 108Z`} fill={c} />;
      case "goatee":
        return <path d="M92 128 Q100 146 108 128 Q100 134 92 128Z" fill={c} />;
      case "stubble":
        return <path d={`M${100 - headW + 6} 112 Q100 146 ${100 + headW - 6} 112 Q100 140 ${100 - headW + 6} 112Z`} fill={c} opacity={0.35} />;
      default:
        return null;
    }
  })();

  return (
    <svg viewBox="0 0 200 240" className={className} role="img" aria-label={`Illustrated portrait of ${w.ringName}`}>
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={bg1} stopOpacity={0.9} />
          <stop offset="0.55" stopColor={bg0} />
          <stop offset="1" stopColor="#05060a" />
        </linearGradient>
        <linearGradient id={`beam${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.35} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <radialGradient id={`skin${uid}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor={shade(skin, 18)} />
          <stop offset="1" stopColor={skinDark} />
        </radialGradient>
      </defs>
      <rect width="200" height="240" fill={`url(#bg${uid})`} />
      <polygon points="60,0 140,0 175,240 25,240" fill={`url(#beam${uid})`} opacity={0.5} />
      {/* torso */}
      <path
        d={`M${100 - shoulder} 240 Q${100 - shoulder} 176 ${100 - neck - 10} 166 L${100 + neck + 10} 166 Q${100 + shoulder} 176 ${100 + shoulder} 240Z`}
        fill={bareChest ? `url(#skin${uid})` : a.primaryColor}
      />
      {bareChest && a.outfit === "singlet" && (
        <g fill={a.primaryColor}>
          <path d={`M${100 - neck - 14} 168 L${100 - neck - 4} 168 L${100 - 10} 240 L${100 - 26} 240Z`} />
          <path d={`M${100 + neck + 14} 168 L${100 + neck + 4} 168 L${100 + 10} 240 L${100 + 26} 240Z`} />
        </g>
      )}
      {bareChest && <path d={`M${100 - 22} 200 Q100 212 ${100 + 22} 200`} stroke={skinDark} strokeWidth={2} fill="none" opacity={0.6} />}
      {!bareChest && <path d={`M${100 - shoulder + 12} 240 L${100 - 10} 176 L${100 + 10} 176 L${100 + shoulder - 12} 240`} stroke={a.secondaryColor} strokeWidth={4} fill="none" opacity={0.8} />}
      {/* neck */}
      <rect x={100 - neck} y={128} width={neck * 2} height={44} rx={8} fill={skinDark} />
      {/* head */}
      {a.hairStyle === "long" && hair}
      <ellipse cx="100" cy="102" rx={headW} ry={headW * 1.22} fill={`url(#skin${uid})`} />
      {a.mask && (
        <g>
          <ellipse cx="100" cy="100" rx={headW + 1} ry={headW * 1.24} fill={a.primaryColor} />
          <path d={`M100 ${100 - headW * 1.2} L100 ${100 + headW * 1.2}`} stroke={a.secondaryColor} strokeWidth={5} />
          <path d={`M78 92 Q88 82 96 94 Q86 104 78 92Z M122 92 Q112 82 104 94 Q114 104 122 92Z`} fill={a.secondaryColor} />
          <ellipse cx="100" cy="128" rx="9" ry="6" fill={skinDark} />
        </g>
      )}
      {a.hairStyle !== "long" && hair}
      {/* eyes & brows */}
      <g>
        <ellipse cx="88" cy="96" rx="4.2" ry={heel ? 2.2 : 3} fill="#0b0b0f" />
        <ellipse cx="112" cy="96" rx="4.2" ry={heel ? 2.2 : 3} fill="#0b0b0f" />
        <path d={`M80 ${87 - browTilt / 2} L95 ${87 + browTilt}`} stroke={a.mask ? a.secondaryColor : shade(a.hairColor, 10)} strokeWidth={3.5} strokeLinecap="round" />
        <path d={`M120 ${87 - browTilt / 2} L105 ${87 + browTilt}`} stroke={a.mask ? a.secondaryColor : shade(a.hairColor, 10)} strokeWidth={3.5} strokeLinecap="round" />
        {!a.mask && <path d="M100 100 L97 114 L103 114" stroke={skinDark} strokeWidth={2} fill="none" />}
        {!a.mask && <path d={heel ? "M92 124 Q100 120 108 124" : "M92 122 Q100 127 108 122"} stroke="#3a1f1a" strokeWidth={2.5} fill="none" strokeLinecap="round" />}
      </g>
      {facialHair}
      {/* rim light */}
      <ellipse cx="100" cy="102" rx={headW} ry={headW * 1.22} fill="none" stroke={rim} strokeWidth={2} opacity={0.55} strokeDasharray={`${headW * 2.2} 400`} strokeDashoffset={-headW * 2.6} />
    </svg>
  );
}

function useCustomPortrait(id: string) {
  const peek = useSyncExternalStore(subscribePortraits, () => peekCustomPortrait(id), () => undefined);
  const [, force] = useState(0);
  useEffect(() => {
    if (peek === undefined) getCustomPortrait(id).then(() => force((x) => x + 1));
  }, [id, peek]);
  return peek;
}

/** Portrait with fallback chain: uploaded image → manifest file → procedural art. */
export function Portrait({ w, className, rounded = "rounded-md" }: { w: Wrestler; className?: string; rounded?: string }) {
  const custom = useCustomPortrait(w.id);
  const manifest = PORTRAIT_MANIFEST[w.id] ?? (w.baseId ? PORTRAIT_MANIFEST[w.baseId] : undefined);
  const [failed, setFailed] = useState<string | null>(null);
  const src = custom || manifest;
  const showImage = src && failed !== src;
  return (
    <div className={cn("relative aspect-[5/6] overflow-hidden bg-canvas-2", rounded, className)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Portrait of ${w.ringName}`} className="h-full w-full object-cover" onError={() => setFailed(src)} />
      ) : (
        <ProceduralPortrait w={w} className="h-full w-full" />
      )}
      {w.injury && <span className="absolute bottom-1 left-1 rounded bg-bad px-1 text-[10px] font-bold text-white">INJ</span>}
    </div>
  );
}
