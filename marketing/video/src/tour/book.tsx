// Chapter 04: the Book tab as the mobile app draws it (client_app places_screen,
// hold_form, reservation_panel, live_visit): pick a room, reserve, and the tab
// becomes the "Held for you" face with its ring and rolling countdown.
import { Armchair, CalendarCheck, Check, Clock, Coffee, DoorOpen, Footprints, Plus, User, X, type LucideIcon } from "lucide-react";
import type React from "react";
import { AbsoluteFill, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, land } from "../theme";
import { Chapter, copySchema, useEnter, type ChapterProps } from "./chapter";
import { GuestPhone, PageTitle, S, TopBar, Touch } from "./ui";
import { useT } from "./lang";

const enter = { easing: (t: number) => 1 - Math.pow(1 - t, 3) } as const; // the app's enter curve, close enough
const AMBER = "#FBBF24";

// Digits that roll like the app's RollingNumber: a changed digit slides up out, the new one in.
const Rolling: React.FC<{ now: string; before: string; p: number; size: number }> = ({ now, before, p, size }) => (
  <span style={{ display: "inline-flex", direction: "ltr", fontVariantNumeric: "tabular-nums" }}>
    {now.split("").map((ch, i) => {
      const old = before[i] ?? ch;
      const moving = old !== ch;
      return (
        <span
          key={i}
          style={{
            position: "relative",
            display: "inline-block",
            height: size * 1.15,
            lineHeight: `${size * 1.15}px`,
            overflow: "hidden",
            verticalAlign: "top",
          }}
        >
          <span style={{ display: "block", translate: moving ? `0px ${(1 - p) * size * 1.15}px` : undefined }}>{ch}</span>
          {moving ? (
            <span style={{ position: "absolute", left: 0, top: 0, display: "block", translate: `0px ${-p * size * 1.15}px` }}>
              {old}
            </span>
          ) : null}
        </span>
      );
    })}
  </span>
);

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

type Place = { name: string; Icon: LucideIcon; free: boolean; note: string; rate?: string; status?: string };
// Any business's places: tables first; rooms and their hourly rates are just one option.
const PLACES: Place[] = [
  { name: "Table 4", Icon: Armchair, free: true, note: "By the window · 4 seats" },
  { name: "Table 7", Icon: Armchair, free: false, note: "Terrace · 6 seats", status: "Occupied" },
  { name: "Private room", Icon: DoorOpen, free: true, note: "Up to 10 guests", rate: "Minimum EGP 500" },
  { name: "Table 2", Icon: Armchair, free: false, note: "Garden · 2 seats", status: "Reserved" },
];

