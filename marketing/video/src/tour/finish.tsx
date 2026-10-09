// The finish laid over the whole film: animated grain, a soft vignette, and warm light
// leaks that sweep across chosen cuts. Sits above the picture, outside the motion blur.
import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp } from "../theme";

const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  // A new grain pattern every other frame, like film.
  const seed = Math.floor(frame / 2) % 97;
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity: 0.09, pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

const LightLeak: React.FC<{ at: number; mirrored: boolean }> = ({ at, mirrored }) => {
  const frame = useCurrentFrame();
  const t = (frame - at) / 22;
  if (t < 0 || t > 1) return null;
  const x = interpolate(t, [0, 1], mirrored ? [110, -30] : [-30, 110]);
  const a = interpolate(t, [0, 0.35, 1], [0, 0.85, 0], clamp);
  return (
    <AbsoluteFill
      style={{
        mixBlendMode: "screen",
        opacity: a,
        background: `radial-gradient(ellipse 38% 70% at ${x}% 45%, rgba(255,170,90,0.9) 0%, rgba(255,110,120,0.45) 40%, transparent 72%),
          radial-gradient(ellipse 22% 40% at ${x + 12}% 70%, rgba(255,230,170,0.7) 0%, transparent 70%)`,
        pointerEvents: "none",
      }}
    />
  );
};

export const FilmFinish: React.FC<{ leaks: number[]; mirrored?: boolean }> = ({ leaks, mirrored = false }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {leaks.map((f) => (
      <LightLeak key={f} at={f - 8} mirrored={mirrored} />
    ))}
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse 85% 80% at 50% 50%, transparent 55%, rgba(10,8,20,0.28) 100%)",
      }}
    />
    <Grain />
  </AbsoluteFill>
);
