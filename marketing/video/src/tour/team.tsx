// Chapters 06–09: the team's side (till, kitchen, delivery with the rider app, branches).
import {
  Bike,
  Building2,
  Check,
  ChefHat,
  ChevronRight,
  House,
  MapPin,
  MessageSquare,
  Navigation,
  Phone as PhoneIcon,
  ReceiptText,
  Settings,
  Undo2,
} from "lucide-react";
import type React from "react";
import { AbsoluteFill, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, glide, inter, land } from "../theme";
import { Chapter, copySchema, Glass, useEnter, type ChapterProps } from "./chapter";
import { MenuScreen } from "./menu-screen";
import { AdminButton, AdminShell, BillRow, Dish, DISHES, Dock, GuestPhone, S, Screen, Touch } from "./ui";

// ——— 06 Till ————————————————————————————————————————————————————

const PRODUCTS: { name: string; price: number; img: string }[] = [
  DISHES.latte,
  DISHES.mocha,
  DISHES.cappuccino,
  DISHES.waffle,
  DISHES.cake,
  DISHES.lemonade,
  { name: "Flat White", price: 70, img: "flatwhite" },
  { name: "Hot Chocolate", price: 80, img: "hotchoc" },
  { name: "Espresso", price: 50, img: "espresso" },
  { name: "Turkish Coffee", price: 45, img: "turkish" },
  { name: "Milkshake", price: 90, img: "milkshake" },
  { name: "Water", price: 15, img: "water" },
];
const cardAt = (i: number) => ({ x: 16 + (i % 6) * 152, y: 80 + Math.floor(i / 6) * 172 });

const TillInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const taps = [
    { i: 0, at: 40 },
    { i: 2, at: 70 },
    { i: 5, at: 100 },
  ];
  const charge = 150;
  const lines = taps.filter((t) => frame >= t.at + 2).map((t) => PRODUCTS[t.i]);
  const total = lines.reduce((s, p) => s + p.price, 0);

  return (
    <Chapter
      look="dark"
      n="06"
      eyebrow="For your team"
      title={title}
      mark="minute."
      line={line}
      chips={["Rounds by guest", "Shifts", "Refunds", "Delivery orders"]}
      style={style}
      copyWidth={640}
    >
      <Screen x={830} y={200} width={980} logical={[1280, 800]} font={inter} style={useEnter(4)}>
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "0 20px",
            borderBottom: `1px solid ${S.border}`,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 800 }}>Till</div>
          <div style={{ display: "flex", gap: 6, padding: 4, borderRadius: 12, backgroundColor: S.muted }}>
            {["Sale", "Open bills"].map((t, i) => (
              <div
                key={t}
                style={{
                  padding: "8px 16px",
                  borderRadius: 9,
                  fontSize: 14,
                  fontWeight: 600,
                  backgroundColor: i === 0 ? "#fff" : "transparent",
                  color: i === 0 ? S.fg : S.mutedFg,
                }}
              >
                {t}
              </div>
            ))}
          </div>
          <div style={{ marginLeft: "auto", fontSize: 14, color: S.mutedFg }}>Nour · Shift open since 9:00 AM</div>
        </div>
        {PRODUCTS.map((p, i) => {
          const { x, y } = cardAt(i);
          const hit = taps.find((t) => t.i === i);
          return (
            <div
              key={p.name}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: 140,
                padding: 8,
                borderRadius: 14,
                border: `1px solid ${S.border}`,
                backgroundColor: "#fff",
                boxShadow: "0 1px 2px rgb(0 0 0 / .05)",
                scale: hit ? interpolate(frame, [hit.at, hit.at + 3, hit.at + 12], [1, 0.93, 1], clamp) : undefined,
              }}
            >
              <Dish img={p.img} size="100%" ratio="4 / 3" radius={10} />
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: S.mutedFg }}>{p.price}</div>
            </div>
          );
        })}
        <div
          style={{
            position: "absolute",
            top: 64,
            right: 0,
            bottom: 0,
            width: 370,
            borderLeft: `1px solid ${S.border}`,
            padding: 18,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Current sale</div>
            <div style={{ fontSize: 13, color: S.mutedFg }}>
              {lines.length} {lines.length === 1 ? "line" : "lines"}
            </div>
          </div>
          <div style={{ fontSize: 13, color: S.mutedFg, marginTop: 14 }}>Whose round?</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {["Table 3", "Someone else"].map((c, i) => (
              <div
                key={c}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  backgroundColor: i === 0 ? S.primary : S.muted,
                  color: i === 0 ? "#fff" : S.fg,
                }}
              >
                {c}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {lines.map((p) => (
              <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{p.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700 }}>
                  <span style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: S.muted, display: "grid", placeItems: "center" }}>−</span>
                  1
                  <span style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: S.muted, display: "grid", placeItems: "center" }}>+</span>
                </div>
                <div style={{ width: 44, textAlign: "right", fontSize: 15, fontWeight: 600 }}>{p.price}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "auto" }}>
            <div
              style={{
                height: 44,
                borderRadius: 12,
                border: `1px solid ${S.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <Bike size={16} /> Delivery
            </div>
            <div
              style={{
                marginTop: 10,
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
                scale: interpolate(frame, [charge, charge + 3, charge + 12], [1, 0.96, 1], clamp),
              }}
            >
              <span>Charge</span>
              <span>EGP {total}</span>
            </div>
          </div>
        </div>
        {taps.map((t) => (
          <Touch key={t.i} x={cardAt(t.i).x + 70} y={cardAt(t.i).y + 60} at={t.at} size={48} />
        ))}
        <Touch x={1095} y={756} at={charge} size={48} />
        <AbsoluteFill
          style={{
            backgroundColor: "rgba(255,255,255,0.94)",
            justifyContent: "center",
            alignItems: "center",
            gap: 14,
            opacity: interpolate(frame, [charge + 8, charge + 14], [0, 1], clamp),
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              backgroundColor: S.emerald,
              display: "grid",
              placeItems: "center",
              scale: interpolate(frame, [charge + 10, charge + 26], [0, 1], { ...clamp, easing: land }),
            }}
          >
            <Check size={52} color="#fff" strokeWidth={3} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>Paid · EGP {total}</div>
          <div style={{ fontSize: 16, color: S.mutedFg }}>Cash · receipt printed</div>
        </AbsoluteFill>
      </Screen>
    </Chapter>
  );
};

export const Till = Interactive.withSchema({
  Component: TillInner,
  componentName: "<Till>",
  schema: copySchema(
    "A till your staff learn in a minute.",
    "Tap to sell, split rounds by who's paying, and close the shift with the drawer counted.",
  ),
  wrapInSequence: true,
});

// ——— 07 Kitchen ——————————————————————————————————————————————————

type Ticket = {
  n: string;
  channel: string;
  time: string;
  name: string;
  lines: [number, string][];
  note?: string;
  age: "fresh" | "amber" | "late";
};
const TICKETS: Ticket[] = [
  { n: "#41", channel: "Counter", time: "2:35", name: "Walk-in", lines: [[2, "Flat White"], [1, "Espresso"]], age: "fresh" },
  { n: "#38", channel: "Table 7", time: "6:10", name: "Karim", lines: [[2, "Iced Mocha"], [1, "Chocolate Cake"]], age: "amber" },
  { n: "#35", channel: "Pickup", time: "11:02", name: "Salma", lines: [[1, "Waffle"], [1, "Lemonade"]], age: "late" },
];

const TicketCard: React.FC<{ t: Ticket; ready?: boolean; style?: React.CSSProperties; pressAt?: number }> = ({
  t,
  ready,
  style,
  pressAt,
}) => {
  const frame = useCurrentFrame();
  const band = ready
    ? { bg: "rgba(16,185,129,0.15)", fg: "#047857" }
    : t.age === "late"
      ? { bg: "rgba(220,38,38,0.1)", fg: S.red }
      : t.age === "amber"
        ? { bg: "rgba(245,158,11,0.15)", fg: "#b45309" }
        : { bg: "rgba(241,245,249,0.5)", fg: S.fg };
  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        width: 256,
        borderRadius: 14,
        border: `1px solid ${t.age === "late" && !ready ? "rgba(220,38,38,0.5)" : S.border}`,
        backgroundColor: "#fff",
        overflow: "hidden",
        ...style,
      }}
    >
      <div style={{ padding: "12px 14px", backgroundColor: band.bg, color: band.fg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{t.n}</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.7)",
              color: S.fg,
            }}
          >
            {t.channel}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {ready ? "Ready" : t.time}
          </span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: S.fg, marginTop: 4 }}>{t.name}</div>
      </div>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {t.lines.map(([q, name]) => (
          <div key={name} style={{ display: "flex", gap: 10, fontSize: 16 }}>
            <span style={{ fontWeight: 800, width: 18 }}>{q}</span>
            <span style={{ fontWeight: 600 }}>{name}</span>
          </div>
        ))}
        {t.note ? <div style={{ fontSize: 14, fontWeight: 600, color: "#b45309" }}>{t.note}</div> : null}
      </div>
      <div style={{ padding: "0 14px 14px" }}>
        <div
          style={{
            height: 48,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontSize: 15,
            fontWeight: 700,
            backgroundColor: ready ? S.muted : S.primary,
            color: ready ? S.fg : "#fff",
            scale:
              pressAt !== undefined ? interpolate(frame, [pressAt, pressAt + 3, pressAt + 12], [1, 0.94, 1], clamp) : undefined,
          }}
        >
          {ready ? <Undo2 size={16} /> : <Check size={16} />}
          {ready ? "Bring back" : "Ready"}
        </div>
      </div>
    </div>
  );
};

const KitchenInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const arrive = 26;
  const ready = 140;
  const push = interpolate(frame, [arrive, arrive + 14], [0, 268], { ...clamp, easing: glide });
  const secs = Math.max(0, Math.floor((frame - arrive) / fps));
  const fresh: Ticket = {
    n: "#42",
    channel: "Table 3",
    time: `0:${String(secs).padStart(2, "0")}`,
    name: "Table 3",
    lines: [
      [1, "Latte"],
      [1, "Waffle"],
    ],
    note: "Extra chocolate, please",
    age: "fresh",
  };

  return (
    <Chapter
      look="dark"
      n="07"
      eyebrow="For your team"
      title={title}
      mark="instantly."
      line={line}
      chips={["Colour by wait time", "Notes in amber", "Ready in one tap"]}
      style={style}
      copyWidth={640}
    >
      <Screen x={830} y={210} width={980} logical={[1100, 560]} font={inter} screen="#f8fafc" style={useEnter(4)}>
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 20px",
            backgroundColor: "#fff",
            borderBottom: `1px solid ${S.border}`,
          }}
        >
          <ChefHat size={22} />
          <div style={{ fontSize: 20, fontWeight: 800 }}>Kitchen</div>
          <div style={{ marginLeft: "auto", fontSize: 14, color: S.mutedFg }}>
            {frame >= arrive ? 4 : 3} to prepare
          </div>
        </div>
        {TICKETS.map((t, i) => (
          <TicketCard key={t.n} t={t} style={{ left: 16 + i * 268 + push }} />
        ))}
        <TicketCard
          t={fresh}
          ready={frame >= ready + 2}
          pressAt={ready}
          style={{
            left: 16,
            opacity: interpolate(frame, [arrive, arrive + 6], [0, 1], clamp),
            translate: interpolate(frame, [arrive, arrive + 18], ["0px -200px", "0px 0px"], { ...clamp, easing: land }),
            boxShadow: `0 0 ${interpolate(frame, [arrive + 10, arrive + 24, arrive + 50], [0, 40, 0], clamp)}px rgba(245,158,11,0.9)`,
          }}
        />
        <Touch x={144} y={80 + 82 + 108 + 38} at={ready} size={48} />
      </Screen>
    </Chapter>
  );
};

export const Kitchen = Interactive.withSchema({
  Component: KitchenInner,
  componentName: "<Kitchen>",
  schema: copySchema(
    "The kitchen sees it instantly.",
    "Tickets change colour as they wait, so nothing is forgotten on a busy night.",
  ),
  wrapInSequence: true,
});

// ——— 08 Delivery ————————————————————————————————————————————————

const DeliveryInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const onTheWay = 96;
  const delivered = 214;
  const out = frame >= onTheWay + 2;
  const done = frame >= delivered + 2;
  const stage = done
    ? { label: "Delivered", bg: "rgba(16,185,129,0.12)", fg: "#047857" }
    : out
      ? { label: "On the way", bg: "rgba(2,132,199,0.12)", fg: "#0284c7" }
      : { label: "Ready to go", bg: "rgba(16,185,129,0.12)", fg: "#047857" };
  const row = done ? (
    <BillRow Icon={House} tone={S.emerald} line="Delivered · #1042" total="EGP 210" pill="Your order" />
  ) : out ? (
    <BillRow Icon={Bike} tone="#0284c7" line="On its way · #1042" total="EGP 210" pill="Your order" />
  ) : (
    <BillRow Icon={ChefHat} tone={S.emerald} line="Being made · #1042" total="EGP 210" pill="Your order" />
  );

  return (
    <Chapter
      look="light"
      n="08"
      eyebrow="For your team"
      title={title}
      mark="own riders."
      line={line}
      chips={["Rider app", "Cash to collect", "Live status for the guest"]}
      style={style}
      copyWidth={640}
    >
      {/* The rider's phone (rider_app, Flutter, slate) */}
      <GuestPhone x={880} y={90} height={900} font={inter} screen="#f8fafc" style={useEnter(4)}>
        <div style={{ position: "absolute", top: 60, left: 16, right: 16 }}>
          <div style={{ fontSize: 26, fontWeight: 800 }}>Deliveries</div>
          <div
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 16,
              border: `1px solid ${S.border}`,
              backgroundColor: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: S.emerald }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#059669" }}>On duty</div>
              <div style={{ fontSize: 12, color: S.mutedFg }}>While you are on duty the till can give you deliveries.</div>
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              padding: 16,
              borderRadius: 20,
              backgroundColor: "#fff",
              border: `1px solid ${out && !done ? "#0284c7" : S.border}`,
              boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
            }}
          >
            <div style={{ fontSize: 13, color: S.mutedFg }}>Order #1042</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>Mona Adel</div>
              <div
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor: stage.bg,
                  color: stage.fg,
                }}
              >
                {stage.label}
              </div>
            </div>
            {[
              { Icon: MapPin, text: "12 Brazil St, Zamalek · 2nd floor" },
              { Icon: MessageSquare, text: "Ring twice, please" },
            ].map(({ Icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 14 }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: S.muted, display: "grid", placeItems: "center" }}>
                  <Icon size={16} />
                </span>
                {text}
              </div>
            ))}
            <div style={{ fontSize: 12, color: S.mutedFg, marginTop: 12 }}>In the bag</div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {["1× Latte", "1× Waffle"].map((c) => (
                <span key={c} style={{ padding: "4px 10px", borderRadius: 999, backgroundColor: S.muted, fontSize: 12, fontWeight: 600 }}>
                  {c}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: S.muted }}>
              <div style={{ fontSize: 12, color: S.mutedFg }}>Cash to collect</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>EGP 210</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {[
                { Icon: Navigation, t: "Navigate" },
                { Icon: PhoneIcon, t: "Call" },
              ].map(({ Icon, t }) => (
                <div
                  key={t}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 12,
                    border: `1px solid ${S.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  <Icon size={15} /> {t}
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 10,
                height: 60,
                borderRadius: 14,
                backgroundColor: done ? S.emerald : S.primary,
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 17,
                fontWeight: 700,
              }}
            >
              {done ? "Delivered ✓" : out ? "Delivered" : "I'm on the way"}
            </div>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 74,
            backgroundColor: "#fff",
            borderTop: `1px solid ${S.border}`,
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {[
            { Icon: Bike, t: "Deliveries", on: true },
            { Icon: ReceiptText, t: "Today", on: false },
            { Icon: Settings, t: "Settings", on: false },
          ].map(({ Icon, t, on }) => (
            <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: on ? S.fg : S.mutedFg }}>
              <span
                style={{
                  width: 60,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: on ? S.muted : "transparent",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Icon size={22} />
              </span>
              {t}
            </div>
          ))}
        </div>
        <Touch x={195} y={658} at={onTheWay} />
        <Touch x={195} y={658} at={delivered} />
      </GuestPhone>

      {/* The guest's phone: the dock follows the order */}
      <GuestPhone x={1380} y={90} height={900} style={useEnter(12)}>
        <MenuScreen />
        <Dock row={row} rowAt={-20} />
      </GuestPhone>
    </Chapter>
  );
};

