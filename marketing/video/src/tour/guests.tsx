// Chapters 01, 02 and 05: what the guest sees (brand, table ordering, loyalty).
import { Award, Check, ChefHat, Send } from "lucide-react";
import type React from "react";
import { AbsoluteFill, Interactive, interpolate, useCurrentFrame } from "remotion";
import { clamp, glide, jakarta, land } from "../theme";
import type { Dishkey } from "./menu-screen";
import { Chapter, copySchema, Glass, useEnter, type ChapterProps } from "./chapter";
import { MenuScreen } from "./menu-screen";
import { BillRow, Dish, DISHES, Dock, GuestPhone, PageTitle, S, TopBar, Touch } from "./ui";
import { useLang, useT } from "./lang";

const PHONE = { x: 1330, y: 70, height: 940 } as const;

// ——— 01 Your brand ——————————————————————————————————————————————

const THEMES = [
  { name: "Slate", primary: "#0f172a", slab: "#020617" },
  { name: "Teal", primary: "#0f766e", slab: "#06302c" },
  { name: "Terracotta", primary: "#c2410c", slab: "#3b1206" },
  { name: "Plum", primary: "#7e22ce", slab: "#2a0b45" },
  { name: "Olive", primary: "#4d7c0f", slab: "#1d2c07" },
];

const BrandInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const tr = useT();
  const pick = frame >= 152 ? 2 : frame >= 92 ? 1 : 0;
  const theme = THEMES[pick];
  const grid = frame >= 212;
  return (
    <Chapter
      look="glass"
      n="01"
      eyebrow="Your café, your look"
      title={title}
      mark="your café."
      line={line}
      chips={["Your logo", "Your colours", "6 menu layouts", "Arabic & English"]}
      style={style}
      copyWidth={680}
    >
      <GuestPhone {...PHONE} label="Mobile app & web" style={useEnter(4)}>
        <MenuScreen
          layout={grid ? "grid" : "row"}
          primary={theme.primary}
          brandColor={theme.primary}
          enterAt={grid ? 212 : -100}
        />
        <Dock slab={theme.slab} />
      </GuestPhone>

      <Glass style={{ left: 880, top: 270, width: 420, padding: 30, fontFamily: jakarta, ...useEnter(14, 160) }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: S.fg }}>{tr("Theme")}</div>
        <div style={{ fontSize: 17, color: S.mutedFg, marginTop: 22 }}>{tr("Brand color")}</div>
        <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
          {THEMES.map((t, i) => (
            <div
              key={t.name}
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                backgroundColor: t.primary,
                boxShadow: i === pick ? `0 0 0 4px #fff, 0 0 0 7px ${t.primary}` : undefined,
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 17, color: S.mutedFg, marginTop: 26 }}>{tr("Dock")}</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: S.fg, marginTop: 6 }}>{tr("A deep shade of the brand colour")}</div>
        <div style={{ fontSize: 17, color: S.mutedFg, marginTop: 26 }}>{tr("Menu")}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          {["Classic list", "Photo grid"].map((m, i) => {
            const on = (i === 1) === grid;
            return (
              <div
                key={m}
                style={{
                  padding: "12px 18px",
                  borderRadius: 999,
                  fontSize: 18,
                  fontWeight: 700,
                  backgroundColor: on ? theme.primary : "rgba(255,255,255,0.8)",
                  color: on ? "#fff" : S.fg,
                }}
              >
                {tr(m)}
              </div>
            );
          })}
        </div>
        <Touch x={122} y={141} at={90} size={56} />
        <Touch x={188} y={141} at={150} size={56} />
        <Touch x={246} y={322} at={210} size={56} />
      </Glass>
    </Chapter>
  );
};

export const Brand = Interactive.withSchema({
  Component: BrandInner,
  componentName: "<Brand>",
  schema: copySchema(
    "It looks like your café.",
    "Set your logo, colours and menu layout. The guest app changes as you choose.",
  ),
  wrapInSequence: true,
});

// ——— 02 Order at the table ————————————————————————————————————————

const QR = Array.from({ length: 21 * 21 }, (_, k) => {
  const x = k % 21;
  const y = Math.floor(k / 21);
  const finder = (fx: number, fy: number) => {
    const dx = x - fx;
    const dy = y - fy;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
    return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
  };
  const f = finder(0, 0) ?? finder(14, 0) ?? finder(0, 14);
  return f !== null ? f : (x * 7 + y * 13 + x * y * 3) % 5 < 2;
});

const TrayRow: React.FC<{ items: string[]; count: number; total: number; button: string }> = ({
  items,
  count,
  total,
  button,
}) => {
  const tr = useT();
  return (
  <div style={{ height: 68, display: "flex", alignItems: "center", gap: 12, padding: "0 12px" }}>
    <div style={{ display: "flex" }}>
      {items.map((k, i) => {
        const d = DISHES[k as keyof typeof DISHES];
        return (
          <Dish key={k} img={d.img} size={44} radius={22} style={{ marginLeft: i ? -12 : 0, border: "2px solid #020617" }} />
        );
      })}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        {tr(`${count} ${count === 1 ? "item" : "items"}`)}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{tr(`EGP ${total}`)}</div>
    </div>
    <div
      style={{
        height: 48,
        padding: "0 20px",
        borderRadius: 24,
        backgroundColor: "#fff",
        color: S.fg,
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 15,
        fontWeight: 700,
      }}
    >
      {button === "Place Order" ? <Check size={16} /> : null}
      {tr(button)}
    </div>
  </div>
  );
};

