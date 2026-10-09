import type React from "react";
import {
  AbsoluteFill,
  Interactive,
  interpolate,
  useCurrentFrame,
  type InteractivitySchema,
} from "remotion";
import { Backdrop, NMark, Wordmark } from "../parts";
import { C, clamp, glide, inter, land } from "../theme";

type Props = {
  readonly features: string;
  readonly tagline: string;
  readonly url: string;
  readonly style?: React.CSSProperties;
};

const OutroInner: React.FC<Props> = ({ features, tagline, url, style }) => {
  const frame = useCurrentFrame();
  const words = features.split(" ");
  const brand = 8 + words.length * 6 + 14;

  return (
    <AbsoluteFill style={style}>
      <Backdrop dark />

      {/* Order. Cook. Deliver. Ask. — one per beat, then they clear */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          paddingLeft: 90,
          gap: 4,
          fontFamily: inter,
          fontWeight: 800,
          fontSize: 150,
          letterSpacing: "-0.045em",
          lineHeight: 1,
          color: "#fff",
          opacity: interpolate(frame, [brand - 6, brand], [1, 0], clamp),
          scale: interpolate(frame, [brand - 6, brand], [1, 0.94], clamp),
        }}
      >
        {words.map((w, i) => {
          const at = 8 + i * 6;
          return (
            <div
              key={w}
              style={{
                opacity: interpolate(frame, [at, at + 4], [0, 1], clamp),
                translate: interpolate(frame, [at, at + 12], ["-80px 0px", "0px 0px"], { ...clamp, easing: glide }),
                color: i === words.length - 1 ? C.amber : "#fff",
              }}
            >
              {w}
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
          <NMark size={240} style={{ filter: "drop-shadow(0 40px 80px rgba(99,102,241,0.5))" }} />
        </div>
        <Wordmark
          size={190}
          color="#fff"
          style={{
            marginTop: 40,
            opacity: interpolate(frame, [brand + 8, brand + 16], [0, 1], clamp),
            translate: interpolate(frame, [brand + 8, brand + 24], ["0px 50px", "0px 0px"], { ...clamp, easing: glide }),
          }}
        />
        <div
          style={{
            marginTop: 40,
            fontSize: 52,
            fontWeight: 600,
            color: "rgba(255,255,255,0.75)",
            letterSpacing: "-0.02em",
            opacity: interpolate(frame, [brand + 16, brand + 24], [0, 1], clamp),
          }}
        >
          {tagline}
        </div>
        <div
          style={{
            marginTop: 70,
            height: 110,
            padding: "0 60px",
            borderRadius: 999,
            backgroundColor: "#fff",
            color: C.ink,
            display: "grid",
            placeItems: "center",
            fontSize: 48,
            fontWeight: 800,
            opacity: interpolate(frame, [brand + 24, brand + 30], [0, 1], clamp),
            scale: interpolate(frame, [brand + 24, brand + 40], [0.7, 1], { ...clamp, easing: land }),
          }}
        >
          {url}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const schema = {
  features: { type: "text-content", default: "Order. Cook. Deliver. Ask.", description: "Feature words" },
  tagline: { type: "text-content", default: "One app for your whole café.", description: "Tagline" },
  url: { type: "text-content", default: "ninjapp.net", description: "Website" },
} as const satisfies InteractivitySchema;

export const Outro = Interactive.withSchema({
  Component: OutroInner,
  componentName: "<Outro>",
  schema,
  wrapInSequence: true,
});
