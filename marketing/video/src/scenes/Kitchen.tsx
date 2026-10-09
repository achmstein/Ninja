import type React from "react";
import {
  AbsoluteFill,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  type InteractivitySchema,
} from "remotion";
import { Backdrop, Headline, Step, Tablet, Tap, useRise } from "../parts";
import { C, clamp, glide, inter, land } from "../theme";

const TICKET_W = 290;

const Ticket: React.FC<{
  title: string;
  items: string[];
  minutes: string;
  accent: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ title, items, minutes, accent, style, children }) => (
  <div
    style={{
      position: "absolute",
      top: 110,
      width: TICKET_W,
      borderRadius: 24,
      backgroundColor: C.slate800,
      border: "2px solid rgba(255,255,255,0.06)",
      overflow: "hidden",
      color: "#fff",
      ...style,
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 22px",
        backgroundColor: accent,
        fontSize: 28,
        fontWeight: 800,
      }}
    >
      <span>{title}</span>
      <span style={{ fontSize: 22, fontWeight: 700, opacity: 0.85 }}>{minutes}</span>
    </div>
    <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((it) => (
        <div key={it} style={{ fontSize: 25, fontWeight: 600, color: "#e2e8f0" }}>
          {it}
        </div>
      ))}
    </div>
    {children}
  </div>
);

type Props = {
  readonly headline: string;
  readonly style?: React.CSSProperties;
};

const KitchenInner: React.FC<Props> = ({ headline, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tablet = useRise(2, 300);
  const arrive = 22;
  const tapReady = 70;
  const push = interpolate(frame, [arrive, arrive + 14], [0, TICKET_W + 24], { ...clamp, easing: glide });
  const seconds = Math.max(0, Math.floor((frame - arrive) / fps));
  const ready = frame >= tapReady + 2;

  return (
    <AbsoluteFill style={style}>
      <Backdrop />
      <Step n="02" label="In the kitchen" />
      <Headline text={headline} mark="instantly." at={2} />

      <Tablet screen={C.night} style={{ ...tablet }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 30px",
            borderBottom: "2px solid rgba(255,255,255,0.06)",
            color: "#fff",
            fontSize: 28,
            fontWeight: 800,
          }}
        >
          <span>Kitchen</span>
          <span style={{ fontSize: 22, color: "#94a3b8", fontWeight: 600 }}>
            {frame >= arrive ? "3 open" : "2 open"}
          </span>
        </div>

        <Ticket
          title="Table 7"
          items={["2× Iced Mocha", "1× Cheesecake"]}
          minutes="4:10"
          accent={C.slate700}
          style={{ left: 24 + push }}
        />
        <Ticket
          title="Takeaway 41"
          items={["1× Flat White", "2× Croissant"]}
          minutes="2:35"
          accent={C.slate700}
          style={{ left: 24 + TICKET_W + 24 + push }}
        />
        <Ticket
          title="Table 3"
          items={["1× Spanish Latte", "1× Club Sandwich"]}
          minutes={`0:${String(seconds).padStart(2, "0")}`}
          accent={ready ? C.green : C.amber}
          style={{
            left: 24,
            opacity: interpolate(frame, [arrive, arrive + 6], [0, 1], clamp),
            translate: interpolate(frame, [arrive, arrive + 18], ["0px -220px", "0px 0px"], {
              ...clamp,
              easing: land,
            }),
            boxShadow: `0 0 ${interpolate(frame, [arrive + 10, arrive + 24, arrive + 46], [0, 60, 0], clamp)}px ${C.amber}`,
          }}
        >
          <div
            style={{
              margin: "6px 22px 22px",
              height: 70,
              borderRadius: 16,
              display: "grid",
              placeItems: "center",
              fontSize: 26,
              fontWeight: 800,
              backgroundColor: ready ? C.green : "#fff",
              color: ready ? "#fff" : C.ink,
              scale: interpolate(frame, [tapReady, tapReady + 3, tapReady + 12], [1, 0.92, 1], clamp),
            }}
          >
            {ready ? "Ready ✓" : "Mark ready"}
          </div>
        </Ticket>
        <Tap x={24 + TICKET_W / 2} y={110 + 300} at={tapReady} />
      </Tablet>

      {/* The phone that sent it, small, so the link reads */}
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 1500,
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "22px 30px",
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.8)",
          border: "1px solid #fff",
          boxShadow: "0 20px 60px -20px rgba(15,23,42,0.3)",
          fontFamily: inter,
          fontSize: 34,
          fontWeight: 700,
          color: C.ink,
          ...useRise(arrive + 6, 60),
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            backgroundColor: C.green,
            boxShadow: `0 0 0 ${interpolate(frame % 30, [0, 29], [0, 16])}px rgba(34,197,94,${interpolate(frame % 30, [0, 29], [0.4, 0])})`,
          }}
        />
        Guest sees: “Being prepared”
      </div>
    </AbsoluteFill>
  );
};

const schema = {
  headline: { type: "text-content", default: "The kitchen sees it instantly.", description: "Headline" },
} as const satisfies InteractivitySchema;

export const Kitchen = Interactive.withSchema({
  Component: KitchenInner,
  componentName: "<Kitchen>",
  schema,
  wrapInSequence: true,
});
