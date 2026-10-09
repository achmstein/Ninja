// The opening: the mark settles, the wordmark appears, one line. Nothing else.
import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { NMark, Wordmark } from "../parts";
import { C, clamp, inter } from "../theme";
import { plexArabic, useLang } from "./lang";

const ease = Easing.bezier(0.22, 1, 0.36, 1);

export const Opening: React.FC<{ line: string; lineAr: string }> = ({ line, lineAr }) => {
  const frame = useCurrentFrame();
  const ar = useLang() === "ar";
  const text = ar ? lineAr : line;
  return (
    <AbsoluteFill style={{ backgroundColor: "#fafaf9", justifyContent: "center", alignItems: "center" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 60% 50% at 50% 45%, #ffffff 0%, #fafaf9 70%, #f0efed 100%)" }} />
      <div
        style={{
          opacity: interpolate(frame, [8, 22], [0, 1], clamp),
          scale: `${interpolate(frame, [8, 40], [0.9, 1], { ...clamp, easing: ease })}`,
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
          opacity: interpolate(frame, [26, 40], [0, 1], clamp),
          translate: `0px ${interpolate(frame, [26, 48], [24, 0], { ...clamp, easing: ease })}px`,
        }}
      />
      <div style={{ overflow: "hidden", marginTop: 34, paddingBottom: "0.1em" }}>
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
    </AbsoluteFill>
  );
};
