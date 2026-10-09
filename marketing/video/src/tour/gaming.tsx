// The PlayStation lounge film: a night look, Level Up's rooms, and the story of a group
// of friends: they book a room, play by the minute, ask for a controller, order snacks
// to the room and split the bill, while the owner sees every room live on the till.
import { Audio } from "@remotion/media";
import { HtmlInCanvasMotionBlur } from "@remotion/motion-blur";
import { evolvePath } from "@remotion/paths";
import { springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Bell, Check, ChefHat, Gamepad2, ReceiptText, Send, Timer } from "lucide-react";
import type React from "react";
import { AbsoluteFill, Easing, Interactive, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Wordmark } from "../parts";
import { clamp, glide, inter, land } from "../theme";
import { AppIconRow, N_PATH } from "./AppIcons";
import { Book } from "./book";
import { BizContext, businessById, useBiz } from "./businesses";
import { Chapter, copySchema, type ChapterProps } from "./chapter";
import { FilmFinish } from "./finish";
import { Stage } from "./Frame";
import { Flight, TrayRow, TraySheet } from "./guests";
import { beat, HeroContext, PopOut, WordBeat, type Hero } from "./hero";
import { Hook, type Bubble } from "./Hook";
import { LangContext, plexArabic, useLang, useT, type Lang } from "./lang";
import { MenuScreen } from "./menu-screen";
import { Pay } from "./pay";
import { Sfx } from "./sfx";
import { BillRow, Dock, GuestPhone, S, Screen, TopBar, Touch } from "./ui";

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const PHONE = { x: 1330, y: 70, height: 940 } as const;

// ——— The mark, lit like a product shot: a light sweeps across it, a floor reflection under it
const LitMark: React.FC<{ size: number; sweepAt: number; drawFrom?: number }> = ({ size, sweepAt, drawFrom }) => {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame, [sweepAt, sweepAt + 26], [-60, 160], { ...clamp, easing: Easing.bezier(0.45, 0, 0.2, 1) });
  const drawn = drawFrom === undefined ? null : evolvePath(interpolate(frame, [drawFrom, drawFrom + 20], [0, 1], { ...clamp, easing: glide }), N_PATH);
  const fill = drawFrom === undefined ? 1 : interpolate(frame, [drawFrom + 14, drawFrom + 24], [0, 1], clamp);
  const tile = (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: "block" }}>
      <defs>
        <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#23232a" />
          <stop offset="1" stopColor="#111115" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#tile)" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
      <path
        d={N_PATH}
        fill="#fafafa"
        fillOpacity={fill}
        stroke="#fafafa"
        strokeWidth={drawn ? 0.8 : 0}
        strokeDasharray={drawn?.strokeDasharray}
        strokeDashoffset={drawn?.strokeDashoffset}
      />
    </svg>
  );
  return (
    <div style={{ position: "relative", width: size }}>
      <div
        style={{
          position: "relative",
          borderRadius: size * 0.22,
          overflow: "hidden",
          boxShadow: "0 50px 90px -30px rgba(37,99,235,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        {tile}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(105deg, transparent ${sweep - 22}%, rgba(255,255,255,0.28) ${sweep}%, transparent ${sweep + 22}%)`,
            mixBlendMode: "screen",
          }}
        />
      </div>
      {/* The floor reflection */}
      <div
        style={{
          marginTop: size * 0.06,
          transform: "scaleY(-1)",
          opacity: 0.22,
          borderRadius: size * 0.22,
          overflow: "hidden",
          maskImage: "linear-gradient(to top, black, transparent 55%)",
          WebkitMaskImage: "linear-gradient(to top, black, transparent 55%)",
          height: size * 0.5,
        }}
      >
        {tile}
      </div>
    </div>
  );
};

