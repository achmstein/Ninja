// "The clock": the gaming lounge film, and a template for a client's own pitch.
// One night told as a story: nobody knows how long a room has played, the requests pile
// up, then Ninja counts every minute: book from the phone, the clock runs onto the bill,
// requests reach the till, the bill splits, and the owner sees every room live.
// Every screen wears the brand passed in `brand` (name, logo, colours, rooms, snacks), so
// a client's lounge renders from one JSON file: see clients/README.md.
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadBungee } from "@remotion/google-fonts/Bungee";
import { loadFont as loadPacifico } from "@remotion/google-fonts/Pacifico";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { Audio } from "@remotion/media";
import { HtmlInCanvasMotionBlur } from "@remotion/motion-blur";
import { Check, Gamepad2, Send, Timer } from "lucide-react";
import type React from "react";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { NMark, Wordmark } from "../parts";
import { clamp, inter, land } from "../theme";
import { BizContext, type Business } from "./businesses";
import { FilmFinish } from "./finish";
import { LitMark } from "./gaming";
import { LangContext, plexArabic, useLang, useT, type Lang } from "./lang";
import { Sfx } from "./sfx";
import { BillRow, Dock, GuestPhone, S, Screen, TopBar, Touch } from "./ui";
import { BookHeader, HoldForm, HoldPanel, PlaceCard, RoomSheet, TillBills, TillFloor, useClient, YourRoomCard } from "./clock-screens";
import { Flight, TrayRow, TraySheet } from "./guests";
import { MenuScreen } from "./menu-screen";

const { fontFamily: anton } = loadAnton("normal", { weights: ["400"], subsets: ["latin"] });
const { fontFamily: bungee } = loadBungee("normal", { weights: ["400"], subsets: ["latin"] });
const { fontFamily: pacifico } = loadPacifico("normal", { weights: ["400"], subsets: ["latin"] });
const { fontFamily: playfair } = loadPlayfair("italic", { weights: ["700"], subsets: ["latin"] });

// ——— The brand a film is made for ————————————————————————————————————————
export type ClientBrand = {
  name: string;
  // An image in public/ (e.g. "clients/levelup/logo.png"), or the name set in a font.
  logoImage?: string;
  logoFont?: "bungee" | "anton" | "playfair" | "pacifico" | "inter";
  primary: string; // the brand colour the app wears
  accent?: string; // the second colour of the background wash
  slab: string; // its deep shade (the dock, the room card)
  rooms: { name: string; rate: number }[]; // the first is the one booked; rate per hour
  snacks: { name: string; price: number; photo: string }[]; // photo: public/dishes/<photo>.jpg or a path
  pitch?: boolean; // end on "<name>, running on Ninja." instead of the generic line
};

export const LEVEL_UP: ClientBrand = {
  name: "Level Up",
  logoFont: "bungee",
  primary: "#7c3aed",
  accent: "#0ea5e9",
  slab: "#1a0b33",
  rooms: [
    { name: "PS5 Room 1", rate: 60 },
    { name: "PS5 Room 2", rate: 60 },
    { name: "PS5 Room 3", rate: 60 },
    { name: "VIP Room", rate: 90 },
    { name: "PS4 Room 4", rate: 40 },
    { name: "PS4 Room 5", rate: 40 },
  ],
  snacks: [
    { name: "Mini Pizza", price: 120, photo: "pizza" },
    { name: "Loaded Nachos", price: 110, photo: "nachos" },
    { name: "Milkshake", price: 95, photo: "gshake" },
    { name: "Hot Dog", price: 80, photo: "hotdog" },
    { name: "Popcorn", price: 45, photo: "popcorn" },
    { name: "Blue Mocktail", price: 75, photo: "mocktail" },
  ],
  pitch: false,
};

const FONTS = { bungee, anton, playfair, pacifico, inter } as const;

const Logo: React.FC<{ brand: ClientBrand; height: number; color: string }> = ({ brand, height, color }) =>
  brand.logoImage ? (
    <Img src={staticFile(brand.logoImage)} style={{ height, width: "auto", display: "block" }} />
  ) : (
    <span
      style={{
        fontFamily: FONTS[brand.logoFont ?? "inter"],
        fontStyle: brand.logoFont === "playfair" ? "italic" : undefined,
        fontWeight: brand.logoFont === "inter" ? 800 : brand.logoFont === "playfair" ? 700 : 400,
        fontSize: height * (brand.logoFont === "bungee" ? 0.85 : 1.05),
        lineHeight: 1,
        color,
        textTransform: brand.logoFont === "anton" || brand.logoFont === "bungee" ? "uppercase" : undefined,
        whiteSpace: "nowrap",
      }}
    >
      {brand.name}
    </span>
  );

const toBusiness = (b: ClientBrand): Business => ({
  id: "levelup",
  kind: "PlayStation lounge",
  name: b.name,
  categories: ["Snacks", "Drinks", "Combos", "Sweets"],
  items: b.snacks.map((x) => ({ key: x.photo, name: x.name, note: "", price: x.price, img: x.photo })),
  primary: b.primary,
  slab: b.slab,
  logo: (color, h) => <Logo brand={b} height={h} color={color} />,
});

