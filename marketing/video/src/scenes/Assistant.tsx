import type React from "react";
import {
  AbsoluteFill,
  Interactive,
  interpolate,
  useCurrentFrame,
  type InteractivitySchema,
} from "remotion";
import { Backdrop, Headline, Phone, Step, Tap, useRise } from "../parts";
import { C, clamp, geist, glide, land } from "../theme";

const MARGINS = [
  { name: "Iced Mocha", pct: 38 },
  { name: "Club Sandwich", pct: 41 },
  { name: "Cheesecake", pct: 44 },
];

type Props = {
  readonly headline: string;
  readonly question: string;
  readonly style?: React.CSSProperties;
};

const AssistantInner: React.FC<Props> = ({ headline, question, style }) => {
  const frame = useCurrentFrame();
  const phone = useRise(2, 400);
  const typeFrom = 12;
  const perChar = 1.1;
  const sent = Math.ceil(typeFrom + question.length * perChar) + 4;
  const typed = question.slice(0, Math.max(0, Math.floor((frame - typeFrom) / perChar)));
  const reply = sent + 24;
  const suggest = reply + 34;
  const tapDraft = suggest + 18;

  return (
    <AbsoluteFill style={style}>
      <Backdrop />
      <Step n="04" label="Ninja AI" />
      <Headline text={headline} mark="anything." at={2} />

      <Phone style={{ ...phone }} screen="#f8fafc" font={geist}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "100px 36px 22px",
            backgroundColor: "#fff",
            borderBottom: `1px solid ${C.hair}`,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              background: `linear-gradient(135deg, ${C.indigo}, ${C.teal})`,
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontSize: 32,
            }}
          >
            ✦
          </div>
          <div>
            <div style={{ fontSize: 32, fontWeight: 800, color: C.ink }}>Ninja AI</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: C.muted }}>Knows your menu, sales and stock</div>
          </div>
        </div>

        {/* Owner's question */}
        <div
          style={{
            position: "absolute",
            right: 30,
            top: 260,
            maxWidth: 420,
            padding: "22px 28px",
            borderRadius: "34px 34px 10px 34px",
            backgroundColor: C.ink,
            color: "#fff",
            fontSize: 28,
            fontWeight: 600,
            lineHeight: 1.3,
            ...useRise(sent, 60),
          }}
        >
          {question}
        </div>

        {/* Thinking */}
        <div
          style={{
            position: "absolute",
            left: 30,
            top: 420,
            display: "flex",
            gap: 10,
            padding: "24px 28px",
            borderRadius: 30,
            backgroundColor: "#fff",
            border: `1px solid ${C.hair}`,
            opacity: interpolate(frame, [sent + 6, sent + 10, reply - 2, reply], [0, 1, 1, 0], clamp),
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                backgroundColor: C.muted,
                opacity: interpolate((frame + i * 5) % 15, [0, 7, 14], [0.3, 1, 0.3]),
              }}
            />
          ))}
        </div>

        {/* Answer */}
        <div
          style={{
            position: "absolute",
            left: 30,
            right: 30,
            top: 420,
            padding: "28px 30px",
            borderRadius: "34px 34px 34px 10px",
            backgroundColor: "#fff",
            border: `1px solid ${C.hair}`,
            boxShadow: "0 20px 50px -24px rgba(15,23,42,0.25)",
            ...useRise(reply, 60),
          }}
        >
          <div style={{ fontSize: 27, fontWeight: 600, color: C.ink, lineHeight: 1.35 }}>
            Your three lowest margins this week:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 26 }}>
            {MARGINS.map((m, i) => {
              const at = reply + 8 + i * 5;
              return (
                <div key={m.name}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 24,
                      fontWeight: 600,
                      color: C.slate700,
                    }}
                  >
                    <span>{m.name}</span>
                    <span style={{ fontWeight: 800, color: i === 0 ? "#dc2626" : C.ink }}>
                      {Math.round(interpolate(frame, [at, at + 18], [0, m.pct], { ...clamp, easing: glide }))}%
                    </span>
                  </div>
                  <div style={{ height: 16, borderRadius: 8, backgroundColor: "#f1f5f9", marginTop: 10 }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 8,
                        backgroundColor: i === 0 ? "#ef4444" : C.ink,
                        width: `${interpolate(frame, [at, at + 18], [0, m.pct * 1.6], { ...clamp, easing: glide })}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 24, fontWeight: 500, color: C.muted, marginTop: 24, lineHeight: 1.4 }}>
            Milk went up 12% — the Iced Mocha recipe costs more now.
          </div>
        </div>

        {/* Suggestion */}
        <div
          style={{
            position: "absolute",
            left: 30,
            right: 30,
            top: 920,
            padding: "24px 28px",
            borderRadius: 30,
            backgroundColor: "#eef2ff",
            border: "2px solid #c7d2fe",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            ...useRise(suggest, 60),
          }}
        >
          <div style={{ fontSize: 25, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>
            Raise Iced Mocha
            <br />
            to EGP 105?
          </div>
          <div
            style={{
              padding: "18px 26px",
              borderRadius: 999,
              backgroundColor: frame >= tapDraft + 2 ? C.green : C.indigo,
              color: "#fff",
              fontSize: 24,
              fontWeight: 800,
              whiteSpace: "nowrap",
              scale: interpolate(frame, [tapDraft, tapDraft + 3, tapDraft + 12], [1, 0.9, 1], {
                ...clamp,
                easing: land,
              }),
            }}
          >
            {frame >= tapDraft + 2 ? "Drafted ✓" : "Draft it"}
          </div>
        </div>
        <Tap x={440} y={985} at={tapDraft} />

        {/* Composer */}
        <div
          style={{
            position: "absolute",
            left: 30,
            right: 30,
            bottom: 40,
            height: 96,
            borderRadius: 999,
            backgroundColor: "#fff",
            border: `2px solid ${frame >= typeFrom && frame < sent ? C.indigo : "#e2e8f0"}`,
            display: "flex",
            alignItems: "center",
            padding: "0 16px 0 32px",
            fontSize: 25,
            fontWeight: 500,
            color: frame < sent && typed.length > 0 ? C.ink : "#94a3b8",
            gap: 12,
          }}
        >
          <span style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            {frame < sent && typed.length > 0 ? typed : "Ask about your café…"}
            {frame < sent && frame >= typeFrom && Math.floor(frame / 8) % 2 === 0 ? "|" : ""}
          </span>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              backgroundColor: C.ink,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            ↑
          </div>
        </div>
        <Tap x={538 - 48} y={1208 - 88} at={sent - 2} />
      </Phone>
    </AbsoluteFill>
  );
};

const schema = {
  headline: { type: "text-content", default: "Ask your café anything.", description: "Headline" },
  question: {
    type: "text-content",
    default: "Which dishes have my lowest margins?",
    description: "Owner's question",
  },
} as const satisfies InteractivitySchema;

export const Assistant = Interactive.withSchema({
  Component: AssistantInner,
  componentName: "<Assistant>",
  schema,
  wrapInSequence: true,
});
