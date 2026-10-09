import type React from "react";
import { AbsoluteFill, Interactive, interpolate, useCurrentFrame, type InteractivitySchema } from "remotion";
import { NMark, Wordmark } from "../parts";
import { C, clamp, glide, inter, land } from "../theme";
import { Stage } from "./Frame";

const APPS = [
  { label: "Menu", color: C.indigo, x: 260, y: 300, r: -8 },
  { label: "Till", color: C.amber, x: 1380, y: 250, r: 7 },
  { label: "Kitchen", color: C.teal, x: 180, y: 640, r: 5 },
  { label: "Delivery", color: "#ef4444", x: 1480, y: 600, r: -6 },
  { label: "Loyalty", color: "#ec4899", x: 560, y: 800, r: -4 },
  { label: "Stock", color: "#8b5cf6", x: 1120, y: 820, r: 6 },
  { label: "Payroll", color: "#0ea5e9", x: 640, y: 110, r: 4 },
  { label: "Reports", color: "#84cc16", x: 1080, y: 90, r: -5 },
];

type Props = {
  readonly question: string;
  readonly answer: string;
  readonly style?: React.CSSProperties;
};

const IntroInner: React.FC<Props> = ({ question, answer, style }) => {
  const frame = useCurrentFrame();
  const collapse = 92;
  const words = question.split(" ");

  return (
    <AbsoluteFill style={style}>
      <Stage look="dark">
        {/* The question, centre stage while the apps pile up */}
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            fontFamily: inter,
            opacity: interpolate(frame, [collapse - 6, collapse + 2], [1, 0], clamp),
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              columnGap: "0.25em",
              maxWidth: 1300,
              fontSize: 110,
              fontWeight: 800,
              letterSpacing: "-0.045em",
              lineHeight: 1.02,
              color: "#fff",
              textAlign: "center",
            }}
          >
            {words.map((w, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: interpolate(frame, [6 + i * 3, 12 + i * 3], [0, 1], clamp),
                  translate: interpolate(frame, [6 + i * 3, 20 + i * 3], ["0px 70px", "0px 0px"], {
                    ...clamp,
                    easing: glide,
                  }),
                  color: w.toLowerCase().startsWith("apps") ? C.amber : "#fff",
                }}
              >
                {w}
              </span>
            ))}
          </div>
        </AbsoluteFill>

        {APPS.map((a, i) => {
          const appear = 26 + i * 5;
          const wobble = Math.sin((frame + i * 11) / 8) * 8;
          const toCenter = interpolate(frame, [collapse, collapse + 16], [0, 1], { ...clamp, easing: glide });
          return (
            <div
              key={a.label}
              style={{
                position: "absolute",
                left: a.x,
                top: a.y,
                width: 260,
                height: 150,
                borderRadius: 34,
                backgroundColor: "rgba(30,41,59,0.92)",
                border: "1.5px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                gap: 20,
                padding: "0 28px",
                fontFamily: inter,
                color: "#fff",
                fontSize: 38,
                fontWeight: 700,
                opacity: interpolate(frame, [appear, appear + 6, collapse + 10, collapse + 16], [0, 0.95, 0.95, 0], clamp),
                translate: `${interpolate(toCenter, [0, 1], [0, 960 - 130 - a.x])}px ${interpolate(toCenter, [0, 1], [wobble, 470 - 75 - a.y])}px`,
                rotate: `${interpolate(toCenter, [0, 1], [a.r + wobble / 4, 0])}deg`,
                scale: interpolate(frame, [appear, appear + 14, collapse, collapse + 16], [0.4, 1, 1, 0.3], {
                  ...clamp,
                  easing: land,
                }),
              }}
            >
              <div style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: a.color, flexShrink: 0 }} />
              {a.label}
            </div>
          );
        })}

        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: inter }}>
          <div
            style={{
              marginTop: -60,
              scale: interpolate(frame, [collapse + 12, collapse + 36], [0, 1], { ...clamp, easing: land }),
              rotate: `${interpolate(frame, [collapse + 12, collapse + 36], [-30, 0], { ...clamp, easing: land })}deg`,
            }}
          >
            <NMark size={220} style={{ filter: "drop-shadow(0 40px 80px rgba(99,102,241,0.5))" }} />
          </div>
          <Wordmark
            size={120}
            color="#fff"
            style={{
              marginTop: 24,
              opacity: interpolate(frame, [collapse + 24, collapse + 32], [0, 1], clamp),
            }}
          />
          <div
            style={{
              marginTop: 34,
              fontSize: 64,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              color: "#fff",
              opacity: interpolate(frame, [collapse + 34, collapse + 42], [0, 1], clamp),
              translate: interpolate(frame, [collapse + 34, collapse + 50], ["0px 40px", "0px 0px"], {
                ...clamp,
                easing: glide,
              }),
            }}
          >
            {answer}
          </div>
        </AbsoluteFill>
      </Stage>
    </AbsoluteFill>
  );
};

const schema = {
  question: { type: "text-content", default: "How many apps did you open today?", description: "Opening question" },
  answer: { type: "text-content", default: "One app runs your whole café.", description: "Answer" },
} as const satisfies InteractivitySchema;

export const Intro = Interactive.withSchema({
  Component: IntroInner,
  componentName: "<Intro>",
  schema,
  wrapInSequence: true,
});
