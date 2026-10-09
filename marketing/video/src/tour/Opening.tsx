// The opening: the mark settles, the wordmark appears, one line. Nothing else.
import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { NMark, Wordmark } from "../parts";
import { C, clamp, inter } from "../theme";
import { AppIconRow } from "./AppIcons";
import { plexArabic, useLang } from "./lang";

const ease = Easing.bezier(0.22, 1, 0.36, 1);

export const Opening: React.FC<{ line: string; lineAr: string; exitAt?: number }> = ({ line, lineAr, exitAt = 9999 }) => {
  const frame = useCurrentFrame();
  // At the end the camera dives into the mark: it grows past the frame and its dark
  // fills the screen, and the next scene opens out of it.
  const dive = interpolate(frame, [exitAt, exitAt + 14], [0, 1], { ...clamp, easing: Easing.bezier(0.7, 0, 0.84, 0) });
  const rest = 1 - interpolate(frame, [exitAt, exitAt + 6], [0, 1], clamp);
  const ar = useLang() === "ar";
  const text = ar ? lineAr : line;
  return (
    <AbsoluteFill style={{ backgroundColor: "#fafaf9", justifyContent: "center", alignItems: "center", paddingBottom: 170 }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 60% 50% at 50% 45%, #ffffff 0%, #fafaf9 70%, #f0efed 100%)" }} />
      <div
        style={{
          opacity: interpolate(frame, [8, 22], [0, 1], clamp),
          scale: `${interpolate(frame, [8, 40], [0.9, 1], { ...clamp, easing: ease }) * (1 + dive * 34)}`,
          zIndex: 5,
          filter: `blur(${interpolate(frame, [8, 24], [8, 0], clamp)}px)`,
        }}
      >
        <NMark size={150} />
      </div>
      <Wordmark
        size={120}
        color={C.ink}
        style={{
          marginTop: 26,
          visibility: rest > 0 ? "visible" : "hidden",
          opacity: interpolate(frame, [26, 40], [0, 1], clamp),
          translate: `0px ${interpolate(frame, [26, 48], [24, 0], { ...clamp, easing: ease })}px`,
        }}
      />
      <div style={{ overflow: "hidden", marginTop: 34, paddingBottom: "0.1em", opacity: rest }}>
        <div
          style={{
            fontFamily: ar ? plexArabic : inter,
            direction: ar ? "rtl" : "ltr",
            fontSize: ar ? 54 : 56,
            fontWeight: 600,
            letterSpacing: ar ? 0 : "-0.025em",
            color: "#57534e",
            translate: `0px ${interpolate(frame, [52, 72], [110, 0], { ...clamp, easing: ease })}%`,
          }}
        >
          {text}
        </div>
      </div>
      {/* The apps, one per beat */}
      <AppIconRow at={80} size={92} gap={40} style={{ position: "absolute", top: 800, opacity: rest }} />
    </AbsoluteFill>
  );
};
