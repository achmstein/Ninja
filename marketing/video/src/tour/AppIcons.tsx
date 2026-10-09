// The apps' own icons, as their stores and home screens show them: the N mark on each
// app's colour (admin_web/public/apps/*.svg, the Flutter apps' ninja_icon.png). The guest
// app wears the café's brand, so here it is Mellow's icon.
import { loadFont as loadPacifico } from "@remotion/google-fonts/Pacifico";
import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { clamp, inter, land } from "../theme";
import { plexArabic, useLang } from "./lang";
import { Sfx } from "./sfx";

const { fontFamily: pacifico } = loadPacifico("normal", { weights: ["400"], subsets: ["latin"] });

const N =
  "M49.03 14.8Q49.03 14.8 49.03 15.77Q49.03 16.74 48.99 18.44Q48.96 20.13 48.88 22.42Q48.81 24.72 48.68 27.38Q48.55 30.05 48.35 32.93Q48.16 35.82 47.85 38.69Q47.55 41.56 47.16 44.29Q46.78 47.02 46.24 49.35L41.61 49.54Q40.4 47.72 38.9 45.42Q37.39 43.12 35.76 40.58Q34.12 38.05 32.44 35.42Q30.75 32.79 29.2 30.32Q25.54 24.52 21.66 18.36Q21.54 24.96 21.49 30.92Q21.47 33.47 21.47 36.11Q21.47 38.75 21.48 41.2Q21.49 43.65 21.55 45.76Q21.61 47.87 21.71 49.35L16.55 50Q16.16 47.96 15.89 45.37Q15.62 42.78 15.44 39.92Q15.26 37.05 15.16 34.08Q15.07 31.12 15.02 28.3Q14.92 21.73 15.02 14.75L24.69 14L42.02 44.08Q42.29 40.93 42.34 37.31Q42.39 33.68 42.25 29.83Q42.12 25.98 41.81 22.02Q41.49 18.07 41.03 14.24Z";

type App = { label: string; labelAr: string; bg: string; ink: string; mark: "n" | "mellow" };
export const APPS: App[] = [
  { label: "Guest app", labelAr: "أبلكيشن العميل", bg: "#c2410c", ink: "#fff", mark: "mellow" },
  { label: "Till", labelAr: "الكاشير", bg: "#18181B", ink: "#fafafa", mark: "n" },
  { label: "Kitchen", labelAr: "المطبخ", bg: "#EA580C", ink: "#fafafa", mark: "n" },
  { label: "Rider", labelAr: "الطيار", bg: "#0D9488", ink: "#fafafa", mark: "n" },
  { label: "Dashboard", labelAr: "لوحة التحكم", bg: "#ffffff", ink: "#18181B", mark: "n" },
];

export const AppIcon: React.FC<{ app: App; size: number }> = ({ app, size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.225,
      backgroundColor: app.bg,
      overflow: "hidden",
      display: "grid",
      placeItems: "center",
      boxShadow:
        app.bg === "#ffffff"
          ? "0 0 0 1px rgba(2,6,24,.08), 0 18px 36px -16px rgba(2,6,24,.35)"
          : "0 18px 36px -16px rgba(2,6,24,.45), inset 0 1px 0 rgba(255,255,255,.12)",
    }}
  >
    {app.mark === "n" ? (
      <svg width={size} height={size} viewBox="0 0 64 64">
        <g transform="translate(3.2 3.2) scale(0.9)">
          <path d={N} fill={app.ink} />
        </g>
      </svg>
    ) : (
      <span style={{ fontFamily: pacifico, fontSize: size * 0.56, color: app.ink, lineHeight: 1, marginTop: -size * 0.08 }}>M</span>
    )}
  </div>
);

// A row of the icons, each popping in on its own beat (12 frames), with its name under it.
export const AppIconRow: React.FC<{ at: number; size?: number; gap?: number; style?: React.CSSProperties; dark?: boolean }> = ({
  at,
  size = 104,
  gap = 44,
  style,
  dark,
}) => {
  const frame = useCurrentFrame();
  const ar = useLang() === "ar";
  return (
    <div style={{ display: "flex", gap, direction: ar ? "rtl" : "ltr", ...style }}>
      {APPS.map((app, i) => {
        const t = at + i * 6;
        return (
          <div
            key={app.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              opacity: interpolate(frame, [t, t + 5], [0, 1], clamp),
              scale: `${interpolate(frame, [t, t + 12], [0.5, 1], { ...clamp, easing: land })}`,
              translate: `0px ${interpolate(frame, [t, t + 12], [24, 0], { ...clamp, easing: land })}px`,
            }}
          >
            <Sfx name="pop" at={t} volume={1.6} />
            <AppIcon app={app} size={size} />
            <span
              style={{
                fontFamily: ar ? plexArabic : inter,
                fontSize: size * 0.2,
                fontWeight: 600,
                color: dark ? "rgba(255,255,255,0.8)" : "#57534e",
                whiteSpace: "nowrap",
              }}
            >
              {ar ? app.labelAr : app.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
