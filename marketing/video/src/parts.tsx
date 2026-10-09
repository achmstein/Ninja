import type React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, clamp, glide, inter, land, lift, surfer } from "./theme";

// The soft page every light scene sits on: three slow colour glows.
export const Backdrop: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 40) * 30;
  const glow = (color: string, alpha: number) =>
    `radial-gradient(circle, ${color.replace(")", ` / ${alpha})`)} 0%, transparent 62%)`;
  return (
    <AbsoluteFill style={{ backgroundColor: dark ? C.night : C.page, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: 1400,
          height: 1400,
          left: -500,
          top: -600 + drift,
          background: glow("rgb(99 102 241)", dark ? 0.28 : 0.16),
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1300,
          height: 1300,
          right: -600,
          top: 600 - drift,
          background: glow("rgb(245 158 11)", dark ? 0.18 : 0.13),
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1400,
          height: 1400,
          left: -200 + drift,
          bottom: -900,
          background: glow("rgb(20 184 166)", dark ? 0.2 : 0.12),
        }}
      />
    </AbsoluteFill>
  );
};

// Kinetic headline: each word rises in on its own beat; `mark` gets the highlighter.
export const Headline: React.FC<{
  text: string;
  mark?: string;
  at?: number;
  size?: number;
  color?: string;
  top?: number;
}> = ({ text, mark, at = 0, size = 92, color = C.ink, top = 190 }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 90,
        right: 90,
        fontFamily: inter,
        fontSize: size,
        fontWeight: 800,
        letterSpacing: "-0.035em",
        lineHeight: 1.04,
        color,
        display: "flex",
        flexWrap: "wrap",
        columnGap: "0.26em",
      }}
    >
      {words.map((w, i) => {
        const start = at + i * 3;
        const isMark = mark !== undefined && mark.replace(/[.,!?]/g, "").split(" ").includes(w.replace(/[.,!?]/g, ""));
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: interpolate(frame, [start, start + 6], [0, 1], clamp),
              translate: interpolate(frame, [start, start + 14], ["0px 60px", "0px 0px"], {
                ...clamp,
                easing: glide,
              }),
              backgroundImage: isMark ? `linear-gradient(${C.highlight}, ${C.highlight})` : undefined,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "0 88%",
              backgroundSize: isMark
                ? `${interpolate(frame, [at + words.length * 3 + 6, at + words.length * 3 + 18], [0, 100], { ...clamp, easing: glide })}% 0.32em`
                : undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

// A small step label above the headline: "01  At the table".
export const Step: React.FC<{ n: string; label: string; at?: number; dark?: boolean }> = ({
  n,
  label,
  at = 0,
  dark,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        top: 110,
        left: 90,
        display: "flex",
        alignItems: "center",
        gap: 18,
        fontFamily: inter,
        fontSize: 34,
        fontWeight: 600,
        color: dark ? "rgba(255,255,255,0.7)" : C.muted,
        opacity: interpolate(frame, [at, at + 8], [0, 1], clamp),
      }}
    >
      <span
        style={{
          display: "inline-grid",
          placeItems: "center",
          height: 52,
          minWidth: 52,
          padding: "0 14px",
          borderRadius: 999,
          backgroundColor: dark ? "#fff" : C.ink,
          color: dark ? C.ink : "#fff",
          fontSize: 24,
          fontWeight: 800,
        }}
      >
        {n}
      </span>
      {label}
    </div>
  );
};

// Phone body; children are the screen (390 × 844 points at 2×-ish scale).
export const Phone: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  screen?: string;
  font?: string;
}> = ({ children, style, screen = "#fff", font = inter }) => (
  <div
    style={{
      position: "absolute",
      left: 540 - 300,
      top: 560,
      width: 600,
      height: 1240,
      padding: 16,
      borderRadius: 92,
      backgroundColor: "#0b0d12",
      boxShadow: `${lift}, inset 0 0 0 3px #262a33`,
      ...style,
    }}
  >
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: 76,
        overflow: "hidden",
        backgroundColor: screen,
        fontFamily: font,
      }}
    >
      {children}
      <div
        style={{
          position: "absolute",
          top: 22,
          left: "50%",
          width: 170,
          height: 48,
          marginLeft: -85,
          borderRadius: 999,
          backgroundColor: "#000",
        }}
      />
    </div>
  </div>
);

