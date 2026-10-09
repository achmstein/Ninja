// Chapters 01–05: what the guest sees (brand, table ordering, pay & split, rooms, loyalty).
import { Armchair, Award, Check, ChefHat, Clock, Gamepad2, Lock, Send, Trophy } from "lucide-react";
import type React from "react";
import { AbsoluteFill, Interactive, interpolate, useCurrentFrame } from "remotion";
import { clamp, glide, jakarta, land } from "../theme";
import { Chapter, copySchema, Glass, useEnter, type ChapterProps } from "./chapter";
import { MenuScreen } from "./menu-screen";
import { BillRow, Dish, DISHES, Dock, GuestPhone, PageTitle, S, TopBar, Touch } from "./ui";

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
      <GuestPhone {...PHONE} style={useEnter(4)}>
        <MenuScreen
          layout={grid ? "grid" : "row"}
          primary={theme.primary}
          brandColor={theme.primary}
          enterAt={grid ? 212 : -100}
        />
        <Dock slab={theme.slab} />
      </GuestPhone>

      <Glass style={{ left: 880, top: 270, width: 420, padding: 30, fontFamily: jakarta, ...useEnter(14, 160) }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: S.fg }}>Theme</div>
        <div style={{ fontSize: 17, color: S.mutedFg, marginTop: 22 }}>Brand color</div>
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
        <div style={{ fontSize: 17, color: S.mutedFg, marginTop: 26 }}>Dock</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: S.fg, marginTop: 6 }}>A deep shade of the brand colour</div>
        <div style={{ fontSize: 17, color: S.mutedFg, marginTop: 26 }}>Menu</div>
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
                {m}
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
}) => (
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
        {count} {count === 1 ? "item" : "items"}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>EGP {total}</div>
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
      {button}
    </div>
  </div>
);

const OrderInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
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
      <GuestPhone {...PHONE} style={useEnter(4)}>
        <MenuScreen counts={counts} enterAt={scanned} offer="cappuccino" />
        <Dock row={row} rowAt={addLatte} />
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
          <div style={{ color: "#fff", fontSize: 18, fontWeight: 600, marginTop: 26 }}>Table 3</div>
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

// ——— 03 Pay & split ——————————————————————————————————————————————

const PayInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const equally = 74;
  const pay = 150;
  const paid = 196;
  const mode = frame >= equally + 2 ? 2 : 0;
  const share = mode === 2 ? 150 : 450;
  const paidSoFar = interpolate(frame, [paid, paid + 16], [0, 150], { ...clamp, easing: glide });
  const pending = frame >= pay + 2 && frame < paid;

  return (
    <Chapter
      look="glass"
      n="03"
      eyebrow="For your guests"
      title={title}
      mark="split"
      line={line}
      chips={["Pay it all", "My items", "Split equally", "Any amount"]}
      style={style}
    >
      <GuestPhone {...PHONE} style={useEnter(4)}>
        <TopBar />
        <div style={{ position: "absolute", top: 116, left: 16, right: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Pay the bill</div>
          <div style={{ fontSize: 14, color: S.mutedFg, marginTop: 2 }}>Table 3 · 2 rounds</div>
          <div
            style={{
              marginTop: 16,
              borderRadius: 28,
              padding: 20,
              backgroundColor: S.slab,
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.7 }}>Remaining</div>
            <div style={{ fontSize: 30, fontWeight: 800 }}>EGP {Math.round(450 - paidSoFar)}</div>
            <div style={{ fontSize: 13, color: S.emerald, fontWeight: 600, marginTop: 4 }}>
              Paid so far EGP {Math.round(paidSoFar)}
            </div>
            <div
              style={{
                marginTop: 14,
                height: 12,
                borderRadius: 6,
                backgroundColor: "rgba(255,255,255,0.14)",
                overflow: "hidden",
                display: "flex",
              }}
            >
              <div style={{ width: `${(paidSoFar / 450) * 100}%`, backgroundColor: S.emerald }} />
              <div
                style={{
                  width: pending ? `${interpolate(frame, [pay, pay + 30], [0, 33.3], clamp)}%` : 0,
                  backgroundColor: S.amber400,
                }}
              />
            </div>
          </div>
          <div
            style={{
              marginTop: 18,
              display: "flex",
              padding: 4,
              borderRadius: 999,
              backgroundColor: S.muted,
            }}
          >
            {["All", "My items", "Equally", "Amount"].map((m, i) => (
              <div
                key={m}
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  backgroundColor: i === mode ? "#fff" : "transparent",
                  boxShadow: i === mode ? "0 1px 3px rgb(0 0 0 / .12)" : undefined,
                  color: i === mode ? S.fg : S.mutedFg,
                }}
              >
                {m}
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 18,
              padding: 18,
              borderRadius: 24,
              backgroundColor: S.muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              opacity: interpolate(frame, [equally + 2, equally + 10], [0, 1], clamp),
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600 }}>Split between</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 20, fontWeight: 800 }}>
              <span style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#fff", display: "grid", placeItems: "center" }}>−</span>3
              <span style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#fff", display: "grid", placeItems: "center" }}>+</span>
            </div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "16px 16px 28px",
            borderTop: `1px solid ${S.border}`,
            backgroundColor: "#fff",
          }}
        >
          {[
            ["Your share", `EGP ${share}`],
            ["Online payment fee", "EGP 0"],
          ].map(([a, b]) => (
            <div key={a} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: S.mutedFg, marginBottom: 6 }}>
              <span>{a}</span>
              <span>{b}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>You pay</span>
            <span style={{ fontSize: 20, fontWeight: 800 }}>EGP {share}</span>
          </div>
          <div
            style={{
              marginTop: 14,
              height: 52,
              borderRadius: 26,
              backgroundColor: S.primary,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 16,
              fontWeight: 700,
              scale: interpolate(frame, [pay, pay + 3, pay + 12], [1, 0.95, 1], clamp),
            }}
          >
            <Lock size={16} /> Pay EGP {share}
          </div>
        </div>
        <Touch x={239} y={354} at={equally} />
        <Touch x={195} y={790} at={pay} />

        {/* Paid */}
        <AbsoluteFill
          style={{
            backgroundColor: "rgba(255,255,255,0.97)",
            justifyContent: "center",
            alignItems: "center",
            gap: 14,
            opacity: interpolate(frame, [paid + 18, paid + 26], [0, 1], clamp),
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
              scale: interpolate(frame, [paid + 20, paid + 36], [0, 1], { ...clamp, easing: land }),
            }}
          >
            <Check size={52} color="#fff" strokeWidth={3} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>Paid, thank you!</div>
          <div style={{ fontSize: 15, color: S.mutedFg }}>EGP 150 charged · EGP 300 left for your friends</div>
        </AbsoluteFill>
      </GuestPhone>
    </Chapter>
  );
};

export const Pay = Interactive.withSchema({
  Component: PayInner,
  componentName: "<Pay>",
  schema: copySchema(
    "Pay at the table, split any way.",
    "Each friend pays their share from their own phone. You see the bill fill up at the till.",
  ),
  wrapInSequence: true,
});

// ——— 04 Rooms & tables ————————————————————————————————————————————

const PLACES = [
  { name: "Room 1", Icon: Gamepad2, free: true, rate: "PS5 60/hr" },
  { name: "Room 2", Icon: Gamepad2, free: false, rate: "Occupied" },
  { name: "Table 4", Icon: Armchair, free: true, rate: "4 seats" },
  { name: "Arena", Icon: Trophy, free: false, rate: "Reserved" },
];

const BookInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const open = 76;
  const reserve = 156;
  const held = reserve + 6;
  const sheetY = interpolate(frame, [open + 2, open + 18], [520, 0], { ...clamp, easing: glide });

  return (
    <Chapter
      look="light"
      n="04"
      eyebrow="For your guests"
      title={title}
      mark="booked"
      line={line}
      chips={["Rooms", "Tables", "Hourly rates", "Held 10 minutes"]}
      style={style}
    >
      <GuestPhone {...PHONE} style={useEnter(4)}>
        <TopBar />
        <PageTitle title="Book" sub="2 free now" />
        <div
          style={{
            position: "absolute",
            top: 196,
            left: 16,
            right: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {PLACES.map((p, i) => (
            <div
              key={p.name}
              style={{
                position: "relative",
                minHeight: 176,
                padding: 18,
                borderRadius: 24,
                overflow: "hidden",
                backgroundColor: p.free ? S.slab : "#fff",
                color: p.free ? "#fff" : S.fg,
                boxShadow: p.free ? undefined : S.surface,
                opacity: interpolate(frame, [6 + i * 4, 14 + i * 4], [0, 1], clamp),
                scale: interpolate(frame, [6 + i * 4, 20 + i * 4], [0.85, 1], { ...clamp, easing: land }),
              }}
            >
              <p.Icon
                size={110}
                style={{ position: "absolute", right: -16, bottom: -16, opacity: 0.12, rotate: "-12deg" }}
              />
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor: p.free ? "rgba(52,211,153,0.2)" : "rgba(220,38,38,0.1)",
                  color: p.free ? "#6ee7b7" : S.red,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "currentColor" }} />
                {p.free ? "Available" : p.rate}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 34 }}>{p.name}</div>
              {p.free ? (
                <div
                  style={{
                    display: "inline-block",
                    marginTop: 8,
                    padding: "5px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    backgroundColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  {p.rate}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <Dock active="Book" />
        <Touch x={100} y={280} at={open} />

        {/* Hold sheet, then the held state */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 470,
            borderRadius: "28px 28px 0 0",
            backgroundColor: "#fff",
            boxShadow: "0 -20px 60px rgba(15,23,42,0.18)",
            padding: "22px 20px",
            translate: `0px ${sheetY}px`,
          }}
        >
          {frame < held ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 800 }}>Room 1</div>
              <div style={{ fontSize: 14, color: S.mutedFg, marginTop: 2 }}>PS5 · 60 per hour</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 22 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: S.muted, display: "grid", placeItems: "center" }}>
                  <Clock size={18} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>10 minutes to arrive</div>
              </div>
              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  borderRadius: 20,
                  backgroundColor: S.muted,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Start the time now, don't wait for me
                <div style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: S.border, padding: 3 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" }} />
                </div>
              </div>
              <div
                style={{
                  marginTop: 26,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: S.primary,
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                Reserve Now
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  backgroundColor: "rgba(251,191,36,0.18)",
                  color: "#b45309",
                }}
              >
                Held for you · 9:58
              </div>
              <div style={{ marginTop: 22, scale: interpolate(frame, [held, held + 16], [0.4, 1], { ...clamp, easing: land }) }}>
                <Gamepad2 size={64} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 10 }}>Room 1</div>
              <div style={{ fontSize: 15, color: S.mutedFg, marginTop: 6 }}>Walk over and show this at the counter</div>
              <div
                style={{
                  marginTop: 28,
                  height: 48,
                  padding: "0 22px",
                  borderRadius: 24,
                  border: `1px solid ${S.border}`,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 15,
                  fontWeight: 700,
                  color: S.red,
                }}
              >
                Cancel Reservation
              </div>
            </div>
          )}
        </div>
        <Touch x={195} y={626} at={reserve} />
      </GuestPhone>
    </Chapter>
  );
};

export const Book = Interactive.withSchema({
  Component: BookInner,
  componentName: "<Book>",
  schema: copySchema(
    "Rooms and tables, booked ahead.",
    "Guests see what's free and hold it from their phone. The till keeps it for them.",
  ),
  wrapInSequence: true,
});

// ——— 05 Loyalty ——————————————————————————————————————————————————

const LoyaltyInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
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
      <GuestPhone {...PHONE} style={useEnter(4)}>
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
                <div style={{ fontSize: 13, opacity: 0.7 }}>pts</div>
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
            <Award size={14} /> GOLD
          </div>
          <div style={{ fontSize: 14, opacity: 0.7, marginTop: 10 }}>
            {Math.max(0, 1500 - points)} pts to Platinum
          </div>
        </div>
        <div style={{ position: "absolute", top: 470, left: 16, right: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: S.mutedFg, marginBottom: 10 }}>Recent Activity</div>
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