// ——— The film's grid: the music's drop, a beat of 12 frames, cuts on bars ————————
const DROP = 247;
const T = { cold: 0, turn: DROP, book: DROP + 96, clock: DROP + 288, ask: DROP + 432, bill: DROP + 624, owner: DROP + 816, end: DROP + 960 };
export const CLOCK_FRAMES = T.end + 210;
const CUTS = [T.turn, T.book, T.clock, T.ask, T.bill, T.owner, T.end];

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const AMBER = "#F59E0B";
const money = (n: number) => `EGP ${Number.isInteger(n) ? n : n.toFixed(2)}`;
const hms = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// The copy deck, both languages. The app screens translate themselves.
const COPY = {
  long: { en: "How long have they been playing?", ar: "بقالهم قد إيه بيلعبوا؟" },
  nobody: { en: "Nobody really knows.", ar: "محدش عارف بالظبط." },
  stop: { en: "Stop guessing.", ar: "كفاية تخمين." },
  counted: { en: "Every minute, counted.", ar: "كل دقيقة محسوبة." },
  book1: { en: "Book a room", ar: "احجز أوضة" },
  book2: { en: "before you arrive.", ar: "قبل ما توصل." },
  bill: { en: "Every minute goes on the bill.", ar: "كل دقيقة بتتحسب على الفاتورة." },
  seat: { en: "From the seat.", ar: "من مكانك." },
  till: { en: "Straight to the till.", ar: "على الكاشير على طول." },
  onBill: { en: "Room time, already on the bill.", ar: "وقت الأوضة على الفاتورة." },
  share: { en: "Everyone pays their share.", ar: "كل واحد يدفع نصيبه." },
  live: { en: "Every room. Live.", ar: "كل الأوض قدامك، لحظة بلحظة." },
  get: { en: "Get Ninja for your lounge.", ar: "خلّي نينجا في محلك." },
} as const;
type Key = keyof typeof COPY;

const useCopy = () => {
  const ar = useLang() === "ar";
  return (k: Key) => (ar ? COPY[k].ar : COPY[k].en);
};
const useFont = () => {
  const ar = useLang() === "ar";
  return { fontFamily: ar ? plexArabic : inter, direction: ar ? "rtl" : "ltr", letterSpacing: ar ? 0 : "-0.045em", fontWeight: ar ? 700 : 800 } as const;
};

// ——— Building blocks ————————————————————————————————————————————————————

// The night: two brand colours washing in from opposite corners and meeting across the frame
// on a slow diagonal, over near black. Wide linear washes, so there are no round spots.
const Night: React.FC<{ brand: ClientBrand }> = ({ brand }) => {
  const frame = useCurrentFrame();
  const a = brand.primary;
  const b = brand.accent ?? "#0ea5e9";
  const tilt = 118 + Math.sin(frame / 120) * 8;
  const reach = 62 + Math.sin(frame / 95) * 6;
  return (
    <AbsoluteFill style={{ backgroundColor: "#04040a" }}>
      <AbsoluteFill style={{ background: `linear-gradient(${tilt}deg, color-mix(in srgb, ${a} 62%, transparent) 0%, color-mix(in srgb, ${a} 18%, transparent) 30%, transparent ${reach}%)` }} />
      <AbsoluteFill style={{ background: `linear-gradient(${tilt + 180}deg, color-mix(in srgb, ${b} 55%, transparent) 0%, color-mix(in srgb, ${b} 16%, transparent) 30%, transparent ${reach}%)` }} />
      {/* The middle stays dark enough for white type */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 60% 55% at 50% 50%, rgba(4,4,10,0.55) 0%, transparent 100%)" }} />
    </AbsoluteFill>
  );
};

// Words that rise out of a mask one after another.
const Rise: React.FC<{ text: string; at: number; size: number; color?: string; style?: React.CSSProperties; out?: number }> = ({
  text,
  at,
  size,
  color = "#fff",
  style,
  out,
}) => {
  const frame = useCurrentFrame();
  const f = useFont();
  const gone = out === undefined ? 0 : interpolate(frame, [out, out + 8], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <div
      style={{
        ...f,
        fontSize: size,
        lineHeight: f.direction === "rtl" ? 1.3 : 1.02,
        color,
        display: "flex",
        flexWrap: "wrap",
        columnGap: "0.24em",
        opacity: 1 - gone,
        filter: gone ? `blur(${gone * 12}px)` : undefined,
        ...style,
      }}
    >
      {text.split(" ").map((w, i) => (
        <span key={i} style={{ overflow: "hidden", paddingBottom: "0.1em" }}>
          <span
            style={{
              display: "inline-block",
              translate: `0px ${interpolate(frame, [at + i * 2, at + i * 2 + 14], [110, 0], { ...clamp, easing: ease })}%`,
            }}
          >
            {w}
          </span>
        </span>
      ))}
    </div>
  );
};

