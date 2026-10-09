import { Bike, Check, MapPin, ReceiptText, Settings } from "lucide-react";
import type React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  type InteractivitySchema,
} from "remotion";
import { NMark, Wordmark } from "../parts";
import { C, clamp, inter } from "../theme";
import { AR, plexArabic, useLang, useT } from "./lang";
import { MenuScreen } from "./menu-screen";
import { AdminShell, Dish, DISHES, Dock, GuestPhone, S, Screen, StatStrip } from "./ui";

// The opening: the whole family of apps as one product lineup on a studio floor,
// each labelled, then the features in one quiet line. No bounce, no glow.
const ease = Easing.bezier(0.22, 1, 0.36, 1);

const Reveal: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, children, style }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.1em", ...style }}>
      <div style={{ translate: `0px ${interpolate(frame, [at, at + 18], [110, 0], { ...clamp, easing: ease })}%` }}>
        {children}
      </div>
    </div>
  );
};

const useRiseIn = (at: number) => {
  const frame = useCurrentFrame();
  return {
    opacity: interpolate(frame, [at, at + 12], [0, 1], clamp),
    translate: `0px ${interpolate(frame, [at, at + 26], [70, 0], { ...clamp, easing: ease })}px`,
  } as const;
};

// ——— Static screens of each app ————————————————————————————————————

