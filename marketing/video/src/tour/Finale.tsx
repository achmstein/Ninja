import type React from "react";
import { AbsoluteFill, Interactive, interpolate, useCurrentFrame, type InteractivitySchema } from "remotion";
import { NMark, Wordmark } from "../parts";
import { C, clamp, glide, inter, land } from "../theme";
import { Stage } from "./Frame";

type Props = {
  readonly recap: string;
  readonly tagline: string;
  readonly url: string;
  readonly style?: React.CSSProperties;
};

// Every chapter's name flies past in a wall, then clears for the brand.
const FinaleInner: React.FC<Props> = ({ recap, tagline, url, style }) => {
  const frame = useCurrentFrame();
  const items = recap.split(" · ");
  const brand = 20 + items.length * 3 + 26;

  return (
    <AbsoluteFill style={style}>
      <Stage look="dark">
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignContent: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 18,
            padding: "0 160px",
            fontFamily: inter,
            opacity: interpolate(frame, [brand - 8, brand], [1, 0], clamp),
            scale: interpolate(frame, [brand - 8, brand], [1, 1.08], clamp),
          }}
        >
          {items.map((it, i) => {
            const s = 10 + i * 3;
            return (
              <div
                key={it}
                style={{
                  padding: "20px 34px",
                  borderRadius: 999,
                  fontSize: 40,
                  fontWeight: 700,
                  color: "#fff",
                  backgroundColor: i % 4 === 0 ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  opacity: interpolate(frame, [s, s + 5], [0, 1], clamp),
                  scale: interpolate(frame, [s, s + 14], [0.5, 1], { ...clamp, easing: land }),
                }}
              >
                {it}
              </div>
            );
          })}
        </AbsoluteFill>

        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: inter }}>
          <div
            style={{
              scale: interpolate(frame, [brand, brand + 22], [0, 1], { ...clamp, easing: land }),
              rotate: `${interpolate(frame, [brand, brand + 22], [-25, 0], { ...clamp, easing: land })}deg`,
            }}
          >
            <NMark size={200} style={{ filter: "drop-shadow(0 40px 80px rgba(99,102,241,0.5))" }} />
          </div>
          <Wordmark
            size={150}
            color="#fff"
            style={{
              marginTop: 26,
              opacity: interpolate(frame, [brand + 8, brand + 16], [0, 1], clamp),
              translate: interpolate(frame, [brand + 8, brand + 24], ["0px 40px", "0px 0px"], { ...clamp, easing: glide }),
            }}
          />
          <div
            style={{
              marginTop: 30,
              fontSize: 52,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "rgba(255,255,255,0.75)",
              opacity: interpolate(frame, [brand + 16, brand + 24], [0, 1], clamp),
            }}
          >
            {tagline}
          </div>
          <div
            style={{
              marginTop: 54,
              height: 100,
              padding: "0 56px",
              borderRadius: 999,
              backgroundColor: "#fff",
              color: C.ink,
              display: "grid",
              placeItems: "center",
              fontSize: 44,
              fontWeight: 800,
              opacity: interpolate(frame, [brand + 24, brand + 30], [0, 1], clamp),
              scale: interpolate(frame, [brand + 24, brand + 40], [0.7, 1], { ...clamp, easing: land }),
            }}
          >
            {url}
          </div>
        </AbsoluteFill>
      </Stage>
    </AbsoluteFill>
  );
};

const schema = {
  recap: {
    type: "text-content",
    default:
      "Your brand · Table ordering · Pay & split · Rooms & tables · Loyalty · Till · Kitchen · Own delivery · Branches · Menu scan · Photo studio · Stock & recipes · Food cost · Profit · Payroll · Ask your café",
    description: "Recap, separated by ' · '",
  },
  tagline: { type: "text-content", default: "Everything your café runs on.", description: "Tagline" },
  url: { type: "text-content", default: "ninjapp.net", description: "Website" },
} as const satisfies InteractivitySchema;

export const Finale = Interactive.withSchema({
  Component: FinaleInner,
  componentName: "<Finale>",
  schema,
  wrapInSequence: true,
});