// The film's motif: a clock in big tabular digits.
const Digits: React.FC<{ text: string; size: number; color?: string; glow?: string; style?: React.CSSProperties }> = ({ text, size, color = "#fff", glow, style }) => (
  <div
    style={{
      fontFamily: inter,
      fontWeight: 800,
      fontSize: size,
      lineHeight: 1,
      letterSpacing: "-0.04em",
      fontVariantNumeric: "tabular-nums",
      direction: "ltr",
      color,
      textShadow: glow ? `0 0 60px ${glow}` : undefined,
      ...style,
    }}
  >
    {text}
  </div>
);

// Each cut lands with a small settle: a touch of scale and blur clearing.
const Enter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        scale: `${interpolate(frame, [0, 10], [1.05, 1], { ...clamp, easing: ease })}`,
        filter: `blur(${interpolate(frame, [0, 8], [8, 0], clamp)}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// Ninja in the corner of every chapter.
const Badge: React.FC<{ dark?: boolean }> = ({ dark = true }) => {
  const ar = useLang() === "ar";
  return (
    <div style={{ position: "absolute", top: 54, [ar ? "right" : "left"]: 64, display: "flex", alignItems: "center", gap: 12, direction: "ltr", opacity: 0.9, zIndex: 50 }}>
      <NMark size={42} />
      <Wordmark size={40} color={dark ? "#fff" : S.fg} />
    </div>
  );
};

const Chip: React.FC<{ children: React.ReactNode; tone: string; size?: number }> = ({ children, tone, size = 26 }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: `${size * 0.3}px ${size * 0.7}px`,
      borderRadius: 999,
      backgroundColor: `color-mix(in srgb, ${tone} 22%, transparent)`,
      color: tone,
      fontFamily: inter,
      fontSize: size,
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

// ——— 1. Cold open: the guessing ————————————————————————————————————————
const Cold: React.FC<{ brand: ClientBrand }> = ({ brand }) => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const ar = useLang() === "ar";
  const room = brand.rooms[2] ?? brand.rooms[0];
  const scramble = frame >= 58;
  const secs = 1 * 3600 + 42 * 60 + 7 + Math.floor(frame / 30);
  const real = hms(secs);
  const shown = scramble ? real.replace(/\d/g, (_, i: number) => String((Math.floor(frame / 2) * 7 + i * 13) % 10)) : real;
  const clockOut = interpolate(frame, [92, 102], [0, 1], clamp);
  const r = (i: number) => brand.rooms[i]?.name ?? brand.rooms[0].name;
  const QS = [
    { who: r(2), en: "We're done, how much?", ar: "خلصنا، الحساب كام؟", tone: "#60a5fa" },
    { who: r(0), en: "We need another controller!", ar: "محتاجين دراع تاني!", tone: AMBER },
    { who: r(4), en: `Two ${brand.snacks[0].name}s. Which room?`, ar: `اتنين ${brand.snacks[0].name}. لأنهي أوضة؟`, tone: "#f87171" },
    { who: "Counter", en: `How long has ${r(1)} been playing?`, ar: `${r(1)} بقالها قد إيه؟`, tone: "#2dd4bf" },
    { who: "Counter", en: `Who's paying for ${r(5)}?`, ar: `مين هيدفع ${r(5)}؟`, tone: "#2dd4bf" },
  ];
  const qAt = (i: number) => 100 + i * 24;
  const stackOut = interpolate(frame, [212, 224], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill>
      <Night brand={brand} />
      {/* The clock nobody trusts */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 1 - clockOut, scale: `${1 + clockOut * 0.2}`, filter: `blur(${clockOut * 16}px)` }}>
        <div style={{ opacity: interpolate(frame, [0, 10], [0, 1], clamp) }}>
          <Chip tone="#a5b4fc" size={30}>
            <Gamepad2 size={30} /> {room.name}
          </Chip>
        </div>
        <Digits text={shown} size={330} color={scramble ? "#fca5a5" : "#fff"} style={{ marginTop: 26, opacity: interpolate(frame, [2, 12], [0, 1], clamp) }} />
        <div style={{ height: 110, marginTop: 20, position: "relative", width: 1600, display: "flex", justifyContent: "center" }}>
          <Rise text={c("long")} at={12} size={72} color="rgba(255,255,255,0.8)" out={54} style={{ position: "absolute", justifyContent: "center" }} />
          <Rise text={c("nobody")} at={62} size={72} color="#fca5a5" style={{ position: "absolute", justifyContent: "center" }} />
        </div>
      </AbsoluteFill>
      {[6, 36, 66].map((t) => (
        <Sfx key={t} name="tick" at={t} />
      ))}
      <Sfx name="switch" at={58} />
      {/* The requests pile up, each pushing the last one back */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 1 - stackOut, filter: `blur(${stackOut * 20}px)` }}>
        {QS.map((q, i) => {
          if (frame < qAt(i)) return null;
          const level = QS.filter((_, j) => j > i && frame >= qAt(j)).length;
          const t = interpolate(frame, [qAt(i), qAt(i) + 10], [0, 1], { ...clamp, easing: land });
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                padding: "34px 54px",
                borderRadius: 40,
                backgroundColor: "#15151f",
                border: "1px solid rgba(255,255,255,0.14)",
                boxShadow: "0 40px 90px -30px rgba(0,0,0,0.8)",
                translate: `${(i % 2 ? 1 : -1) * level * 34}px ${-level * 86 + (1 - t) * 80}px`,
                scale: `${(1 - level * 0.08) * interpolate(t, [0, 1], [1.25, 1])}`,
                opacity: Math.max(0, 1 - level * 0.24) * Math.min(1, t * 2),
                filter: `blur(${level * 2.2}px)`,
                zIndex: i,
              }}
            >
              <Chip tone={q.tone} size={26}>
                {q.who === "Counter" ? (ar ? "الكاشير" : "Counter") : q.who}
              </Chip>
              <div style={{ ...fontStatic(ar), fontSize: 84, color: "#fff", marginTop: 16, whiteSpace: "nowrap" }}>{ar ? q.ar : q.en}</div>
            </div>
          );
        })}
      </AbsoluteFill>
      {QS.map((_, i) => (
        <Sfx key={i} name="pop" at={qAt(i)} volume={2.5} />
      ))}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Rise text={c("stop")} at={222} size={180} style={{ justifyContent: "center" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
const fontStatic = (ar: boolean) =>
  ({ fontFamily: ar ? plexArabic : inter, direction: ar ? "rtl" : "ltr", letterSpacing: ar ? 0 : "-0.04em", fontWeight: ar ? 700 : 800 }) as const;

// ——— 2. The turn: the clock snaps to zero and starts counting ————————————————
const Turn: React.FC<{ brand: ClientBrand }> = ({ brand }) => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const secs = Math.max(0, Math.floor((frame - 16) / 30) + (frame >= 16 ? 1 : 0));
  return (
    <AbsoluteFill>
      <Night brand={brand} />
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: interpolate(frame, [0, 6], [0.5, 0], clamp) }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ opacity: interpolate(frame, [14, 24], [0, 1], clamp), scale: `${interpolate(frame, [14, 30], [0.8, 1], { ...clamp, easing: land })}`, marginBottom: -30 }}>
          <LitMark size={110} sweepAt={30} />
        </div>
        <Digits
          text={hms(secs)}
          size={300}
          glow={`color-mix(in srgb, ${brand.primary} 70%, transparent)`}
          style={{ scale: `${interpolate(frame, [0, 12], [1.35, 1], { ...clamp, easing: land })}` }}
        />
        <Rise text={c("counted")} at={30} size={84} color="rgba(255,255,255,0.85)" style={{ justifyContent: "center", marginTop: 26 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// A room card as the guest app draws it, on the brand's deep shade.
// ——— 3. Book: the real Book tab, the booking under the card, then the hold ——————————
const BookScene: React.FC<{ brand: ClientBrand }> = ({ brand }) => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const u = useClient();
  const ar = useLang() === "ar";
  const room = brand.rooms[0];
  const t = { open: 34, toggle: 62, reserve: 90, panel: 126 };
  const y = interpolate(frame, [0, 22], [700, 50], { ...clamp, easing: ease });
  const list = 1 - interpolate(frame, [t.panel - 4, t.panel + 2], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Night brand={brand} />
      <Badge />
      <Rise text={c("book1")} at={14} size={112} style={{ position: "absolute", top: 400, [ar ? "right" : "left"]: 90, width: 580, justifyContent: "flex-end", textAlign: "end" }} />
      <Rise text={c("book2")} at={26} size={112} color={`color-mix(in srgb, ${brand.accent ?? "#0ea5e9"} 55%, white)`} style={{ position: "absolute", top: 400, [ar ? "left" : "right"]: 90, width: 580 }} />
      <GuestPhone x={720} y={y} height={1000}>
        <TopBar />
        <div style={{ position: "absolute", inset: 0, opacity: list }}>
          <BookHeader sub={u("free3")} />
          <div style={{ position: "absolute", top: 196, left: 16, right: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            <PlaceCard name={room.name} rate={room.rate} slab={brand.slab} free plus={{ openAt: t.open }}>
              <HoldForm t={t} primary={brand.primary} />
            </PlaceCard>
            <PlaceCard name={brand.rooms[1]?.name ?? room.name} rate={brand.rooms[1]?.rate ?? room.rate} slab={brand.slab} free={false} status="occupied" />
            <PlaceCard name={brand.rooms[3]?.name ?? room.name} rate={brand.rooms[3]?.rate ?? room.rate} slab={brand.slab} free={false} status="reserved" />
          </div>
        </div>
        {frame >= t.panel - 4 ? <HoldPanel at={t.panel} name={room.name} slab={brand.slab} startNow /> : null}
        <Dock active="Book" />
        <Touch x={334} y={236} at={t.open} />
        <Touch x={330} y={474} at={t.toggle} />
        <Touch x={195} y={538} at={t.reserve} />
      </GuestPhone>
      <Sfx name="open" at={t.open + 2} />
      <Sfx name="switch" at={t.toggle} />
      <Sfx name="success" at={t.reserve + 16} />
    </AbsoluteFill>
  );
};

// ——— 4. The clock: minutes run straight onto the bill ————————————————————
const ClockScene: React.FC<{ brand: ClientBrand }> = ({ brand }) => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const room = brand.rooms[0];
  const end = 2 * 3600 + 14 * 60;
  const secs = interpolate(frame, [12, 108], [0, end], { ...clamp, easing: Easing.bezier(0.55, 0, 0.25, 1) });
  const cost = Math.floor((secs / 3600) * room.rate);
  const locked = frame >= 110;
  const pulse = interpolate(frame, [110, 114, 126], [1, 1.04, 1], clamp);
  return (
    <AbsoluteFill>
      <Night brand={brand} />
      <Badge />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Rise text={c("bill")} at={4} size={80} color="rgba(255,255,255,0.85)" style={{ justifyContent: "center" }} />
        <div style={{ marginTop: 46, opacity: interpolate(frame, [6, 14], [0, 1], clamp) }}>
          <Chip tone="#a5b4fc" size={30}>
            <Timer size={30} /> {`${room.name} · ${room.rate}/hour`}
          </Chip>
        </div>
        <Digits text={hms(secs)} size={300} style={{ marginTop: 16, scale: `${pulse}` }} glow={`color-mix(in srgb, ${brand.primary} 60%, transparent)`} />
        <Digits text={money(cost)} size={130} color={AMBER} style={{ marginTop: 6, scale: `${pulse}` }} glow={locked ? "rgba(245,158,11,0.6)" : undefined} />
      </AbsoluteFill>
      {Array.from({ length: 8 }, (_, i) => 12 + i * 12).map((t) => (
        <Sfx key={t} name="tick" at={t} />
      ))}
      <Sfx name="success" at={110} />
    </AbsoluteFill>
  );
};

// ——— 5. Requests: the room sheet on the phone, the till's open bills beside it ——————
const AskScene: React.FC<{ brand: ClientBrand }> = ({ brand }) => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const u = useClient();
  const ar = useLang() === "ar";
  const room = brand.rooms[0];
  const snack = brand.snacks[0];
  const k = { card: 12, sheet: 16, ask: 42, seen: 50, ack: 72, close: 96, menu: 100, add: 108, order: 128, place: 144, sent: 152, lands: 160, confirm: 176 };
  const secs = 2 * 3600 + 14 * 60 + Math.floor(frame / 30);
  const roomCost = Math.floor((secs / 3600) * room.rate);
  const controller = frame >= k.ack + 4 ? "onTheWay" : frame >= k.ask + 2 ? "sent" : "idle";
  const onMenu = frame >= k.menu;
  const others = (i: number) => brand.rooms[i] ?? room;
  // The customer on the left in English, on the right in Arabic.
  const guestX = ar ? 960 : 0;
  const tillX = ar ? 0 : 960;
  const pulse = (from: number) => {
    if (frame < from || frame > from + 14) return null;
    const p = interpolate(frame, [from, from + 12], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    const x = ar ? interpolate(p, [0, 1], [1240, 680]) : interpolate(p, [0, 1], [680, 1240]);
    return <div style={{ position: "absolute", left: x - 14, top: 526, width: 28, height: 28, borderRadius: 14, backgroundColor: AMBER, boxShadow: "0 0 40px 10px rgba(245,158,11,0.6)", zIndex: 40 }} />;
  };
  const row =
    frame >= k.sent ? (
      <BillRow Icon={Send} tone="rgba(255,255,255,0.12)" line={`Sent · ${room.name}`} total={money(snack.price)} pill="Your room" />
    ) : (
      <TrayRow items={[snack.photo]} count={1} total={snack.price} button={frame >= k.place ? "Sending…" : frame >= k.order + 2 ? "Place Order" : "Order"} />
    );
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: guestX, top: 0, width: 960, height: 1080, overflow: "hidden" }}>
        <Night brand={brand} />
        <Rise text={c("seat")} at={4} size={64} style={{ position: "absolute", top: 60, left: 0, right: 0, justifyContent: "center" }} />
        <GuestPhone x={273} y={160} height={880}>
          {!onMenu ? (
            <>
              <TopBar />
              <BookHeader sub={ar ? `انت في ${room.name}` : `You're in ${room.name}`} />
              <div style={{ position: "absolute", top: 196, left: 16, right: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                <YourRoomCard name={room.name} secs={secs} slab={brand.slab} pressAt={k.card} />
                <div style={{ fontSize: 13, fontWeight: 600, color: S.mutedFg, marginTop: 4 }}>{u("otherPlaces")}</div>
                <div style={{ opacity: 0.6 }}>
                  <PlaceCard name={others(1).name} rate={others(1).rate} slab={brand.slab} free={false} status="occupied" />
                </div>
              </div>
              <Dock active="Book" />
              <RoomSheet at={k.sheet} closeAt={k.close} slab={brand.slab} primary={brand.primary} secs={secs} members={["You", "Omar", "Karim", "Nour"]} controller={controller} />
              <Touch x={195} y={300} at={k.card} />
              <Touch x={309} y={760} at={k.ask} />
            </>
          ) : (
            <>
              <MenuScreen counts={{ [snack.photo]: frame >= k.add + 2 ? 1 : 0 }} />
              <TraySheet openAt={k.order + 2} closeAt={k.sent} lines={[snack.photo]} />
              <Dock row={row} rowAt={k.add + 10} />
              <Flight dish={snack.photo} row={0} slot={0} at={k.add} />
              <Touch x={352} y={192} at={k.add} />
              <Touch x={318} y={746} at={k.order} />
              <Touch x={300} y={746} at={k.place} />
            </>
          )}
        </GuestPhone>
      </div>
      <div style={{ position: "absolute", left: tillX, top: 0, width: 960, height: 1080, backgroundColor: "#eef0f4", overflow: "hidden" }}>
        <Rise text={c("till")} at={20} size={64} color={S.fg} style={{ position: "absolute", top: 60, left: 0, right: 0, justifyContent: "center" }} />
        <Screen x={ar ? -320 : 40} y={170} width={1240} logical={[960, 860]} font={inter}>
          <TillBills
            bills={[
              { name: room.name, secs, total: roomCost + (frame >= k.confirm + 2 ? snack.price : 0) },
              { name: others(1).name, secs: 38 * 60 + Math.floor(frame / 30), total: 38 + 75 },
              { name: others(4).name, secs: 2 * 3600 + 5 * 60 + Math.floor(frame / 30), total: 83 + 120 },
              { name: others(5).name, secs: 54 * 60 + Math.floor(frame / 30), total: 36 },
            ]}
            requests={[{ room: room.name, at: k.seen, ackAt: k.ack }]}
            orders={[{ room: room.name, number: 58, who: "Lina", total: snack.price, at: k.lands, confirmAt: k.confirm }]}
            popAt={{ [room.name]: k.confirm + 2 }}
          />
          <Touch x={90} y={202} at={k.ack} />
          <Touch x={264} y={331} at={k.confirm} />
        </Screen>
      </div>
      {pulse(k.ask + 2)}
      {pulse(k.sent)}
      <Sfx name="ding" at={k.seen} />
      <Sfx name="success" at={k.ack + 4} />
      <Sfx name="ding" at={k.lands} />
      <Sfx name="success" at={k.confirm + 2} />
    </AbsoluteFill>
  );
};

// ——— 6. The bill: room time already on it, then split four ways ———————————
const BillScene: React.FC<{ brand: ClientBrand }> = ({ brand }) => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const tr = useT();
  const ar = useLang() === "ar";
  const room = brand.rooms[0];
  const roomCost = Math.floor((2 + 14 / 60) * room.rate);
  const [a, b, d] = [brand.snacks[0], brand.snacks[1] ?? brand.snacks[0], brand.snacks[2] ?? brand.snacks[0]];
  const lines = [
    { name: `${room.name} · 2h 14m`, price: roomCost, room: true },
    { name: `1x ${a.name}`, price: a.price },
    { name: `1x ${b.name}`, price: b.price },
    { name: `2x ${d.name}`, price: d.price * 2 },
  ];
  const total = lines.reduce((s, l) => s + l.price, 0);
  const share = Math.round((total / 4) * 100) / 100;
  const lineAt = (i: number) => 14 + i * 12;
  const totalAt = 64;
  const split = 100;
  const k = interpolate(frame, [split, split + 14], [0, 1], { ...clamp, easing: ease });
  const counted = interpolate(frame, [totalAt, totalAt + 18], [0, total], { ...clamp, easing: ease });
  const FRIENDS = ["Lina", "Omar", "Karim", "Nour"];
  return (
    <AbsoluteFill>
      <Night brand={brand} />
      <Badge />
      <div style={{ position: "absolute", top: 120, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Rise text={c("onBill")} at={4} size={76} out={split - 6} style={{ position: "absolute", justifyContent: "center" }} />
        <Rise text={c("share")} at={split + 2} size={76} style={{ position: "absolute", justifyContent: "center" }} />
      </div>
      {/* The bill */}
      <div
        style={{
          position: "absolute",
          left: 560,
          top: 260,
          width: 800,
          padding: "34px 40px",
          borderRadius: 36,
          backgroundColor: "#fff",
          color: S.fg,
          fontFamily: ar ? plexArabic : inter,
          direction: ar ? "rtl" : "ltr",
          boxShadow: "0 60px 120px -40px rgba(0,0,0,0.8)",
          translate: `0px ${interpolate(frame, [0, 16], [500, 0], { ...clamp, easing: ease })}px`,
          opacity: 1 - k,
          scale: `${1 - k * 0.3}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{tr("Your bill")}</div>
          <Logo brand={brand} height={34} color={brand.primary} />
        </div>
        <div style={{ height: 1, backgroundColor: S.border, margin: "22px 0 10px" }} />
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              height: 64,
              fontSize: 30,
              fontWeight: l.room ? 700 : 500,
              opacity: interpolate(frame, [lineAt(i), lineAt(i) + 6], [0, 1], clamp),
              translate: `${interpolate(frame, [lineAt(i), lineAt(i) + 10], [ar ? -40 : 40, 0], { ...clamp, easing: ease })}px 0px`,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {l.room ? <Timer size={28} color={brand.primary} /> : null}
              {tr(l.name)}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums", direction: "ltr" }}>{money(l.price)}</span>
          </div>
        ))}
        <div style={{ height: 1, backgroundColor: S.border, margin: "10px 0 18px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 44, fontWeight: 800, opacity: interpolate(frame, [totalAt, totalAt + 6], [0, 1], clamp) }}>
          <span>{tr("Total")}</span>
          <span style={{ fontVariantNumeric: "tabular-nums", direction: "ltr" }}>{money(Math.round(counted))}</span>
        </div>
      </div>
      {lines.map((_, i) => (
        <Sfx key={i} name="pop" at={lineAt(i)} volume={2} />
      ))}
      {/* Four shares, each paid */}
      {FRIENDS.map((name, i) => {
        const x = 150 + (ar ? 3 - i : i) * 420;
        const paid = split + 26 + i * 10;
        const isPaid = frame >= paid;
        return (
          <div
            key={name}
            style={{
              position: "absolute",
              left: x,
              top: 380,
              width: 360,
              height: 340,
              borderRadius: 32,
              padding: 30,
              backgroundColor: isPaid ? "#ecfdf5" : "#fff",
              color: S.fg,
              fontFamily: ar ? plexArabic : inter,
              direction: ar ? "rtl" : "ltr",
              boxShadow: "0 40px 80px -30px rgba(0,0,0,0.7)",
              opacity: k,
              translate: `${(960 - (x + 180)) * (1 - k)}px ${(1 - k) * 60}px`,
              scale: `${0.7 + 0.3 * k}`,
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: brand.primary, color: "#fff", display: "grid", placeItems: "center", fontSize: 30, fontWeight: 800 }}>{name[0]}</div>
            <div style={{ fontSize: 30, fontWeight: 700, marginTop: 18 }}>{name}</div>
            <div style={{ fontSize: 46, fontWeight: 800, marginTop: 6, fontVariantNumeric: "tabular-nums", direction: "ltr", textAlign: ar ? "right" : "left" }}>{money(share)}</div>
            <div
              style={{
                marginTop: 18,
                height: 56,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                fontSize: 24,
                fontWeight: 800,
                backgroundColor: isPaid ? S.emerald : S.muted,
                color: isPaid ? "#fff" : S.mutedFg,
                scale: `${interpolate(frame, [paid, paid + 4, paid + 12], [1, 1.12, 1], clamp)}`,
              }}
            >
              {isPaid ? <Check size={26} strokeWidth={3} /> : null}
              {tr(isPaid ? "Paid" : "Unpaid")}
            </div>
            <Sfx name="success" at={paid} volume={0.7} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ——— 7. The owner: the real till, pulling back from one bill to the whole floor ——————
const OwnerScene: React.FC<{ brand: ClientBrand }> = ({ brand }) => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const r = (i: number) => brand.rooms[i] ?? brand.rooms[0];
  const run = (start: number, i: number) => {
    const secs = start + Math.floor(frame / 30);
    return { name: r(i).name, secs, total: Math.floor((secs / 3600) * r(i).rate) };
  };
  const bills = [run(2 * 3600 + 14 * 60, 0), run(38 * 60, 1), run(2 * 3600 + 5 * 60, 4), run(54 * 60, 5)];
  bills[0].total += brand.snacks[0].price;
  // The camera starts on the booked room's bill and pulls back to the whole floor, then makes room for the line.
  const pull = interpolate(frame, [4, 54], [0, 1], { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) });
  const settle = interpolate(frame, [76, 96], [0, 1], { ...clamp, easing: ease });
  const zoom = interpolate(pull, [0, 1], [3, 1]) * (1 - settle * 0.14);
  const fx = interpolate(pull, [0, 1], [682, 960]);
  const fy = interpolate(pull, [0, 1], [543, 540]) + settle * 60;
  return (
    <AbsoluteFill>
      <Night brand={brand} />
      <AbsoluteFill style={{ transformOrigin: "0 0", transform: `translate(960px, 540px) scale(${zoom}) translate(${-fx}px, ${-fy}px)` }}>
        <Screen x={160} y={60} width={1600} logical={[1280, 800]} font={inter}>
          <TillFloor
            biz={brand.name}
            places={[
              { name: r(2).name, dot: "#22c55e" },
              { name: r(3).name, dot: "#f59e0b", detail: "Omar" },
            ]}
          >
            <TillBills bills={bills} reserved={{ room: r(3).name, who: "Omar", left: 482 }} />
          </TillFloor>
        </Screen>
      </AbsoluteFill>
      <Rise text={c("live")} at={84} size={84} style={{ position: "absolute", bottom: 54, left: 0, right: 0, justifyContent: "center" }} />
      <AbsoluteFill style={{ opacity: interpolate(frame, [50, 60], [0, 1], clamp) }}>
        <Badge />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ——— 8. The end card ————————————————————————————————————————————————————
const EndCard: React.FC<{ brand: ClientBrand }> = ({ brand }) => {
  const frame = useCurrentFrame();
  const c = useCopy();
  const ar = useLang() === "ar";
  const f = useFont();
  return (
    <AbsoluteFill>
      <Night brand={brand} />
      <Sfx name="impact" at={10} volume={0.7} />
      <Sfx name="success" at={66} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        {brand.pitch ? (
          <div style={{ display: "flex", alignItems: "center", gap: 34, direction: "ltr", marginBottom: 40, opacity: interpolate(frame, [4, 14], [0, 1], clamp), scale: `${interpolate(frame, [4, 24], [0.85, 1], { ...clamp, easing: land })}` }}>
            <Logo brand={brand} height={84} color="#fff" />
            <span style={{ fontFamily: inter, fontSize: 56, fontWeight: 300, color: "rgba(255,255,255,0.5)" }}>×</span>
            <NMark size={84} />
          </div>
        ) : (
          <div style={{ scale: `${interpolate(frame, [8, 30], [0.85, 1], { ...clamp, easing: land })}`, opacity: interpolate(frame, [8, 16], [0, 1], clamp), marginBottom: -30 }}>
            <LitMark size={140} sweepAt={44} drawFrom={12} />
          </div>
        )}
        <Rise text={c("counted")} at={30} size={110} style={{ justifyContent: "center" }} />
        <div style={{ ...f, fontWeight: 500, letterSpacing: 0, marginTop: 14, fontSize: 40, color: "rgba(255,255,255,0.7)", opacity: interpolate(frame, [46, 56], [0, 1], clamp) }}>
          {brand.pitch ? (ar ? `${brand.name} شغّال على نينجا.` : `${brand.name}, running on Ninja.`) : c("get")}
        </div>
        <div
          style={{
            marginTop: 34,
            height: 80,
            padding: "0 44px",
            borderRadius: 999,
            backgroundColor: "#fff",
            color: "#0b1020",
            display: "grid",
            placeItems: "center",
            fontFamily: inter,
            fontSize: 36,
            fontWeight: 800,
            opacity: interpolate(frame, [58, 64], [0, 1], clamp),
            scale: `${interpolate(frame, [58, 74], [0.8, 1], { ...clamp, easing: land })}`,
          }}
        >
          ninjapp.net
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ——— The film ————————————————————————————————————————————————————————————
export type ClockProps = { readonly lang?: Lang; readonly brand?: ClientBrand; readonly blur?: boolean };

export const Clock: React.FC<ClockProps> = ({ lang = "en", brand = LEVEL_UP, blur = true }) => {
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const scenes: { name: string; from: number; to: number; C: React.FC<{ brand: ClientBrand }>; enter?: boolean }[] = [
    { name: "Cold open", from: T.cold, to: T.turn, C: Cold },
    { name: "Every minute, counted", from: T.turn, to: T.book, C: Turn },
    { name: "Book", from: T.book, to: T.clock, C: BookScene, enter: true },
    { name: "The clock", from: T.clock, to: T.ask, C: ClockScene, enter: true },
    { name: "Requests", from: T.ask, to: T.bill, C: AskScene, enter: true },
    { name: "The bill", from: T.bill, to: T.owner, C: BillScene, enter: true },
    { name: "The owner", from: T.owner, to: T.end, C: OwnerScene, enter: true },
    { name: "End card", from: T.end, to: CLOCK_FRAMES, C: EndCard },
  ];
  const picture = (
    <AbsoluteFill style={{ backgroundColor: "#05050a" }}>
      {scenes.map(({ name, from, to, C, enter }) => (
        <Sequence key={name} name={name} from={from} durationInFrames={to - from} premountFor={fps}>
          {enter ? (
            <Enter>
              <C brand={brand} />
            </Enter>
          ) : (
            <C brand={brand} />
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
  return (
    <LangContext.Provider value={lang}>
      <BizContext.Provider value={toBusiness(brand)}>
        <Audio
          name="Music"
          src={staticFile("tour-music-hype.mp3")}
          trimBefore={139}
          premountFor={fps}
          volume={interpolate(
            frame,
            [0, 0.3 * fps, DROP - 9, DROP - 7, DROP - 1, DROP, durationInFrames - 2 * fps, durationInFrames - 1],
            [0, 0.85, 0.85, 0, 0, 0.85, 0.85, 0],
            clamp,
          )}
        />
        <Sfx name="riser" at={DROP - 44} />
        <Sfx name="impact" at={DROP - 1} />
        {CUTS.slice(1).map((c) => (
          <Sfx key={c} name="whoosh" at={c - 9} />
        ))}
        {blur ? (
          <HtmlInCanvasMotionBlur width={width} height={height} samples={6} shutterAngle={180}>
            {picture}
          </HtmlInCanvasMotionBlur>
        ) : (
          picture
        )}
        <FilmFinish leaks={[DROP, T.end]} mirrored={lang === "ar"} />
      </BizContext.Provider>
    </LangContext.Provider>
  );
};