// The floating dock with the Book tab turned into the hold's live countdown.
const BookDock: React.FC<{ held: boolean; secs: number; share: number; tick: number }> = ({ held, secs, share, tick }) => {
  const tr = useT();
  const r = 11;
  const c = 2 * Math.PI * r;
  const tabs: { label: string; Icon: LucideIcon; on: boolean }[] = [
    { label: "Menu", Icon: Coffee, on: false },
    { label: held ? "Table 4" : "Book", Icon: held ? Armchair : CalendarCheck, on: true },
    { label: "You", Icon: User, on: false },
  ];
  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        right: 8,
        bottom: 8,
        height: 56,
        borderRadius: 28,
        backgroundColor: S.slab,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        padding: "0 6px",
        boxShadow: "0 6px 18px -10px rgb(0 0 0 / .28)",
      }}
    >
      {tabs.map(({ label, Icon, on }) => (
        <div
          key={label}
          style={{
            flex: on && held ? 1.5 : 1,
            height: 44,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            backgroundColor: on ? "rgba(255,255,255,0.16)" : "transparent",
            color: on ? "#fff" : "rgba(255,255,255,0.55)",
          }}
        >
          {on && held ? (
            <span style={{ position: "relative", width: 26, height: 26, display: "grid", placeItems: "center" }}>
              <svg width={26} height={26} style={{ position: "absolute", inset: 0, rotate: "-90deg" }}>
                <circle cx={13} cy={13} r={r} stroke="rgba(255,255,255,0.2)" strokeWidth={2} fill="none" />
                <circle
                  cx={13}
                  cy={13}
                  r={r}
                  stroke={AMBER}
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={c * (1 - share)}
                />
              </svg>
              <Icon size={14} />
            </span>
          ) : (
            <Icon size={18} style={{ scale: on ? "1.12" : "1" }} />
          )}
          {tr(label)}
          {on && held ? (
            <span style={{ opacity: 0.85 }}>
              <Rolling now={mmss(secs).slice(1)} before={mmss(secs + 1).slice(1)} p={tick} size={13} />
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
};

const BookInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const tr = useT();
  const { fps } = useVideoConfig();
  const open = 52;
  const reserve = 112;
  const done = reserve + 22;
  const face = done + 22;
  const grow = interpolate(frame, [open + 2, open + 13], [0, 1], { ...clamp, ...enter });
  const morph = interpolate(frame, [reserve + 2, reserve + 12], [0, 1], { ...clamp, ...enter });
  // The hold: ten minutes from the moment it is confirmed, one tick per second.
  const since = Math.max(0, frame - done);
  const secs = 600 - Math.floor(since / fps);
  const tick = interpolate(since % fps, [0, 6], [0, 1], clamp);
  const ringDraw = interpolate(frame, [face + 4, face + 22], [0, 1], { ...clamp, ...enter });
  const share = (secs - (since % fps) / fps) / 600;
  const beat = (k: number) => ({
    opacity: interpolate(frame, [face + k * 27, face + k * 27 + 11], [0, 1], clamp),
    translate: interpolate(frame, [face + k * 27, face + k * 27 + 11], ["0px 16px", "0px 0px"], { ...clamp, ...enter }),
  });
  const R = 103;
  const C = 2 * Math.PI * R;
  const held = frame >= face;

  return (
    <Chapter
      look="light"
      n="04"
      eyebrow="For your guests"
      title={title}
      mark="booked"
      line={line}
      chips={["Tables", "Rooms", "Held while they come", "Live countdown"]}
      style={style}
    >
      <GuestPhone x={1330} y={70} height={940} label="Mobile app" style={useEnter(4)}>
        <TopBar />
        {/* The list, then the face over it */}
        <div style={{ opacity: interpolate(frame, [face - 4, face + 4], [1, 0], clamp) }}>
          <PageTitle title="Book" sub="2 free now" />
          <div style={{ position: "absolute", top: 186, left: 16, right: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {PLACES.map((p, i) => {
              const first = i === 0;
              return (
                <div
                  key={p.name}
                  style={{
                    position: "relative",
                    minHeight: 136,
                    borderRadius: 28,
                    overflow: "hidden",
                    backgroundColor: p.free ? S.slab : "#fff",
                    color: p.free ? "#fff" : S.fg,
                    boxShadow: p.free ? "0 6px 18px -10px rgb(0 0 0 / .28)" : S.surface,
                    opacity: interpolate(frame, [4 + i * 3, 12 + i * 3], [0, 1], clamp),
                    translate: interpolate(frame, [4 + i * 3, 14 + i * 3], ["0px 14px", "0px 0px"], { ...clamp, ...enter }),
                  }}
                >
                  <p.Icon
                    size={176}
                    style={{ position: "absolute", insetInlineEnd: -24, bottom: -32, opacity: 0.12, rotate: "-12deg" }}
                  />
                  <div style={{ padding: 20, position: "relative" }}>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 700,
                        backgroundColor: p.free ? "rgba(52,211,153,0.2)" : p.status === "Reserved" ? "rgba(251,191,36,0.18)" : "rgba(248,113,113,0.14)",
                        color: p.free ? "#6EE7B7" : p.status === "Reserved" ? "#b45309" : "#dc2626",
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "currentColor" }} />
                      {p.free ? "Available" : p.status}
                    </div>
                    {p.free ? (
                      <div
                        style={{
                          position: "absolute",
                          top: 16,
                          insetInlineEnd: 16,
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          backgroundColor: "#fff",
                          color: S.fg,
                          display: "grid",
                          placeItems: "center",
                          rotate: first ? `${45 * grow}deg` : undefined,
                        }}
                      >
                        <Plus size={20} strokeWidth={2.5} />
                      </div>
                    ) : null}
                    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 14 }}>{tr(p.name)}</div>
                    <div style={{ fontSize: 14, opacity: 0.8, marginTop: 2 }}>{tr(p.note)}</div>
                    {p.rate ? (
                      <div
                        style={{
                          display: "inline-block",
                          marginTop: 8,
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 13,
                          fontWeight: 700,
                          backgroundColor: "rgba(255,255,255,0.12)",
                        }}
                      >
                        {tr(p.rate)}
                      </div>
                    ) : null}
                  </div>
                  {first ? (
                    // The booking slides in under the card's face on a white inner panel.
                    <div style={{ height: 136 * grow, overflow: "hidden" }}>
                      <div
                        style={{
                          margin: 6,
                          marginTop: 0,
                          padding: 16,
                          borderRadius: 22,
                          backgroundColor: "#fff",
                          color: S.fg,
                          opacity: grow,
                          translate: `0px ${(1 - grow) * -12}px`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              backgroundColor: "rgba(15,23,43,0.1)",
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <Clock size={18} />
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 600 }}>10 minutes to arrive</div>
                        </div>
                        {/* Reserve Now: a pill that shrinks to a spinner, then a green tick */}
                        <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
                          <div
                            style={{
                              width: interpolate(morph, [0, 1], [326, 48]),
                              height: 48,
                              borderRadius: 24,
                              backgroundColor: frame >= done ? "#10B981" : S.primary,
                              color: "#fff",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 15,
                              fontWeight: 700,
                              boxShadow: "0 8px 20px -10px rgba(0,0,0,.45)",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {frame >= done ? (
                              <Check size={22} strokeWidth={3} style={{ scale: `${interpolate(frame, [done, done + 10], [0.4, 1], { ...clamp, easing: land })}` }} />
                            ) : morph > 0.6 ? (
                              <div
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: "50%",
                                  border: "2.5px solid rgba(255,255,255,0.3)",
                                  borderTopColor: "#fff",
                                  rotate: `${frame * 24}deg`,
                                }}
                              />
                            ) : (
                              <span style={{ opacity: 1 - morph * 2 }}>{tr("Reserve Now")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* The reservation face: the whole tab becomes one slab panel */}
        {held ? (
          <div
            style={{
              position: "absolute",
              top: 116,
              left: 8,
              right: 8,
              bottom: 80,
              borderRadius: 32,
              backgroundColor: S.slab,
              color: "#fff",
              boxShadow: "0 6px 18px -10px rgb(0 0 0 / .28)",
              padding: "28px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              textAlign: "center",
              opacity: interpolate(frame, [face, face + 8], [0, 1], clamp),
              scale: `${interpolate(frame, [face, face + 12], [0.96, 1], { ...clamp, ...enter })}`,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 999,
                backgroundColor: "rgba(245,158,11,0.15)",
                color: "#F59E0B",
                fontSize: 13,
                fontWeight: 700,
                ...beat(0),
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: "#F59E0B",
                  boxShadow: `0 0 0 ${interpolate(frame % 30, [0, 29], [0, 7])}px rgba(245,158,11,${interpolate(frame % 30, [0, 29], [0.5, 0])})`,
                }}
              />
              {tr("Held for you")}
            </div>
            <div style={{ position: "relative", width: 216, height: 216, ...beat(0.1) }}>
              <svg width={216} height={216} style={{ position: "absolute", inset: 0, rotate: "-90deg" }}>
                <circle cx={108} cy={108} r={R} stroke="rgba(255,255,255,0.12)" strokeWidth={10} fill="none" />
                <circle
                  cx={108}
                  cy={108}
                  r={R}
                  stroke={AMBER}
                  strokeWidth={10}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - share * ringDraw)}
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 52,
                  fontWeight: 800,
                  letterSpacing: -1,
                }}
              >
                <Rolling now={mmss(secs)} before={mmss(Math.min(600, secs + 1))} p={tick} size={52} />
              </div>
            </div>
            <div style={{ ...beat(0.3) }}>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{tr("Table 4")}</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{tr("By the window · 4 seats")}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, ...beat(0.45) }}>
              <Footprints size={18} /> {tr("Walk over and show this at the counter")}
            </div>
            <div
              style={{
                width: 240,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 14,
                fontWeight: 700,
                ...beat(0.6),
              }}
            >
              <X size={16} /> {tr("Cancel Reservation")}
            </div>
          </div>
        ) : null}

        <BookDock held={held} secs={secs} share={share} tick={tick} />
        <Touch x={338} y={222} at={open} />
        <Touch x={195} y={186 + 136 + 16 + 40 + 14 + 24} at={reserve} />
        <AbsoluteFill style={{ pointerEvents: "none" }} />
      </GuestPhone>
    </Chapter>
  );
};

export const Book = Interactive.withSchema({
  Component: BookInner,
  componentName: "<Book>",
  schema: copySchema(
    "Rooms and tables, booked ahead.",
    "Guests hold a table from their phone and watch the countdown while they walk over.",
  ),
  wrapInSequence: true,
});