const TillMini: React.FC = () => {
  const tr = useT();
  const items = [DISHES.latte, DISHES.mocha, DISHES.cappuccino, DISHES.waffle, DISHES.cake, DISHES.lemonade];
  return (
    <>
      <div style={{ height: 64, display: "flex", alignItems: "center", padding: "0 20px", borderBottom: `1px solid ${S.border}`, fontSize: 20, fontWeight: 800 }}>
        {tr("Till")}
      </div>
      <div style={{ position: "absolute", top: 80, left: 16, width: 870, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {[...items, ...items.slice(0, 4)].map((d, i) => (
          <div key={i} style={{ padding: 8, borderRadius: 14, border: `1px solid ${S.border}` }}>
            <Dish img={d.img} size="100%" ratio="4 / 3" radius={10} />
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>{tr(d.name)}</div>
            <div style={{ fontSize: 13, color: S.mutedFg }}>{d.price}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", top: 64, right: 0, bottom: 0, width: 370, borderLeft: `1px solid ${S.border}`, padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{tr("Current sale")}</div>
        {[DISHES.latte, DISHES.waffle].map((d) => (
          <div key={d.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 600, marginTop: 16 }}>
            <span>{tr(d.name)}</span>
            <span>{d.price}</span>
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            left: 18,
            right: 18,
            bottom: 18,
            height: 56,
            borderRadius: 14,
            backgroundColor: S.primary,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            fontSize: 17,
            fontWeight: 700,
          }}
        >
          <span>{tr("Charge")}</span>
          <span>{tr("EGP 185")}</span>
        </div>
      </div>
    </>
  );
};

const KitchenMini: React.FC = () => {
  const tr = useT();
  const tickets = [
    { n: "#42", ch: "Table 3", t: "0:12", lines: ["1  Latte", "1  Waffle"], band: "rgba(241,245,249,0.6)", fg: S.fg },
    { n: "#41", ch: "Counter", t: "2:35", lines: ["2  Flat White", "1  Espresso"], band: "rgba(241,245,249,0.6)", fg: S.fg },
    { n: "#38", ch: "Table 7", t: "6:10", lines: ["2  Iced Mocha", "1  Chocolate Cake"], band: "rgba(245,158,11,0.15)", fg: "#b45309" },
    { n: "#35", ch: "Pickup", t: "11:02", lines: ["1  Waffle", "1  Lemonade"], band: "rgba(220,38,38,0.1)", fg: S.red },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: "#f8fafc" }}>
      <div style={{ height: 64, display: "flex", alignItems: "center", padding: "0 20px", backgroundColor: "#fff", borderBottom: `1px solid ${S.border}`, fontSize: 20, fontWeight: 800 }}>
        {tr("Kitchen")}
      </div>
      <div style={{ display: "flex", gap: 12, padding: 16 }}>
        {tickets.map((k) => (
          <div key={k.n} style={{ width: 260, borderRadius: 14, border: `1px solid ${S.border}`, backgroundColor: "#fff", overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", backgroundColor: k.band, color: k.fg, display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800 }}>
              <span>
                {k.n} <span style={{ fontSize: 13, color: S.fg }}>{tr(k.ch)}</span>
              </span>
              <span>{k.t}</span>
            </div>
            <div style={{ padding: "12px 14px", fontSize: 16, fontWeight: 600, display: "flex", flexDirection: "column", gap: 8 }}>
              {k.lines.map((l) => (
                <span key={l}>{tr(l)}</span>
              ))}
            </div>
            <div style={{ margin: "0 14px 14px", height: 46, borderRadius: 12, backgroundColor: S.primary, color: "#fff", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 700 }}>
              {tr("Ready")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdminMini: React.FC = () => {
  const tr = useT();
  return (
  <AdminShell active="Dashboard" crumb="Today" title="Dashboard">
    <StatStrip
      stats={[
        { label: "Sales today", value: "EGP 18,450" },
        { label: "Orders", value: "126" },
        { label: "Open bills", value: "9" },
        { label: "Profit this month", value: "EGP 86,400", tone: S.success },
      ]}
    />
    <div style={{ marginTop: 16, borderRadius: 14, border: `1px solid ${S.border}`, padding: 18, height: 360 }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{tr("Sales this week")}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 22, height: 280, marginTop: 16 }}>
        {[52, 64, 48, 71, 80, 96, 88].map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 8, backgroundColor: i === 5 ? S.fg : "#cbd5e1" }} />
        ))}
      </div>
    </div>
  </AdminShell>
  );
};

const RiderMini: React.FC = () => {
  const tr = useT();
  return (
  <div style={{ position: "absolute", inset: 0, backgroundColor: "#f8fafc" }}>
    <div style={{ position: "absolute", top: 60, left: 16, right: 16 }}>
      <div style={{ fontSize: 26, fontWeight: 800 }}>{tr("Deliveries")}</div>
      <div style={{ marginTop: 14, padding: 16, borderRadius: 20, backgroundColor: "#fff", border: "1px solid #0284c7" }}>
        <div style={{ fontSize: 13, color: S.mutedFg }}>{tr("Order #1042")}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{tr("Mona Adel")}</div>
          <div style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, backgroundColor: "rgba(2,132,199,0.12)", color: "#0284c7" }}>
            {tr("On the way")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 14 }}>
          <MapPin size={16} /> 12 Brazil St, Zamalek
        </div>
        <div style={{ marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: S.muted }}>
          <div style={{ fontSize: 12, color: S.mutedFg }}>{tr("Cash to collect")}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{tr("EGP 210")}</div>
        </div>
        <div style={{ marginTop: 12, height: 60, borderRadius: 14, backgroundColor: S.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 17, fontWeight: 700 }}>
          <Check size={18} /> {tr("Delivered ✓".replace(" ✓", ""))}
        </div>
      </div>
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 74, backgroundColor: "#fff", borderTop: `1px solid ${S.border}`, display: "flex", justifyContent: "space-around", alignItems: "center", fontSize: 12, fontWeight: 600 }}>
      {[
        { Icon: Bike, t: "Deliveries" },
        { Icon: ReceiptText, t: "Today" },
        { Icon: Settings, t: "Settings" },
      ].map(({ Icon, t }, i) => (
        <span key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: i ? S.mutedFg : S.fg }}>
          <Icon size={22} />
          {tr(t)}
        </span>
      ))}
    </div>
  </div>
  );
};

// ——— The scene ————————————————————————————————————————————————————

type Props = {
  readonly headline: string;
  readonly features: string;
  readonly style?: React.CSSProperties;
};

const LABELS_AR: Record<string, string> = {
  Dashboard: "لوحة التحكم",
  Till: "الكاشير",
  "Kitchen display": "شاشة المطبخ",
  "Guest app · iOS, Android, web": "أبلكيشن العميل · آيفون وأندرويد وويب",
  "Rider app": "أبلكيشن الطيار",
};

