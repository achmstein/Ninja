import type React from "react";
import {
  AbsoluteFill,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  type InteractivitySchema,
} from "remotion";
import { Backdrop, Headline, NMark } from "../parts";
import { C, clamp, glide, inter, land } from "../theme";

const APPS = [
  { label: "Menu", color: C.indigo, x: 150, y: 820, r: -8 },
  { label: "POS", color: C.amber, x: 600, y: 760, r: 6 },
  { label: "Kitchen", color: C.teal, x: 110, y: 1180, r: 5 },
  { label: "Delivery", color: "#ef4444", x: 620, y: 1130, r: -7 },
  { label: "Loyalty", color: "#ec4899", x: 170, y: 1540, r: -4 },
  { label: "Reports", color: "#8b5cf6", x: 590, y: 1500, r: 8 },
];

type Props = {
  readonly problem: string;
  readonly answer: string;
  readonly style?: React.CSSProperties;
};

const HookInner: React.FC<Props> = ({ problem, answer, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const collapse = 1.7 * fps;

  return (
    <AbsoluteFill style={style}>
      <Backdrop dark />
      <AbsoluteFill style={{ opacity: interpolate(frame, [collapse - 4, collapse + 4], [1, 0], clamp) }}>
        <Headline text={problem} mark="six apps" color="#fff" top={250} size={100} />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: interpolate(frame, [collapse + 10, collapse + 16], [0, 1], clamp) }}>
        <Headline text={answer} mark="one" color="#fff" top={250} size={100} at={collapse + 10} />
      </AbsoluteFill>

      {APPS.map((a, i) => {
        const appear = 6 + i * 4;
        const wobble = Math.sin((frame + i * 13) / 7) * 10;
        const toCenter = interpolate(frame, [collapse, collapse + 14], [0, 1], { ...clamp, easing: glide });
        return (
          <div
            key={a.label}
            style={{
              position: "absolute",
              left: a.x,
              top: a.y,
              width: 320,
              height: 200,
              borderRadius: 40,
              backgroundColor: C.slate800,
              border: "2px solid rgba(255,255,255,0.08)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: 30,
              fontFamily: inter,
              color: "#fff",
              fontSize: 44,
              fontWeight: 700,
              opacity: interpolate(frame, [appear, appear + 6, collapse + 8, collapse + 14], [0, 1, 1, 0], clamp),
              translate: `${interpolate(toCenter, [0, 1], [0, 540 - 160 - a.x])}px ${interpolate(toCenter, [0, 1], [wobble, 1150 - 100 - a.y])}px`,
              rotate: `${interpolate(toCenter, [0, 1], [a.r + wobble / 5, 0])}deg`,
              scale: interpolate(frame, [appear, appear + 12, collapse, collapse + 14], [0.4, 1, 1, 0.3], {
                ...clamp,
                easing: land,
              }),
            }}
          >
            <div style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: a.color }} />
            {a.label}
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 540 - 150,
          top: 1150 - 150,
          scale: interpolate(frame, [collapse + 10, collapse + 34], [0, 1], { ...clamp, easing: land }),
          rotate: `${interpolate(frame, [collapse + 10, collapse + 34], [-30, 0], { ...clamp, easing: land })}deg`,
        }}
      >
        <NMark size={300} style={{ filter: "drop-shadow(0 40px 80px rgba(99,102,241,0.45))" }} />
      </div>
    </AbsoluteFill>
  );
};

const schema = {
  problem: { type: "text-content", default: "Your café runs on six apps.", description: "Problem line" },
  answer: { type: "text-content", default: "Run it on one.", description: "Answer line" },
} as const satisfies InteractivitySchema;

export const Hook = Interactive.withSchema({
  Component: HookInner,
  componentName: "<Hook>",
  schema,
  wrapInSequence: true,
});
