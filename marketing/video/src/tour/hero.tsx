// The fast cut's building blocks: a chapter can play in "hero" mode (no copy column,
// one short title, a camera that pushes in on the action), and full-screen word beats.
import { createContext, useContext } from "react";
import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C, clamp, inter, land } from "../theme";
import { Stage } from "./Frame";
import { plexArabic, useLang, useUnmirror } from "./lang";
import { Sfx } from "./sfx";

// A camera keyframe in the chapter's own frames: zoom `s` on the stage point (x, y).
export type Cam = { f: number; s: number; x: number; y: number };
export type Hero = { title: string; titleAr: string; cam: Cam[]; rate?: number; look?: "neon" };

// The music's grid inside a chapter: a beat is 12 frames, a bar 48, and the cut into the
// chapter falls 7 frames after its start. `beat(k, rate)` is the chapter's own frame of
// beat k when it plays at `rate`; author camera keyframes on these.
export const beat = (k: number, rate = 1) => Math.round((7 + 12 * k) * rate);
export const HeroContext = createContext<Hero | null>(null);
export const useHero = () => useContext(HeroContext);

// Where the camera puts its focus on screen: right of centre, clear of the title.
const AIM = { x: 1250, y: 540 };
const ease = Easing.bezier(0.65, 0, 0.35, 1);

export const useCamera = (cam: Cam[], mirrored: boolean, rate = 1): { style: React.CSSProperties; zoom: number } => {
  const frame = useCurrentFrame();
  // A small punch on every bar's downbeat, decaying over a few frames.
  const local = frame / rate - 7;
  const sinceBar = ((local % 48) + 48) % 48;
  const punch = local >= 0 ? 1 + 0.03 * Math.exp(-sinceBar / 3.5) : 1;
  const fs = cam.map((k) => k.f);
  const at = (key: "s" | "x" | "y") =>
    cam.length === 1 ? cam[0][key] : interpolate(frame, fs, cam.map((k) => k[key]), { ...clamp, easing: ease });
  const s = at("s") * punch;
  const x = mirrored ? 1920 - at("x") : at("x");
  const aimX = mirrored ? 1920 - AIM.x : AIM.x;
  return {
    zoom: at("s"),
    style: {
      transformOrigin: "0 0",
      transform: `translate(${aimX}px, ${AIM.y}px) scale(${s}) translate(${-x}px, ${-at("y")}px)`,
    },
  };
};

// The hero title: a few words, big, rising in on the chapter's first beat.
export const HeroTitle: React.FC<{ text: string; dark?: boolean }> = ({ text, dark }) => {
  const frame = useCurrentFrame();
  const ar = useLang() === "ar";
  const words = text.split(" ");
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [ar ? "right" : "left"]: 110,
        width: 640,
        display: "flex",
        flexWrap: "wrap",
        alignContent: "center",
        columnGap: "0.24em",
        direction: ar ? "rtl" : "ltr",
        fontFamily: ar ? plexArabic : inter,
        fontSize: text.length > 24 ? (ar ? 84 : 92) : ar ? 104 : 116,
        fontWeight: ar ? 700 : 800,
        letterSpacing: ar ? 0 : "-0.045em",
        lineHeight: ar ? 1.25 : 1,
        color: dark ? "#fff" : C.ink,
        textShadow: dark ? "0 2px 30px rgba(37,99,235,0.35)" : undefined,
        zIndex: 30,
      }}
    >
      {words.map((w, i) => (
        <span key={i} style={{ overflow: "hidden", paddingBottom: "0.08em" }}>
          <span
            style={{
              display: "inline-block",
              translate: `0px ${interpolate(frame, [6 + i * 3, 20 + i * 3], [110, 0], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) })}%`,
            }}
          >
            {w}
          </span>
        </span>
      ))}
    </div>
  );
};

// Full-screen words, one per beat (12 frames), each slamming in.
export const WordBeat: React.FC<{ words: string[]; wordsAr: string[]; style?: React.CSSProperties }> = ({
  words: en,
  wordsAr,
  style,
}) => {
  const frame = useCurrentFrame();
  const ar = useLang() === "ar";
  const words = ar ? wordsAr : en;
  const BEAT = 12;
  const idx = Math.min(words.length - 1, Math.max(0, Math.floor((frame - 7) / BEAT)));
  const since = frame - 7 - idx * BEAT;
  return (
    <AbsoluteFill style={style}>
      <Stage look="dark">
        {words.map((_, i) => (
          <Sfx key={i} name={i === words.length - 1 ? "impact" : "swish"} at={7 + i * BEAT} volume={i === words.length - 1 ? 0.6 : 1} />
        ))}
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div
            style={{
              fontFamily: ar ? plexArabic : inter,
              fontSize: ar ? 230 : 260,
              fontWeight: ar ? 700 : 800,
              letterSpacing: ar ? 0 : "-0.055em",
              color: idx === words.length - 1 ? C.amber : "#fff",
              direction: ar ? "rtl" : "ltr",
              scale: `${interpolate(since, [0, 4, 10], [1.25, 0.98, 1], { ...clamp, easing: land }) * (idx === words.length - 1 ? interpolate(frame, [7 + words.length * BEAT + 2, 7 + words.length * BEAT + 14], [1, 14], { ...clamp, easing: Easing.bezier(0.7, 0, 0.84, 0) }) : 1)}`,
              opacity: interpolate(since, [0, 2], [0, 1], clamp),
            }}
          >
            {words[idx]}
          </div>
        </AbsoluteFill>
      </Stage>
    </AbsoluteFill>
  );
};

// The key piece of a screen, lifted out of the device: rises in front of it on a beat,
// bigger, with a deep shadow and a pop. Lives inside the devices layer, so it moves with
// the camera; it flips back to read the right way round in the Arabic mirror.
export const PopOut: React.FC<{
  at: number;
  until?: number;
  x: number;
  y: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ at, until = 99999, x, y, children, style }) => {
  const frame = useCurrentFrame();
  const unmirror = useUnmirror();
  const hero = useHero();
  if (!hero) return null;
  if (frame < at - 1 || frame > until + 10) return <Sfx name="pop" at={at} volume={2.2} />;
  const k = interpolate(frame, [at, at + 10], [0, 1], { ...clamp, easing: land });
  const out = interpolate(frame, [until, until + 8], [1, 0], clamp);
  return (
    <>
      <Sfx name="pop" at={at} volume={2.2} />
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          zIndex: 80,
          opacity: Math.min(k * 3, 1) * out,
          scale: `${0.6 + 0.4 * k}`,
          translate: `0px ${(1 - k) * 40}px`,
          filter: "drop-shadow(0 40px 60px rgba(2,6,23,0.35)) drop-shadow(0 8px 16px rgba(2,6,23,0.18))",
          ...style,
          ...unmirror,
        }}
      >
        {children}
      </div>
    </>
  );
};
