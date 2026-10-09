import { evolvePath, getLength, getPointAtLength } from "@remotion/paths";
import type React from "react";
import {
  AbsoluteFill,
  Interactive,
  interpolate,
  useCurrentFrame,
  type InteractivitySchema,
} from "remotion";
import { Backdrop, Headline, Phone, Step, useRise } from "../parts";
import { C, clamp, glide, land } from "../theme";

// Screen is 568 × 1208; the map fills its top part.
const ROUTE = "M 110 860 L 110 700 Q 110 640 170 640 L 300 640 Q 360 640 360 580 L 360 420 Q 360 360 420 360 L 470 360 L 470 250";
const STREETS = [
  "M 0 640 L 568 640",
  "M 0 360 L 568 360",
  "M 0 900 L 568 880",
  "M 110 0 L 110 1208",
  "M 360 0 L 360 1208",
  "M 470 0 L 470 700",
  "M 0 160 L 568 220",
  "M 220 360 L 220 900",
];

type Props = {
  readonly headline: string;
  readonly style?: React.CSSProperties;
};

const RiderInner: React.FC<Props> = ({ headline, style }) => {
  const frame = useCurrentFrame();
  const phone = useRise(2, 400);
  const go = 22;
  const arrive = 84;
  const progress = interpolate(frame, [go, arrive], [0, 1], { ...clamp, easing: glide });
  const length = getLength(ROUTE);
  const rider = getPointAtLength(ROUTE, progress * length) ?? { x: 110, y: 860 };
  const drawn = evolvePath(interpolate(frame, [8, go + 4], [0, 1], { ...clamp, easing: glide }), ROUTE);
  const minutes = Math.max(1, Math.ceil(6 * (1 - progress)));
  const delivered = frame >= arrive + 2;

  return (
    <AbsoluteFill style={style}>
      <Backdrop />
      <Step n="03" label="On the road" />
      <Headline text={headline} mark="own riders" at={2} />

      <Phone style={{ ...phone }} screen="#e9edf1">
        <svg width={568} height={1208} style={{ position: "absolute", inset: 0 }}>
          <rect x={150} y={420} width={170} height={180} rx={24} fill="#cfe9d6" />
          <rect x={400} y={700} width={140} height={160} rx={24} fill="#cfe9d6" />
          <rect x={0} y={960} width={568} height={60} fill="#cfe1f5" />
          {STREETS.map((d) => (
            <path key={d} d={d} stroke="#fff" strokeWidth={26} strokeLinecap="round" fill="none" />
          ))}
          <path d={ROUTE} stroke="rgba(15,23,42,0.15)" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path
            d={ROUTE}
            stroke={C.ink}
            strokeWidth={14}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={drawn.strokeDasharray}
            strokeDashoffset={drawn.strokeDashoffset}
          />
        </svg>

        {/* Café pin */}
        <div
          style={{
            position: "absolute",
            left: 110 - 36,
            top: 860 - 36,
            width: 72,
            height: 72,
            borderRadius: 22,
            backgroundColor: C.amber,
            border: "5px solid #fff",
            display: "grid",
            placeItems: "center",
            fontSize: 34,
            ...useRise(4, 40),
          }}
        >
          ☕
        </div>
        {/* Home pin */}
        <div
          style={{
            position: "absolute",
            left: 470 - 36,
            top: 250 - 36,
            width: 72,
            height: 72,
            borderRadius: "50%",
            backgroundColor: delivered ? C.green : C.ink,
            border: "5px solid #fff",
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontSize: 34,
            fontWeight: 800,
            scale: interpolate(frame, [arrive, arrive + 4, arrive + 14], [1, 1.25, 1], { ...clamp, easing: land }),
            ...useRise(8, 40),
          }}
        >
          {delivered ? "✓" : "⌂"}
        </div>
        {/* Rider */}
        <div
          style={{
            position: "absolute",
            left: rider.x - 30,
            top: rider.y - 30,
            width: 60,
            height: 60,
            borderRadius: "50%",
            backgroundColor: C.indigo,
            border: "6px solid #fff",
            boxShadow: `0 0 0 ${interpolate(frame % 24, [0, 23], [0, 26])}px rgba(99,102,241,${interpolate(frame % 24, [0, 23], [0.35, 0])})`,
            opacity: interpolate(frame, [go - 6, go], [0, 1], clamp),
          }}
        />

        {/* Bottom sheet */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 300,
            borderRadius: "48px 48px 0 0",
            backgroundColor: "#fff",
            padding: "26px 40px",
            boxShadow: "0 -20px 60px rgba(15,23,42,0.12)",
            ...useRise(10, 300),
          }}
        >
          <div style={{ width: 80, height: 8, borderRadius: 4, backgroundColor: "#e2e8f0", margin: "0 auto 26px" }} />
          <div style={{ fontSize: 26, fontWeight: 600, color: C.muted }}>Order 1042 · Café Layla</div>
          <div style={{ fontSize: 46, fontWeight: 800, color: C.ink, letterSpacing: "-0.02em", marginTop: 6 }}>
            {delivered ? "Delivered" : `Arriving in ${minutes} min`}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 26 }}>
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: "50%",
                backgroundColor: C.indigo,
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              M
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.ink }}>Mostafa</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: C.muted }}>Your café’s own rider</div>
            </div>
          </div>
        </div>
      </Phone>
    </AbsoluteFill>
  );
};

const schema = {
  headline: { type: "text-content", default: "Your own riders deliver it.", description: "Headline" },
} as const satisfies InteractivitySchema;

export const Rider = Interactive.withSchema({
  Component: RiderInner,
  componentName: "<Rider>",
  schema,
  wrapInSequence: true,
});