const NightOpening: React.FC<{ line: string; lineAr: string; exitAt: number }> = ({ line, lineAr, exitAt }) => {
  const frame = useCurrentFrame();
  const ar = useLang() === "ar";
  const dive = interpolate(frame, [exitAt, exitAt + 14], [0, 1], { ...clamp, easing: Easing.bezier(0.7, 0, 0.84, 0) });
  const rest = 1 - interpolate(frame, [exitAt, exitAt + 6], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Stage look="neon">
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingTop: 60 }}>
          <div
            style={{
              opacity: interpolate(frame, [6, 24], [0, 1], clamp),
              scale: `${interpolate(frame, [6, 50], [0.92, 1], { ...clamp, easing: ease }) * (1 + dive * 30)}`,
              filter: `blur(${interpolate(frame, [6, 22], [10, 0], clamp)}px)`,
            }}
          >
            <LitMark size={170} sweepAt={30} />
          </div>
          <div style={{ marginTop: -40, opacity: interpolate(frame, [30, 44], [0, 1], clamp) * rest }}>
            <Wordmark size={110} color="#fff" />
          </div>
          <div style={{ overflow: "hidden", marginTop: 28, paddingBottom: "0.1em", opacity: rest }}>
            <div
              style={{
                fontFamily: ar ? plexArabic : inter,
                direction: ar ? "rtl" : "ltr",
                fontSize: ar ? 50 : 52,
                fontWeight: 600,
                letterSpacing: ar ? 0 : "-0.02em",
                color: "rgba(255,255,255,0.78)",
                translate: `0px ${interpolate(frame, [52, 72], [110, 0], { ...clamp, easing: ease })}%`,
              }}
            >
              {ar ? lineAr : line}
            </div>
          </div>
        </AbsoluteFill>
      </Stage>
    </AbsoluteFill>
  );
};

const NightClose: React.FC<{ headline: string; headlineAr: string; tagline: string; taglineAr: string; url: string }> = ({
  headline,
  headlineAr,
  tagline,
  taglineAr,
  url,
}) => {
  const frame = useCurrentFrame();
  const ar = useLang() === "ar";
  const font = ar ? plexArabic : inter;
  return (
    <AbsoluteFill>
      <Stage look="neon">
        <Sfx name="impact" at={14} volume={0.7} />
        <Sfx name="success" at={70} />
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: font, direction: ar ? "rtl" : "ltr" }}>
          <div style={{ scale: `${interpolate(frame, [8, 30], [0.85, 1], { ...clamp, easing: land })}`, opacity: interpolate(frame, [8, 16], [0, 1], clamp) }}>
            <LitMark size={150} sweepAt={44} drawFrom={12} />
          </div>
          <div style={{ marginTop: -34, opacity: interpolate(frame, [34, 44], [0, 1], clamp) }}>
            <Wordmark size={96} color="#fff" />
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: ar ? 46 : 48,
              fontWeight: ar ? 700 : 700,
              letterSpacing: ar ? 0 : "-0.03em",
              color: "#fff",
              opacity: interpolate(frame, [44, 54], [0, 1], clamp),
              translate: `0px ${interpolate(frame, [44, 60], [20, 0], { ...clamp, easing: ease })}px`,
            }}
          >
            {ar ? headlineAr : headline}
          </div>
          <div style={{ marginTop: 10, fontSize: 30, fontWeight: 500, color: "rgba(255,255,255,0.65)", opacity: interpolate(frame, [52, 62], [0, 1], clamp) }}>
            {ar ? taglineAr : tagline}
          </div>
          <div
            style={{
              marginTop: 30,
              height: 76,
              padding: "0 40px",
              borderRadius: 999,
              backgroundColor: "#fff",
              color: "#0b1020",
              display: "grid",
              placeItems: "center",
              fontFamily: inter,
              fontSize: 34,
              fontWeight: 800,
              opacity: interpolate(frame, [60, 66], [0, 1], clamp),
              scale: `${interpolate(frame, [60, 76], [0.8, 1], { ...clamp, easing: land })}`,
            }}
          >
            {url}
          </div>
          <AppIconRow at={74} size={70} gap={30} dark style={{ marginTop: 40 }} />
        </AbsoluteFill>
      </Stage>
    </AbsoluteFill>
  );
};