// The dish photo flies from its row into the dock (client_app tray_flights: 620 ms,
// closes to a circle, arcs up, lands at thumbnail size with a bump).
const Flight: React.FC<{ dish: Dishkey; row: number; slot: number; at: number }> = ({ dish, row, slot, at }) => {
  const frame = useCurrentFrame();
  const ar = useLang() === "ar";
  const t = interpolate(frame, [at + 1, at + 20], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 2.4) });
  if (frame < at + 1 || frame > at + 22) return null;
  const from = { x: ar ? 390 - 16 - 80 : 16, y: 152 + row * 96, s: 80 };
  const to = { x: ar ? 390 - 24 - slot * 32 - 44 : 24 + slot * 32, y: 712 + 12, s: 44 };
  const arc = Math.min(90, Math.abs(to.y - from.y) * 0.25) * Math.sin(Math.PI * t);
  const size = from.s + (to.s - from.s) * t;
  return (
    <Dish
      img={DISHES[dish].img}
      size={size}
      radius={interpolate(t, [0, 0.45], [20, size / 2], clamp)}
      style={{
        position: "absolute",
        left: from.x + (to.x - from.x) * t,
        top: from.y + (to.y - from.y) * t - arc,
        zIndex: 30,
        boxShadow: "0 12px 30px -8px rgba(0,0,0,0.45)",
      }}
    />
  );
};