export const Delivery = Interactive.withSchema({
  Component: DeliveryInner,
  componentName: "<Delivery>",
  schema: copySchema(
    "Deliver with your own riders.",
    "No commission. Riders get their own app, and guests watch their order come to the door.",
  ),
  wrapInSequence: true,
});

// ——— 09 Branches ————————————————————————————————————————————————

const BRANCHES = [
  { name: "Zamalek", status: "Taking orders", facts: ["Reservations Enabled", "Day starts 6:00 AM"] },
  { name: "Maadi", status: "Taking orders", facts: ["Reservations Enabled", "Day starts 7:00 AM"] },
  { name: "New Cairo", status: "QR orders off", facts: ["Day starts 8:00 AM"] },
];

const BranchesInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  return (
    <Chapter
      look="light"
      n="09"
      eyebrow="For your business"
      title={title}
      mark="dashboard."
      line={line}
      chips={["Prices per branch", "Hours per branch", "Nearest branch"]}
      style={style}
      copyWidth={640}
    >
      <Screen x={830} y={170} width={980} logical={[1280, 800]} style={useEnter(4)}>
        <AdminShell
          active="Branches"
          crumb="Business"
          title="Branches"
          actions={<AdminButton primary>+ Create Branch</AdminButton>}
        >
          <div style={{ borderRadius: 14, border: `1px solid ${S.border}`, overflow: "hidden" }}>
            {BRANCHES.map((b, i) => (
              <div
                key={b.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 20px",
                  borderTop: i ? `1px solid ${S.border}` : undefined,
                  opacity: interpolate(frame, [14 + i * 6, 22 + i * 6], [0, 1], clamp),
                  translate: interpolate(frame, [14 + i * 6, 30 + i * 6], ["0px 16px", "0px 0px"], { ...clamp, easing: glide }),
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: S.muted, display: "grid", placeItems: "center" }}>
                  <Building2 size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{b.name}</div>
                  <div style={{ display: "flex", gap: 12, fontSize: 13, color: S.mutedFg, marginTop: 2 }}>
                    <span style={{ color: b.status === "Taking orders" ? S.success : S.mutedFg, fontWeight: 600 }}>{b.status}</span>
                    {b.facts.map((f) => (
                      <span key={f}>· {f}</span>
                    ))}
                  </div>
                </div>
                <ChevronRight size={18} color={S.mutedFg} />
              </div>
            ))}
          </div>
        </AdminShell>
      </Screen>
      <Glass
        style={{
          left: 1180,
          top: 700,
          width: 520,
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          gap: 20,
          fontFamily: inter,
          opacity: interpolate(frame, [70, 78], [0, 1], clamp),
          scale: interpolate(frame, [70, 90], [0.7, 1], { ...clamp, easing: land }),
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: S.primary,
            display: "grid",
            placeItems: "center",
          }}
        >
          <MapPin size={30} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 20, color: S.mutedFg, fontWeight: 600 }}>Guest's nearest branch</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: S.fg }}>Maadi · 1.2 km</div>
        </div>
      </Glass>
    </Chapter>
  );
};

export const Branches = Interactive.withSchema({
  Component: BranchesInner,
  componentName: "<Branches>",
  schema: copySchema(
    "Every branch, one dashboard.",
    "Each branch keeps its own prices and hours. Guests are sent to the one nearest them.",
  ),
  wrapInSequence: true,
});