// ——— Play: the room's clock runs; a controller asked for from the seat
const PlayInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const tr = useT();
  const ar = useLang() === "ar";
  const biz = useBiz();
  const ask = 92;
  const sent = frame >= ask + 2;
  const secs = 1 * 3600 + 42 * 60 + 7 + Math.floor(frame / 30);
  const clock = `${Math.floor(secs / 3600)}:${String(Math.floor((secs % 3600) / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  const tiles = [
    { Icon: Bell, label: "Waiter" },
    { Icon: ReceiptText, label: "Get Bill" },
    { Icon: Gamepad2, label: "Controller" },
  ];
  return (
    <Chapter look="neon" n="P1" eyebrow="" title={title} line={line} style={style}>
      <GuestPhone {...PHONE} label="Mobile app">
        <TopBar />
        <div
          style={{
            position: "absolute",
            top: 116,
            left: 16,
            right: 16,
            borderRadius: 28,
            padding: 22,
            backgroundColor: biz.slab ?? S.slab,
            color: "#fff",
            overflow: "hidden",
          }}
        >
          <Gamepad2 size={170} style={{ position: "absolute", insetInlineEnd: -30, bottom: -40, opacity: 0.1, rotate: "-12deg" }} />
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 12px",
              borderRadius: 999,
              backgroundColor: "rgba(52,211,153,0.2)",
              color: "#6EE7B7",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: "#34D399",
                boxShadow: `0 0 0 ${interpolate(frame % 48, [0, 47], [0, 8])}px rgba(52,211,153,${interpolate(frame % 48, [0, 47], [0.5, 0])})`,
              }}
            />
            {tr("Clock running")}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 14 }}>{tr("PS5 Room 1")}</div>
          <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: -1, marginTop: 4, fontVariantNumeric: "tabular-nums", direction: "ltr", textAlign: ar ? "right" : "left" }}>
            {clock}
          </div>
          <div style={{ display: "inline-block", marginTop: 10, padding: "5px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700, backgroundColor: "rgba(255,255,255,0.12)" }}>
            {tr("PS5 · 60/hour")}
          </div>
        </div>
        <div style={{ position: "absolute", top: 380, left: 16, right: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: S.mutedFg, marginBottom: 10 }}>{tr("Need something?")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {tiles.map(({ Icon, label }) => {
              const on = label === "Controller" && sent;
              return (
                <div
                  key={label}
                  style={{
                    height: 104,
                    borderRadius: 20,
                    backgroundColor: on ? "#F59E0B" : "#fff",
                    color: on ? "#fff" : S.fg,
                    boxShadow: S.surface,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 700,
                    scale: label === "Controller" ? `${interpolate(frame, [ask, ask + 3, ask + 12], [1, 0.94, 1], clamp)}` : undefined,
                  }}
                >
                  {on ? <Check size={24} strokeWidth={3} /> : <Icon size={24} />}
                  {tr(on ? "Asked" : label)}
                </div>
              );
            })}
          </div>
        </div>
        <Dock active="Book" />
        <Touch x={325} y={432} at={ask} />
      </GuestPhone>
      <PopOut at={ask + 10} x={1030} y={560}>
        <div
          style={{
            padding: "20px 26px",
            borderRadius: 28,
            backgroundColor: "#fff",
            fontFamily: ar ? plexArabic : inter,
            direction: ar ? "rtl" : "ltr",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: "#F59E0B", display: "grid", placeItems: "center" }}>
            <Gamepad2 size={32} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: S.fg }}>{tr("Controller on its way")}</div>
            <div style={{ fontSize: 18, color: S.mutedFg, marginTop: 2 }}>{tr("PS5 Room 1")}</div>
          </div>
        </div>
      </PopOut>
      <Sfx name="ding" at={ask + 4} />
    </Chapter>
  );
};

export const Play = Interactive.withSchema({
  Component: PlayInner,
  componentName: "<Play>",
  schema: copySchema("The clock runs by the minute.", ""),
  wrapInSequence: true,
});

// ——— Snacks to the room: order from the seat, photos fly into the dock
const SnacksInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const add1 = 40;
  const add2 = 70;
  const order = 104;
  const place = 136;
  const sent = 152;
  const items = frame >= add2 + 2 ? ["pizza", "nachos"] : ["pizza"];
  const total = frame >= add2 + 2 ? 230 : 120;
  const row =
    frame >= sent + 40 ? (
      <BillRow Icon={ChefHat} tone={S.emerald} line="Being made · PS5 Room 1" total="EGP 230" pill="Your room" />
    ) : frame >= sent ? (
      <BillRow Icon={Send} tone="rgba(255,255,255,0.12)" line="Sent · PS5 Room 1" total="EGP 230" pill="Your room" />
    ) : (
      <TrayRow items={items} count={items.length} total={total} button={frame >= place ? "Sending…" : frame >= order + 2 ? "Place Order" : "Order"} />
    );
  return (
    <Chapter look="neon" n="P2" eyebrow="" title={title} line={line} style={style}>
      <GuestPhone {...PHONE} label="Mobile app">
        <MenuScreen counts={{ pizza: frame >= add1 + 2 ? 1 : 0, nachos: frame >= add2 + 2 ? 1 : 0 }} />
        <TraySheet openAt={order + 2} closeAt={sent} lines={["pizza", "nachos"]} />
        <Dock row={row} rowAt={add1 + 10} />
        <Flight dish="pizza" row={0} slot={0} at={add1} />
        <Flight dish="nachos" row={1} slot={1} at={add2} />
        <Touch x={352} y={192} at={add1} />
        <Touch x={352} y={288} at={add2} />
        <Touch x={318} y={746} at={order} />
        <Touch x={300} y={746} at={place} />
      </GuestPhone>
    </Chapter>
  );
};

export const Snacks = Interactive.withSchema({
  Component: SnacksInner,
  componentName: "<Snacks>",
  schema: copySchema("Snacks to the room.", ""),
  wrapInSequence: true,
});

// ——— For the owner: every room, live on the till
const ROOMS = [
  { name: "PS5 Room 1", state: "in", start: 1 * 3600 + 42 * 60, bill: 445 },
  { name: "PS5 Room 2", state: "in", start: 38 * 60, bill: 180 },
  { name: "VIP Room", state: "free", start: 0, bill: 0 },
  { name: "PS4 Room 3", state: "held", start: 0, bill: 0 },
  { name: "PS4 Room 4", state: "in", start: 2 * 3600 + 5 * 60, bill: 310 },
  { name: "PS5 Room 5", state: "in", start: 54 * 60, bill: 140 },
] as const;

const FloorInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const tr = useT();
  const req = 30;
  const done = 120;
  const hms = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return (
    <Chapter look="neon" n="P3" eyebrow="" title={title} line={line} style={style}>
      <Screen x={830} y={170} width={980} logical={[1280, 800]} font={inter}>
        <div style={{ height: 64, display: "flex", alignItems: "center", gap: 16, padding: "0 20px", borderBottom: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{tr("Till")}</div>
          <div style={{ display: "flex", gap: 6, padding: 4, borderRadius: 12, backgroundColor: S.muted }}>
            {["Sale", "Open bills"].map((t, i) => (
              <div
                key={t}
                style={{
                  padding: "8px 16px",
                  borderRadius: 9,
                  fontSize: 14,
                  fontWeight: 600,
                  backgroundColor: i === 1 ? "#fff" : "transparent",
                  color: i === 1 ? S.fg : S.mutedFg,
                }}
              >
                {tr(t)}
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {ROOMS.map((r, i) => {
            const live = r.state === "in";
            const asking = i === 0 && frame >= req && frame < done;
            const handled = i === 0 && frame >= done;
            return (
              <div
                key={r.name}
                style={{
                  position: "relative",
                  minHeight: 196,
                  padding: 18,
                  borderRadius: 16,
                  border: `1px solid ${asking ? "#F59E0B" : S.border}`,
                  backgroundColor: "#fff",
                  boxShadow: asking ? `0 0 0 ${interpolate(frame % 24, [0, 23], [0, 6])}px rgba(245,158,11,0.25)` : "0 1px 2px rgba(0,0,0,.05)",
                  opacity: interpolate(frame, [4 + i * 3, 10 + i * 3], [0, 1], clamp),
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 700 }}>
                    <Gamepad2 size={18} /> {tr(r.name)}
                  </div>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      backgroundColor: live ? "rgba(16,185,129,0.12)" : r.state === "held" ? "rgba(245,158,11,0.15)" : S.muted,
                      color: live ? "#047857" : r.state === "held" ? "#b45309" : S.mutedFg,
                    }}
                  >
                    {tr(live ? "In use" : r.state === "held" ? "Reserved" : "Free")}
                  </span>
                </div>
                {live ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, fontSize: 34, fontWeight: 800, fontVariantNumeric: "tabular-nums", direction: "ltr" }}>
                      <Timer size={22} color={S.mutedFg} />
                      {hms(r.start + Math.floor(frame / 30))}
                    </div>
                    <div style={{ fontSize: 15, color: S.mutedFg, marginTop: 6 }}>{tr(`EGP ${r.bill}`)}</div>
                  </>
                ) : (
                  <div style={{ marginTop: 26, fontSize: 15, color: S.mutedFg }}>{tr(r.state === "held" ? "Held · 8 min left" : "Free to play")}</div>
                )}
                {asking || handled ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 12,
                      right: 12,
                      bottom: 12,
                      height: 40,
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontSize: 14,
                      fontWeight: 700,
                      backgroundColor: handled ? "rgba(16,185,129,0.12)" : "#F59E0B",
                      color: handled ? "#047857" : "#fff",
                      scale: `${interpolate(frame, [req, req + 12], [0.7, 1], { ...clamp, easing: land })}`,
                    }}
                  >
                    {handled ? <Check size={16} /> : <Gamepad2 size={16} />}
                    {tr(handled ? "Controller sent" : "Controller requested")}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <Touch x={210} y={280} at={done - 2} size={48} />
      </Screen>
      <Sfx name="ding" at={req} />
      <Sfx name="success" at={done} />
    </Chapter>
  );
};

export const Floor = Interactive.withSchema({
  Component: FloorInner,
  componentName: "<Floor>",
  schema: copySchema("Every room, live on the till.", ""),
  wrapInSequence: true,
});

// ——— The film
const BUBBLES: Bubble[] = [
  { who: "PS5 Room 3", whoAr: "أوضة 3", en: "Can we add an hour?", ar: "ممكن نزود ساعة؟", x: 180, y: 170, r: -3, tone: "#3b82f6" },
  { who: "PS5 Room 1", whoAr: "أوضة 1", en: "We need another controller!", ar: "محتاجين دراع تاني!", x: 1080, y: 120, r: 4, tone: "#f59e0b" },
  { who: "PS4 Room 4", whoAr: "أوضة 4", en: "Two more pizzas, please.", ar: "بيتزا كمان اتنين لو سمحت.", x: 980, y: 560, r: -4, tone: "#ef4444" },
  { who: "Counter", whoAr: "الكاشير", en: "How long has Room 2 been playing?", ar: "أوضة 2 بقالها قد إيه؟", x: 120, y: 620, r: 3, tone: "#0d9488" },
  { who: "Counter", whoAr: "الكاشير", en: "Who's paying for Room 5?", ar: "مين هيدفع أوضة 5؟", x: 640, y: 360, r: -2, tone: "#0d9488" },
];

const next = () => springTiming({ config: { damping: 200 }, durationInFrames: 15 });
const HOOK_CUT = 103;
const CUTS = [247, 295, 487, 679, 871, 1063, 1255];

const H: Record<string, Hero> = {
  book: {
    title: "Book a room from the phone.",
    titleAr: "احجز اوضة من موبايلك.",
    rate: 1.25,
    look: "neon",
    cam: [
      { f: beat(0, 1.25), s: 1, x: 1556, y: 540 },
      { f: beat(3, 1.25), s: 1.35, x: 1556, y: 400 },
      { f: beat(9, 1.25), s: 1.35, x: 1556, y: 400 },
      { f: beat(10, 1.25), s: 1.6, x: 1556, y: 420 },
      { f: beat(12, 1.25), s: 1.6, x: 1556, y: 420 },
      { f: beat(13, 1.25), s: 1.3, x: 1460, y: 400 },
    ],
  },
  play: {
    title: "The clock runs by the minute.",
    titleAr: "الوقت بيتحسب بالدقيقة.",
    look: "neon",
    cam: [
      { f: beat(0), s: 1, x: 1556, y: 540 },
      { f: beat(2), s: 1.5, x: 1556, y: 300 },
      { f: beat(6), s: 1.5, x: 1556, y: 300 },
      { f: beat(7), s: 1.3, x: 1400, y: 560 },
    ],
  },
  snacks: {
    title: "Snacks to the room.",
    titleAr: "الطلبات لحد الأوضة.",
    look: "neon",
    cam: [
      { f: beat(0), s: 1.1, x: 1556, y: 420 },
      { f: beat(7), s: 1.1, x: 1556, y: 420 },
      { f: beat(8), s: 1.45, x: 1556, y: 760 },
    ],
  },
  pay: {
    title: "Each friend pays their share.",
    titleAr: "كل واحد يدفع نصيبه.",
    rate: 1.25,
    look: "neon",
    cam: [
      { f: beat(0, 1.25), s: 1, x: 1556, y: 540 },
      { f: beat(2, 1.25), s: 1.45, x: 1556, y: 600 },
      { f: beat(13, 1.25), s: 1.45, x: 1556, y: 600 },
      { f: beat(14, 1.25), s: 1.2, x: 1440, y: 560 },
    ],
  },
  floor: {
    title: "Every room, live on the till.",
    titleAr: "كل الأوض قدامك على الكاشير.",
    look: "neon",
    cam: [
      { f: beat(0), s: 1, x: 1320, y: 520 },
      { f: beat(2), s: 1.4, x: 1080, y: 400 },
      { f: beat(9), s: 1.4, x: 1080, y: 400 },
      { f: beat(10), s: 1.05, x: 1320, y: 520 },
    ],
  },
};

const P = { title: "", line: "" };

export const Gaming: React.FC<{ readonly lang?: Lang; readonly blur?: boolean }> = ({ lang = "en", blur = true }) => {
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const pan = () => slide({ direction: lang === "ar" ? "from-left" : "from-right" });
  const scenes = (
    <TransitionSeries>
      <TransitionSeries.Sequence name="Hook" durationInFrames={111} premountFor={fps}>
        <Hook neon bubbles={BUBBLES} question="Sound familiar?" questionAr="الكلام ده مألوف؟" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="Opening" durationInFrames={159} premountFor={fps}>
        <NightOpening line="Everything your PlayStation lounge runs on." lineAr="كل اللي محل البلايستيشن بتاعك محتاجه." exitAt={128} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="Book. Play. Order. Pay." durationInFrames={63} premountFor={fps}>
        <WordBeat words={["Book.", "Play.", "Order.", "Pay."]} wordsAr={["احجز.", "العب.", "اطلب.", "ادفع."]} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="Book a room" durationInFrames={207} premountFor={fps}>
        <HeroContext.Provider value={H.book}>
          <Book {...P} playbackRate={1.25} />
        </HeroContext.Provider>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={pan()} timing={next()} />
      <TransitionSeries.Sequence name="Play" durationInFrames={207} premountFor={fps}>
        <HeroContext.Provider value={H.play}>
          <Play {...P} />
        </HeroContext.Provider>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={pan()} timing={next()} />
      <TransitionSeries.Sequence name="Snacks" durationInFrames={207} premountFor={fps}>
        <HeroContext.Provider value={H.snacks}>
          <Snacks {...P} />
        </HeroContext.Provider>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={pan()} timing={next()} />
      <TransitionSeries.Sequence name="Pay" durationInFrames={207} premountFor={fps}>
        <HeroContext.Provider value={H.pay}>
          <Pay {...P} playbackRate={1.25} />
        </HeroContext.Provider>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={pan()} timing={next()} />
      <TransitionSeries.Sequence name="The owner's till" durationInFrames={207} premountFor={fps}>
        <HeroContext.Provider value={H.floor}>
          <Floor {...P} />
        </HeroContext.Provider>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="Close" durationInFrames={210} premountFor={fps}>
        <NightClose
          headline="Everything your PlayStation lounge runs on."
          headlineAr="كل اللي محل البلايستيشن بتاعك محتاجه."
          tagline="Get Ninja for your lounge."
          taglineAr="خلّي نينجا في محلك."
          url="ninjapp.net"
        />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
  return (
    <LangContext.Provider value={lang}>
      <BizContext.Provider value={businessById("levelup")}>
        <Audio
          name="Music"
          src={staticFile("tour-music-hype.mp3")}
          trimBefore={139}
          premountFor={fps}
          volume={interpolate(
            frame,
            [0, 0.3 * fps, CUTS[0] - 9, CUTS[0] - 7, CUTS[0] - 1, CUTS[0], durationInFrames - 2 * fps, durationInFrames - 1],
            [0, 0.85, 0.85, 0, 0, 0.85, 0.85, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )}
        />
        <Sfx name="riser" at={CUTS[0] - 44} />
        <Sfx name="impact" at={CUTS[0] - 1} />
        <Sfx name="whoosh" at={HOOK_CUT - 9} />
        {CUTS.map((c) => (
          <Sfx key={c} name="whoosh" at={c - 9} />
        ))}
        {blur ? (
          <HtmlInCanvasMotionBlur width={width} height={height} samples={6} shutterAngle={180}>
            {scenes}
          </HtmlInCanvasMotionBlur>
        ) : (
          scenes
        )}
        <FilmFinish leaks={[CUTS[0], CUTS[CUTS.length - 1]]} mirrored={lang === "ar"} />
      </BizContext.Provider>
    </LangContext.Provider>
  );
};

export const GAMING_FRAMES = 1458;
