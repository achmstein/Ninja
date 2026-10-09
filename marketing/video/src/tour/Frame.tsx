import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, clamp, glide, inter, land } from "../theme";
import { plexArabic } from "./lang";

// The tour's looks, one per kind of chapter (from the shortlist):
// light = Apple-style launch, glass = liquid glass, dark = the till/kitchen reel.
export type Look = "light" | "glass" | "dark";

export const Stage: React.FC<{ look: Look; children: React.ReactNode }> = ({ look, children }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 50) * 40;
  const dark = look === "dark";
  return (
    <AbsoluteFill style={{ backgroundColor: dark ? C.night : look === "glass" ? "#eef0f6" : C.page, overflow: "hidden" }}>
      {look === "glass" ? (
        <>
          <Blob color="99 102 241" alpha={0.45} size={1100} left={1000 + drift} top={-300} />
          <Blob color="245 158 11" alpha={0.4} size={900} left={1400} top={400 - drift} />
          <Blob color="236 72 153" alpha={0.3} size={900} left={700 - drift} top={500} />
          <Blob color="20 184 166" alpha={0.35} size={800} left={-200} top={-200 + drift} />
        </>
      ) : (
        <>
          <Blob color="99 102 241" alpha={dark ? 0.3 : 0.14} size={1500} left={-500} top={-800 + drift} />
          <Blob color="245 158 11" alpha={dark ? 0.16 : 0.12} size={1300} left={1200} top={200 - drift} />
          <Blob color="20 184 166" alpha={dark ? 0.18 : 0.1} size={1300} left={400 + drift} top={500} />
        </>
      )}
      {dark ? (
        // A fine grid, the "precise" reel look.
        <AbsoluteFill
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      ) : null}
      {children}
    </AbsoluteFill>
  );
};

const Blob: React.FC<{ color: string; alpha: number; size: number; left: number; top: number }> = ({
  color,
  alpha,
  size,
  left,
  top,
}) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      width: size,
      height: size,
      background: `radial-gradient(circle, rgb(${color} / ${alpha}) 0%, transparent 62%)`,
    }}
  />
);

// Left column: chapter number, who it is for, the title (word by word), one line, then chips.
export const Copy: React.FC<{
  n: string;
  eyebrow: string;
  title: string;
  mark?: string;
  line: string;
  chips?: string[];
  dark?: boolean;
  at?: number;
  width?: number;
  rtl?: boolean;
}> = ({ n, eyebrow, title, mark, line, chips = [], dark, at = 0, width = 720, rtl }) => {
  const frame = useCurrentFrame();
  const words = title.split(" ");
  const strip = (s: string) => s.replace(/[.,!?]/g, "");
  const marks = mark ? strip(mark).split(" ") : [];
  const titleEnd = at + 8 + words.length * 3;
  const ink = dark ? "#fff" : C.ink;
  const soft = dark ? "rgba(255,255,255,0.68)" : C.muted;
  return (
    <div
      style={{
        position: "absolute",
        left: 130,
        top: 0,
        bottom: 0,
        width,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        fontFamily: rtl ? plexArabic : inter,
        direction: rtl ? "rtl" : "ltr",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          fontSize: 28,
          fontWeight: 600,
          color: soft,
          opacity: interpolate(frame, [at, at + 8], [0, 1], clamp),
          translate: interpolate(frame, [at, at + 14], [rtl ? "30px 0px" : "-30px 0px", "0px 0px"], { ...clamp, easing: glide }),
        }}
      >
        <span
          style={{
            display: "inline-grid",
            placeItems: "center",
            height: 46,
            minWidth: 46,
            padding: "0 14px",
            borderRadius: 999,
            backgroundColor: dark ? "#fff" : C.ink,
            color: dark ? C.ink : "#fff",
            fontSize: 21,
            fontWeight: 800,
          }}
        >
          {n}
        </span>
        {eyebrow}
      </div>
      <div
        style={{
          marginTop: 26,
          display: "flex",
          flexWrap: "wrap",
          columnGap: "0.25em",
          fontSize: rtl ? 84 : 92,
          fontWeight: rtl ? 700 : 800,
          letterSpacing: rtl ? 0 : "-0.04em",
          lineHeight: rtl ? 1.3 : 1.02,
          color: ink,
        }}
      >
        {words.map((w, i) => {
          const s = at + 6 + i * 3;
          const isMark = marks.includes(strip(w));
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: interpolate(frame, [s, s + 6], [0, 1], clamp),
                translate: interpolate(frame, [s, s + 14], ["0px 56px", "0px 0px"], { ...clamp, easing: glide }),
                backgroundImage: isMark ? `linear-gradient(${C.highlight}, ${C.highlight})` : undefined,
                backgroundRepeat: "no-repeat",
                backgroundPosition: rtl ? "100% 88%" : "0 88%",
                backgroundSize: isMark
                  ? `${interpolate(frame, [titleEnd, titleEnd + 12], [0, 100], { ...clamp, easing: glide })}% 0.3em`
                  : undefined,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 30,
          fontSize: rtl ? 36 : 38,
          fontWeight: 500,
          lineHeight: rtl ? 1.6 : 1.35,
          color: soft,
          opacity: interpolate(frame, [titleEnd, titleEnd + 10], [0, 1], clamp),
          translate: interpolate(frame, [titleEnd, titleEnd + 16], ["0px 24px", "0px 0px"], { ...clamp, easing: glide }),
        }}
      >
        {line}
      </div>
      {chips.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 40 }}>
          {chips.map((c, i) => {
            const s = titleEnd + 14 + i * 5;
            return (
              <div
                key={c}
                style={{
                  padding: "14px 24px",
                  borderRadius: 999,
                  fontSize: 26,
                  fontWeight: 700,
                  color: ink,
                  backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.75)",
                  border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #fff",
                  boxShadow: dark ? undefined : "0 10px 30px -12px rgba(15,23,42,0.25)",
                  opacity: interpolate(frame, [s, s + 6], [0, 1], clamp),
                  scale: interpolate(frame, [s, s + 14], [0.6, 1], { ...clamp, easing: land }),
                }}
              >
                {c}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

// Places a 600 × 1240 phone (from parts.tsx) on the landscape stage at a given height.
export const phoneAt = (left: number, height = 940, top?: number): React.CSSProperties => {
  const k = height / 1240;
  return {
    left,
    top: top ?? (1080 - height) / 2,
    scale: `${k}`,
    transformOrigin: "0 0",
  } as React.CSSProperties;
};