// Landscape tablet body for the till and the kitchen.
export const Tablet: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  screen?: string;
}> = ({ children, style, screen = "#fff" }) => (
  <div
    style={{
      position: "absolute",
      left: 40,
      top: 720,
      width: 1000,
      height: 680,
      padding: 18,
      borderRadius: 48,
      backgroundColor: "#0b0d12",
      boxShadow: `${lift}, inset 0 0 0 3px #262a33`,
      ...style,
    }}
  >
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: 32,
        overflow: "hidden",
        backgroundColor: screen,
        fontFamily: inter,
      }}
    >
      {children}
    </div>
  </div>
);

// A finger tap: a dot that presses in and leaves a ring.
export const Tap: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < -8 || t > 22) return null;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x - 34,
          top: y - 34,
          width: 68,
          height: 68,
          borderRadius: "50%",
          backgroundColor: "rgba(15,23,42,0.28)",
          border: "3px solid rgba(255,255,255,0.9)",
          opacity: interpolate(t, [-8, -2, 10, 22], [0, 1, 1, 0], clamp),
          scale: interpolate(t, [-2, 2, 6], [1, 0.82, 1], clamp),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x - 34,
          top: y - 34,
          width: 68,
          height: 68,
          borderRadius: "50%",
          border: "4px solid rgba(15,23,42,0.35)",
          opacity: interpolate(t, [0, 16], [0.9, 0], clamp),
          scale: interpolate(t, [0, 16], [1, 2.2], clamp),
        }}
      />
    </>
  );
};

// The N mark from the brand (same path as the app icon).
export const NMark: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={style}>
    <rect width="64" height="64" rx="14" fill="#18181b" />
    <path
      fill="#fafafa"
      d="M49.03 14.8Q49.03 14.8 49.03 15.77Q49.03 16.74 48.99 18.44Q48.96 20.13 48.88 22.42Q48.81 24.72 48.68 27.38Q48.55 30.05 48.35 32.93Q48.16 35.82 47.85 38.69Q47.55 41.56 47.16 44.29Q46.78 47.02 46.24 49.35L41.61 49.54Q40.4 47.72 38.9 45.42Q37.39 43.12 35.76 40.58Q34.12 38.05 32.44 35.42Q30.75 32.79 29.2 30.32Q25.54 24.52 21.66 18.36Q21.54 24.96 21.49 30.92Q21.47 33.47 21.47 36.11Q21.47 38.75 21.48 41.2Q21.49 43.65 21.55 45.76Q21.61 47.87 21.71 49.35L16.55 50Q16.16 47.96 15.89 45.37Q15.62 42.78 15.44 39.92Q15.26 37.05 15.16 34.08Q15.07 31.12 15.02 28.3Q14.92 21.73 15.02 14.75L24.69 14L42.02 44.08Q42.29 40.93 42.34 37.31Q42.39 33.68 42.25 29.83Q42.12 25.98 41.81 22.02Q41.49 18.07 41.03 14.24Z"
    />
  </svg>
);

export const Wordmark: React.FC<{ size: number; color?: string; style?: React.CSSProperties }> = ({
  size,
  color = C.ink,
  style,
}) => (
  <span style={{ fontFamily: surfer, fontSize: size, lineHeight: 1, color, ...style }}>ninja</span>
);

// Rises an element in on a spring from `at` (frames).
export const useRise = (at: number, distance = 120) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return {
    opacity: interpolate(frame, [at, at + 0.25 * fps], [0, 1], clamp),
    translate: interpolate(frame, [at, at + 0.8 * fps], [`0px ${distance}px`, "0px 0px"], {
      ...clamp,
      easing: land,
    }),
  } as const;
};
