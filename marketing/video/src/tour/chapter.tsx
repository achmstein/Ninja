import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, type InteractivitySchema } from "remotion";
import { NMark, Wordmark } from "../parts";
import { C, clamp, glide } from "../theme";
import { Copy, Stage, type Look } from "./Frame";
import { HeroTitle, useCamera, useHero } from "./hero";
import { AR_CHAPTERS, EN_CHAPTERS, DeviceContext, MirrorContext, plexArabic, useLang, useUnmirror } from "./lang";

export type ChapterProps = {
  readonly title: string;
  readonly line: string;
  readonly style?: React.CSSProperties;
};

export const copySchema = (title: string, line: string) =>
  ({
    title: { type: "text-content", default: title, description: "Title" },
    line: { type: "text-content", default: line, description: "One line for the owner" },
  }) as const satisfies InteractivitySchema;

// Backdrop + the copy column on the left + whatever the chapter shows on the right.
export const Chapter: React.FC<{
  look: Look;
  n: string;
  eyebrow: string;
  title: string;
  mark?: string;
  line: string;
  chips?: string[];
  style?: React.CSSProperties;
  copyWidth?: number;
  children: React.ReactNode;
}> = ({ look, n, eyebrow, title, mark, line, style, copyWidth, children }) => {
  // In the Arabic tour every chapter's words come from lang.ts.
  const lang = useLang();
  const ar = lang === "ar" ? AR_CHAPTERS[n] : EN_CHAPTERS[n];
  const hero = useHero();
  const camera = useCamera(hero?.cam ?? [{ f: 0, s: 1, x: 1250, y: 540 }], lang === "ar", hero?.rate ?? 1);
  const devices =
    lang === "ar" ? (
      <MirrorContext.Provider value>
        <AbsoluteFill style={{ transform: "scaleX(-1)" }}>{children}</AbsoluteFill>
      </MirrorContext.Provider>
    ) : (
      children
    );
  if (hero) {
    // The fast cut: one short title, the camera on the action, no copy column.
    return (
      <AbsoluteFill style={style}>
        <Stage look={look}>
          <Badge dark={look === "dark"} rtl={lang === "ar"} />
          <AbsoluteFill style={camera}>{devices}</AbsoluteFill>
          <HeroTitle text={lang === "ar" ? hero.titleAr : hero.title} />
        </Stage>
      </AbsoluteFill>
    );
  }
  return (
  <AbsoluteFill style={style}>
    <Stage look={look}>
      <Badge dark={look === "dark"} rtl={lang === "ar"} />
      {devices}
      <Copy
        n={n}
        eyebrow={ar?.eyebrow ?? eyebrow}
        title={ar?.title ?? title}
        mark={ar?.mark ?? mark}
        line={ar?.line ?? line}
        chips={[]}
        dark={look === "dark"}
        width={copyWidth}
        rtl={lang === "ar"}
      />
    </Stage>
  </AbsoluteFill>
  );
};

// Ninja's corner badge on every chapter, as a channel keeps its logo on screen.
const Badge: React.FC<{ dark?: boolean; rtl?: boolean }> = ({ dark, rtl }) => (
  <div style={{ position: "absolute", top: 64, [rtl ? "right" : "left"]: 130, display: "flex", alignItems: "center", gap: 14, opacity: 0.9 }}>
    <NMark size={44} />
    <Wordmark size={46} color={dark ? "#fff" : C.ink} />
  </div>
);

// Devices come in from the right on an ease with no overshoot, and then hold still.
// In the fast cut the camera does the moving, so they are simply there.
export const useEnter = (at = 4, from = 260) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hero = useHero();
  if (hero) return {} as const;
  return {
    opacity: interpolate(frame, [at, at + 0.3 * fps], [0, 1], clamp),
    translate: `${interpolate(frame, [at, at + 0.8 * fps], [from, 0], { ...clamp, easing: glide })}px 0px`,
  } as const;
};

// Anything inside the chapter's devices layer that must read the right way round in Arabic.
export const Unmirror: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ ...style, ...useUnmirror() }}>{children}</div>
);

// A frosted card floating over the stage (the liquid-glass look).
export const Glass: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  const unmirror = useUnmirror();
  const ar = useLang() === "ar";
  return (
    <div
      style={{
        position: "absolute",
        borderRadius: 32,
        backgroundColor: "rgba(255,255,255,0.62)",
        border: "1.5px solid rgba(255,255,255,0.9)",
        backdropFilter: "blur(24px)",
        boxShadow: "0 30px 80px -30px rgba(15,23,42,0.35)",
        ...style,
        ...unmirror,
        ...(ar ? { direction: "rtl", fontFamily: plexArabic } : {}),
      }}
    >
      <DeviceContext.Provider value={ar ? Number(style?.width ?? 0) : 0}>{children}</DeviceContext.Provider>
    </div>
  );
};
