import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, type InteractivitySchema } from "remotion";
import { clamp, land } from "../theme";
import { Copy, Stage, type Look } from "./Frame";

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
}> = ({ look, n, eyebrow, title, mark, line, chips, style, copyWidth, children }) => (
  <AbsoluteFill style={style}>
    <Stage look={look}>
      {children}
      <Copy
        n={n}
        eyebrow={eyebrow}
        title={title}
        mark={mark}
        line={line}
        chips={chips}
        dark={look === "dark"}
        width={copyWidth}
      />
    </Stage>
  </AbsoluteFill>
);

// Devices come in from the right on a spring, turned a little toward the copy (a 3D
// product shot), and sway gently while on screen.
export const useEnter = (at = 4, from = 260, tilt = 9) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const turn = interpolate(frame, [at, at + 1.2 * fps], [tilt * 2.4, tilt], { ...clamp, easing: land });
  return {
    opacity: interpolate(frame, [at, at + 0.3 * fps], [0, 1], clamp),
    translate: `${interpolate(frame, [at, at + 0.9 * fps], [from, 0], { ...clamp, easing: land })}px ${Math.sin(frame / 45) * 6}px`,
    transform: `perspective(2600px) rotateY(${turn + Math.sin(frame / 70) * 1.5}deg) rotateX(${Math.sin(frame / 90) * 1}deg)`,
  } as const;
};

// A frosted card floating over the stage (the liquid-glass look).
export const Glass: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      position: "absolute",
      borderRadius: 32,
      backgroundColor: "rgba(255,255,255,0.62)",
      border: "1.5px solid rgba(255,255,255,0.9)",
      backdropFilter: "blur(24px)",
      boxShadow: "0 30px 80px -30px rgba(15,23,42,0.35)",
      ...style,
    }}
  >
    {children}
  </div>
);