const IntroInner: React.FC<Props> = ({ headline: h, features: f, style }) => {
  const frame = useCurrentFrame();
  const ar = useLang() === "ar";
  const headline = ar ? AR.introHeadline : h;
  const features = (ar ? AR.introFeatures : f).split(" · ");
  const font = ar ? plexArabic : inter;
  const label = (t: string) => (ar ? LABELS_AR[t] : t);

  const Tag: React.FC<{ text: string; x: number; y: number; at: number }> = ({ text, x, y, at }) => (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: "-50% 0px",
        padding: "8px 18px",
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(15,23,42,0.08)",
        boxShadow: "0 10px 24px -14px rgba(15,23,42,0.35)",
        fontFamily: font,
        direction: ar ? "rtl" : "ltr",
        fontSize: 21,
        fontWeight: 600,
        color: C.ink,
        whiteSpace: "nowrap",
        zIndex: 20,
        opacity: interpolate(frame, [at, at + 10], [0, 1], clamp),
      }}
    >
      {label(text)}
    </div>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#f5f5f4", ...style }}>
      {/* Studio light and floor */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 55% at 50% 38%, #ffffff 0%, #f5f5f4 60%, #e7e5e4 100%)" }} />
      <div
        style={{
          position: "absolute",
          left: 200,
          right: 200,
          top: 960,
          height: 60,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(15,23,42,0.18), transparent 70%)",
        }}
      />

      <div style={{ position: "absolute", top: 54, left: 70, display: "flex", alignItems: "center", gap: 12, opacity: interpolate(frame, [0, 12], [0, 1], clamp) }}>
        <NMark size={40} />
        <Wordmark size={42} color={C.ink} />
      </div>

      <AbsoluteFill style={{ scale: `${interpolate(frame, [0, 240], [1, 1.04])}` }}>
        <div style={{ position: "absolute", top: 48, left: 0, right: 0, display: "flex", justifyContent: "center", fontFamily: font, direction: ar ? "rtl" : "ltr" }}>
          <Reveal at={4}>
            <div style={{ fontSize: ar ? 80 : 88, fontWeight: 700, letterSpacing: ar ? 0 : "-0.04em", color: C.ink }}>{headline}</div>
          </Reveal>
        </div>

        {/* Back row: till · dashboard · kitchen */}
        <Screen x={110} y={410} width={560} logical={[1280, 800]} font={inter} style={useRiseIn(22)}>
          <TillMini />
        </Screen>
        <Screen x={1250} y={410} width={560} logical={[1280, 800]} font={inter} style={useRiseIn(30)}>
          <KitchenMini />
        </Screen>
        <Screen x={600} y={278} width={720} logical={[1280, 800]} style={useRiseIn(12)}>
          <AdminMini />
        </Screen>

        {/* Front row: the guest's phone and the rider's */}
        <GuestPhone x={500} y={500} height={500} style={useRiseIn(40)}>
          <MenuScreen />
          <Dock />
        </GuestPhone>
        <GuestPhone x={1190} y={500} height={500} font={inter} style={useRiseIn(48)}>
          <RiderMini />
        </GuestPhone>

        <Tag text="Dashboard" x={960} y={232} at={26} />
        <Tag text="Till" x={390} y={364} at={36} />
        <Tag text="Kitchen display" x={1530} y={364} at={44} />
        <Tag text="Guest app · iOS, Android, web" x={616} y={1012} at={54} />
        <Tag text="Rider app" x={1306} y={1012} at={62} />
      </AbsoluteFill>

      {/* The features, one quiet line under the title */}
      <div
        style={{
          position: "absolute",
          top: 162,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 22,
          fontFamily: font,
          direction: ar ? "rtl" : "ltr",
          fontSize: 26,
          fontWeight: 600,
          color: "#57534e",
          scale: `${interpolate(frame, [0, 240], [1, 1.04])}`,
        }}
      >
        {features.map((w, i) => (
          <span key={w} style={{ display: "flex", alignItems: "center", gap: 22 }}>
            {i ? <span style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#a8a29e" }} /> : null}
            <Reveal at={70 + i * 5}>{w}</Reveal>
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const schema = {
  headline: { type: "text-content", default: "Your whole café, in one place.", description: "Headline" },
  features: {
    type: "text-content",
    default: "Ordering · Payments · Reservations · Loyalty · Delivery · Stock · Profit",
    description: "Features, separated by ' · '",
  },
} as const satisfies InteractivitySchema;

export const Intro = Interactive.withSchema({
  Component: IntroInner,
  componentName: "<Intro>",
  schema,
  wrapInSequence: true,
});