// "Your order" rises out of the dock (client_app tray.dart), clipped at the row's top.
const TraySheet: React.FC<{ openAt: number; closeAt: number; lines: Dishkey[] }> = ({ openAt, closeAt, lines }) => {
  const frame = useCurrentFrame();
  const tr = useT();
  const up =
    interpolate(frame, [openAt, openAt + 12], [0, 1], { ...clamp, easing: land }) *
    interpolate(frame, [closeAt - 8, closeAt], [1, 0], clamp);
  if (up <= 0) return null;
  return (
    <>
      <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${0.4 * up})` }} />
      <div
        style={{
          position: "absolute",
          left: 8,
          right: 8,
          bottom: 8 + 124 - 28,
          height: 210 * up + 28,
          borderRadius: "28px 28px 0 0",
          backgroundColor: S.slab,
          color: "#fff",
          overflow: "hidden",
          padding: "20px 18px 0",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800 }}>{tr("Your order")}</div>
        {lines.map((k) => {
          const d = DISHES[k];
          return (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
              <Dish img={d.img} size={48} radius={24} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{tr(d.name)}</div>
                <div style={{ fontSize: 13, opacity: 0.6 }}>{tr(d.note)}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{d.price}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700 }}>
                <span style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.1)", display: "grid", placeItems: "center" }}>−</span>
                1
                <span style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.1)", display: "grid", placeItems: "center" }}>+</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

const OrderInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const tr = useT();
  const scanned = 54;
  const addLatte = 100;
  const addClub = 140;
  const order = 186;
  const place = 222;
  const sent = 240;
  const making = 290;
  const items = frame >= addClub + 2 ? ["latte", "waffle"] : ["latte"];
  const total = frame >= addClub + 2 ? 185 : 75;
  const counts = {
    latte: frame >= addLatte + 2 ? 1 : 0,
    waffle: frame >= addClub + 2 ? 1 : 0,
  };
  const row =
    frame >= making ? (
      <BillRow Icon={ChefHat} tone={S.emerald} line="Being made · #42" total="EGP 185" />
    ) : frame >= sent ? (
      <BillRow Icon={Send} tone="rgba(255,255,255,0.12)" line="Sent · #42" total="EGP 185" />
    ) : (
      <TrayRow
        items={items}
        count={items.length}
        total={total}
        button={frame >= place ? "Sending…" : frame >= order + 2 ? "Place Order" : "Order"}
      />
    );

  return (
    <Chapter
      look="light"
      n="02"
      eyebrow="For your guests"
      title={title}
      mark="table."
      line={line}
      chips={["No app to install", "No account", "Notes & options", "Arabic & English"]}
      style={style}
    >
      <GuestPhone {...PHONE} label="Web · nothing to install" style={useEnter(4)}>
        <MenuScreen counts={counts} enterAt={scanned} offer="cappuccino" />
        <TraySheet openAt={order + 2} closeAt={sent} lines={["latte", "waffle"]} />
        <Dock row={row} rowAt={addLatte + 10} />
        <Flight dish="latte" row={0} slot={0} at={addLatte} />
        <Flight dish="waffle" row={3} slot={1} at={addClub} />
        <Touch x={352} y={192} at={addLatte} />
        <Touch x={352} y={480} at={addClub} />
        <Touch x={318} y={746} at={order} />
        <Touch x={300} y={746} at={place} />

        {/* The camera on the table's QR */}
        <AbsoluteFill
          style={{
            backgroundColor: "#0b0d12",
            justifyContent: "center",
            alignItems: "center",
            opacity: interpolate(frame, [scanned - 4, scanned + 2], [1, 0], clamp),
          }}
        >
          <div
            style={{
              position: "relative",
              width: 230,
              height: 230,
              padding: 18,
              borderRadius: 22,
              backgroundColor: "#fff",
              display: "grid",
              gridTemplateColumns: "repeat(21, 1fr)",
              scale: interpolate(frame, [8, 50], [0.85, 1.05], clamp),
            }}
          >
            {QR.map((on, k) => (
              <div key={k} style={{ backgroundColor: on ? S.fg : "transparent" }} />
            ))}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#14b8a6",
                boxShadow: "0 0 24px #14b8a6",
                top: interpolate(frame, [10, 30, 50], [14, 212, 14], clamp),
              }}
            />
          </div>
          <div style={{ color: "#fff", fontSize: 18, fontWeight: 600, marginTop: 26 }}>{tr("Table 3")}</div>
        </AbsoluteFill>
        <AbsoluteFill
          style={{
            backgroundColor: "#fff",
            opacity: interpolate(frame, [scanned - 2, scanned, scanned + 8], [0, 0.9, 0], clamp),
          }}
        />
      </GuestPhone>
    </Chapter>
  );
};

export const Order = Interactive.withSchema({
  Component: OrderInner,
  componentName: "<Order>",
  schema: copySchema(
    "Guests order from the table.",
    "They scan the QR on the table and order in seconds. It lands on the till and in the kitchen.",
  ),
  wrapInSequence: true,
});

// ——— 05 Loyalty ——————————————————————————————————————————————————

const LoyaltyInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const tr = useT();
  const grow = interpolate(frame, [30, 90], [0, 1], { ...clamp, easing: glide });
  const points = Math.round(interpolate(grow, [0, 1], [1100, 1320]));
  const ring = interpolate(grow, [0, 1], [0.55, 0.88]);
  const r = 66;
  const circ = 2 * Math.PI * r;
  const activity = [
    { what: "Order at Table 3", when: "Today · 8:40 PM", pts: "+120", plus: true },
    { what: "Room 1 · 2 hours", when: "Today · 6:15 PM", pts: "+90", plus: true },
    { what: "Free Latte", when: "Yesterday", pts: "−50", plus: false },
  ];

  return (
    <Chapter
      look="glass"
      n="05"
      eyebrow="For your guests"
      title={title}
      mark="points."
      line={line}
      chips={["Points", "Tiers", "Rewards you choose"]}
      style={style}
    >
      <GuestPhone {...PHONE} label="Mobile app" style={useEnter(4)}>
        <TopBar />
        <PageTitle title="Loyalty Rewards" />
        <div
          style={{
            position: "absolute",
            top: 170,
            left: 16,
            right: 16,
            borderRadius: 28,
            padding: "28px 20px",
            backgroundColor: S.slab,
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", width: 148, height: 148 }}>
            <svg width={148} height={148} style={{ rotate: "-90deg" }}>
              <circle cx={74} cy={74} r={r} stroke="rgba(255,255,255,0.14)" strokeWidth={8} fill="none" />
              <circle
                cx={74}
                cy={74}
                r={r}
                stroke={S.amber400}
                strokeWidth={8}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - ring)}
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{points.toLocaleString("en-US")}</div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>{tr("pts")}</div>
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              backgroundColor: "rgba(251,191,36,0.15)",
              color: "#fcd34d",
            }}
          >
            <Award size={14} /> {tr("GOLD")}
          </div>
          <div style={{ fontSize: 14, opacity: 0.7, marginTop: 10 }}>
            {Math.max(0, 1500 - points)} pts to Platinum
          </div>
        </div>
        <div style={{ position: "absolute", top: 470, left: 16, right: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: S.mutedFg, marginBottom: 10 }}>{tr("Recent Activity")}</div>
          <div style={{ borderRadius: 24, backgroundColor: S.muted, padding: "6px 16px" }}>
            {activity.map((a, i) => (
              <div
                key={a.what}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderTop: i ? `1px solid ${S.border}` : undefined,
                  opacity: interpolate(frame, [20 + i * 8, 28 + i * 8], [0, 1], clamp),
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{a.what}</div>
                  <div style={{ fontSize: 13, color: S.mutedFg }}>{a.when}</div>
                </div>
                <div
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 800,
                    backgroundColor: a.plus ? "rgba(5,150,105,0.1)" : "rgba(220,38,38,0.1)",
                    color: a.plus ? "#059669" : S.red,
                  }}
                >
                  {a.pts}
                </div>
              </div>
            ))}
          </div>
        </div>
        <Dock active="You" />
      </GuestPhone>
    </Chapter>
  );
};

export const Loyalty = Interactive.withSchema({
  Component: LoyaltyInner,
  componentName: "<Loyalty>",
  schema: copySchema(
    "Every visit earns points.",
    "Guests watch their points and tier grow, and come back for the rewards you choose.",
  ),
  wrapInSequence: true,
});

