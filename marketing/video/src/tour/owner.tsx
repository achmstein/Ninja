// Chapters 10–13: the owner's side (AI menu setup + photo studio, stock & food cost,
// profit & payroll, and the assistant in Claude or ChatGPT).
import { Check, UtensilsCrossed, Wrench } from "lucide-react";
import type React from "react";
import { Img, Interactive, interpolate, staticFile, useCurrentFrame } from "remotion";
import { NMark } from "../parts";
import { C, clamp, glide, inter, land } from "../theme";
import { Chapter, copySchema, Glass, Unmirror, useEnter, type ChapterProps } from "./chapter";
import { AdminButton, AdminShell, Dish, DISHES, S, Screen, StatStrip } from "./ui";
import { useT, useUnmirror } from "./lang";
import { Sfx } from "./sfx";

// A photo of paper (a printed menu, a supplier's receipt) with the scan beam passing over it.
const Paper: React.FC<{ x: number; y: number; w: number; src: string; rotate: number; scanFrom: number }> = ({
  x,
  y,
  w,
  src,
  rotate,
  scanFrom,
}) => {
  const frame = useCurrentFrame();
  const unmirror = useUnmirror();
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 40px 80px -30px rgba(15,23,42,0.55)",
        rotate: `${rotate}deg`,
        ...useEnter(2, -200),
        ...unmirror,
      }}
    >
      <Img src={staticFile(src)} style={{ width: "100%", display: "block" }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 90,
          top: `${interpolate(frame, [scanFrom, scanFrom + 40], [-10, 100], clamp)}%`,
          background: "linear-gradient(transparent, rgba(99,102,241,0.35), transparent)",
          borderBottom: "3px solid rgba(99,102,241,0.9)",
          opacity: interpolate(frame, [scanFrom, scanFrom + 4, scanFrom + 40, scanFrom + 46], [0, 1, 1, 0], clamp),
        }}
      />
    </div>
  );
};

// ——— 10 Menu scan + photo studio ——————————————————————————————

// What Ninja reads off The Corner Café's printed menu (public/paper-menu.jpg).
const SCANNED: { name: string; cat: string; note?: string; price: number; img?: string }[] = [
  { name: "Spanish Latte", cat: "Hot drinks", note: "espresso, condensed milk", price: 70, img: "spanish" },
  { name: "Flat White", cat: "Hot drinks", price: 65, img: "flatwhite" },
  { name: "Pistachio Latte", cat: "Hot drinks", price: 85, img: "latte" },
  { name: "San Sebastian Cheesecake", cat: "Sweets", price: 95 },
  { name: "Molten Chocolate Cake", cat: "Sweets", price: 90, img: "cake" },
  { name: "Kunafa Cup", cat: "Sweets", price: 75 },
];

const AiMenuInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const tr = useT();
  const found = 74;
  const studio = 170;
  const reveal = interpolate(frame, [studio + 30, studio + 60], [0, 100], { ...clamp, easing: glide });

  return (
    <Chapter
      look="glass"
      n="07"
      eyebrow="For you"
      title={title}
      mark="minutes."
      line={line}
      chips={["Scan menu", "Categories & prices", "Photo studio"]}
      style={style}
      copyWidth={640}
    >
      <Screen x={1000} y={130} width={840} logical={[1280, 800]} style={useEnter(4)}>
        <AdminShell
          cafe="The Corner Café"
          branch="Downtown"
          active="Menu"
          crumb="Menu & stock"
          title="Menu"
          actions={
            <>
              <AdminButton>
                <NMark size={16} /> {tr("Scan menu")}
              </AdminButton>
              <AdminButton primary>{tr("+ Add item")}</AdminButton>
            </>
          }
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 10,
              backgroundColor: "rgba(99,102,241,0.1)",
              color: "#4338ca",
              fontSize: 14,
              fontWeight: 600,
              opacity: interpolate(frame, [found, found + 6], [0, 1], clamp),
            }}
          >
            <NMark size={16} /> {tr("Ninja read your photo · 6 items in 2 categories")}
            <Sfx name="ding" at={found} />
          </div>
          <div style={{ marginTop: 14, borderRadius: 14, border: `1px solid ${S.border}`, overflow: "hidden" }}>
            {SCANNED.map((d, i) => {
              const at = found + 4 + i * 5;
              const shot = studio + 44 + i * 4;
              return (
                <div
                  key={d.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 16px",
                    borderTop: i ? `1px solid ${S.border}` : undefined,
                    opacity: interpolate(frame, [at, at + 6], [0, 1], clamp),
                    translate: interpolate(frame, [at, at + 14], ["-24px 0px", "0px 0px"], { ...clamp, easing: glide }),
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                      backgroundColor: S.muted,
                      display: "grid",
                      placeItems: "center",
                      overflow: "hidden",
                    }}
                  >
                    <UtensilsCrossed size={16} color={S.mutedFg} />
                    {d.img ? (
                      <Dish
                        img={d.img}
                        size={40}
                        radius={6}
                        style={{ position: "absolute", inset: 0, opacity: interpolate(frame, [shot, shot + 8], [0, 1], clamp) }}
                      />
                    ) : null}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{tr(d.name)}</div>
                    <div style={{ fontSize: 12, color: S.mutedFg }}>
                      {tr(d.cat)}
                      {d.note ? ` · ${tr(d.note)}` : ""}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{d.price}</div>
                  <div style={{ width: 36, height: 20, borderRadius: 10, backgroundColor: S.primary, padding: 2 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff", marginLeft: 16 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </AdminShell>
      </Screen>

      <Paper x={800} y={450} w={360} src="paper-menu.jpg" rotate={-5} scanFrom={20} />

      {/* Photo studio: the owner's quick phone snap, then the studio's shot */}
      <Glass
        style={{
          left: 1280,
          top: 600,
          width: 520,
          padding: 24,
          fontFamily: inter,
          opacity: interpolate(frame, [studio, studio + 8], [0, 1], clamp),
          scale: interpolate(frame, [studio, studio + 20], [0.7, 1], { ...clamp, easing: land }),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 800, color: S.fg }}>
          <NMark size={26} /> {tr("Photo studio")}
          <Sfx name="swish" at={studio + 30} />
          <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 600, color: S.mutedFg }}>{tr("Spanish Latte")}</span>
        </div>
        <div style={{ position: "relative", marginTop: 16, height: 260, borderRadius: 20, overflow: "hidden", backgroundColor: "#2b2520" }}>
          <Dish
            img="spanish"
            size="100%"
            ratio="auto"
            radius={0}
            style={{
              height: "100%",
              filter: "saturate(0.45) brightness(0.62) contrast(0.85) sepia(0.25) blur(0.6px)",
              rotate: "-7deg",
              scale: "1.35",
              translate: "30px 20px",
            }}
          />
          <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${100 - reveal}%)` }}>
            <Dish img="spanish" size="100%" ratio="auto" radius={0} style={{ height: "100%" }} />
          </div>
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${100 - reveal}%`,
              width: 3,
              backgroundColor: "#fff",
              boxShadow: "0 0 18px rgba(255,255,255,0.9)",
              opacity: reveal > 0 && reveal < 100 ? 1 : 0,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 14,
              bottom: 12,
              padding: "6px 12px",
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.55)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {tr(reveal > 50 ? "After" : "Your phone photo")}
          </div>
        </div>
      </Glass>
    </Chapter>
  );
};

export const AiMenu = Interactive.withSchema({
  Component: AiMenuInner,
  componentName: "<AiMenu>",
  schema: copySchema(
    "Photograph your menu. It's online in minutes.",
    "Ninja reads your printed menu into categories and prices, and the photo studio makes every dish look its best.",
  ),
  wrapInSequence: true,
});

// ——— 11 Stock & food cost ————————————————————————————————————————

const COSTS = [
  { k: "latte", cost: "18.40", margin: 75, food: 25 },
  { k: "mocha", cost: "36.10", margin: 62, food: 38 },
  { k: "waffle", cost: "37.40", margin: 66, food: 34 },
  { k: "cake", cost: "33.60", margin: 72, food: 28 },
] as const;

const StockInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const tr = useT();
  const table = 70;
  return (
    <Chapter
      look="light"
      n="08"
      eyebrow="For you"
      title={title}
      mark="costs."
      line={line}
      chips={["Scan a receipt", "Recipes", "Margin per dish", "Low-stock alerts"]}
      style={style}
      copyWidth={640}
    >
      <Screen x={1000} y={140} width={840} logical={[1280, 800]} style={useEnter(4)}>
        <AdminShell
          active="Stock"
          crumb="Menu & stock"
          title="Menu cost"
          actions={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: S.mutedFg,
              }}
            >
              {tr("Food-cost target")}
              <span style={{ border: `1px solid ${S.border}`, borderRadius: 8, padding: "6px 10px", color: S.fg, fontWeight: 600 }}>
                30
              </span>
              %
            </div>
          }
        >
          <StatStrip
            stats={[
              { label: "Tracked items", value: "24" },
              { label: "Average food cost", value: "29%" },
              { label: "Over 30%", value: "6", tone: S.red },
              { label: "With uncosted ingredients", value: "0" },
            ]}
          />
          <div style={{ marginTop: 16, borderRadius: 12, border: `1px solid ${S.border}`, overflow: "hidden", fontSize: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1.4fr",
                padding: "10px 16px",
                backgroundColor: "#f8fafc",
                color: S.mutedFg,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <span>{tr("Menu item")}</span>
              <span>{tr("Price")}</span>
              <span>{tr("Cost per sale")}</span>
              <span>{tr("Margin")}</span>
              <span>{tr("Food cost")}</span>
            </div>
            {COSTS.map((c, i) => {
              const at = table + i * 6;
              const over = c.food > 30;
              return (
                <div
                  key={c.k}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1.2fr 1fr 1.4fr",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderTop: `1px solid ${S.border}`,
                    opacity: interpolate(frame, [at, at + 6], [0, 1], clamp),
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{tr(DISHES[c.k].name)}</span>
                  <span>{DISHES[c.k].price}</span>
                  <span>{c.cost}</span>
                  <span>{c.margin}%</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {Math.round(interpolate(frame, [at, at + 20], [0, c.food], { ...clamp, easing: glide }))}%
                    {over ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          backgroundColor: "rgba(220,38,38,0.1)",
                          color: S.red,
                          opacity: interpolate(frame, [at + 20, at + 26], [0, 1], clamp),
                        }}
                      >
                        {tr("Over target")}
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </AdminShell>
      </Screen>

      <Paper x={790} y={440} w={380} src="supplier-receipt.jpg" rotate={4} scanFrom={18} />

      {/* What the receipt added to stock */}
      <Unmirror style={{ position: "absolute", left: 1010, top: 740, display: "flex", gap: 14 }}>
        {["+4 kg espresso beans", "+24 L whole milk", "+2 kg chocolate sauce"].map((t, i) => {
          const at = 56 + i * 6;
          return (
            <div
              key={t}
              style={{
                padding: "12px 20px",
                borderRadius: 999,
                backgroundColor: S.emerald,
                color: "#fff",
                fontFamily: inter,
                fontSize: 22,
                fontWeight: 700,
                whiteSpace: "nowrap",
                boxShadow: "0 16px 30px -12px rgba(16,185,129,0.6)",
                opacity: interpolate(frame, [at, at + 6], [0, 1], clamp),
                scale: interpolate(frame, [at, at + 16], [0.5, 1], { ...clamp, easing: land }),
              }}
            >
              {tr(t)}
            </div>
          );
        })}
      </Unmirror>
    </Chapter>
  );
};

export const Stock = Interactive.withSchema({
  Component: StockInner,
  componentName: "<Stock>",
  schema: copySchema(
    "Know what every dish really costs.",
    "Snap a supplier's receipt to fill your stock. Recipes turn it into each dish's cost and margin.",
  ),
  wrapInSequence: true,
});

// ——— 12 Profit & payroll ——————————————————————————————————————————

const WATERFALL: { label: string; from: number; to: number; kind: "total" | "cost" | "profit"; amount: string }[] = [
  { label: "Sales", from: 0, to: 420, kind: "total", amount: "420,000" },
  { label: "Refunds", from: 412, to: 420, kind: "cost", amount: "−8,000" },
  { label: "Net sales", from: 0, to: 412, kind: "total", amount: "412,000" },
  { label: "Cost of goods", from: 291, to: 412, kind: "cost", amount: "−121,000" },
  { label: "Waste", from: 285, to: 291, kind: "cost", amount: "−6,000" },
  { label: "Wages", from: 167, to: 285, kind: "cost", amount: "−118,000" },
  { label: "Expenses", from: 86.4, to: 167, kind: "cost", amount: "−80,600" },
  { label: "Profit", from: 0, to: 86.4, kind: "profit", amount: "86,400" },
];

const ProfitInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const tr = useT();
  return (
    <Chapter
      look="light"
      n="09"
      eyebrow="For you"
      title={title}
      mark="spreadsheet."
      line={line}
      chips={["Profit & loss", "Expenses", "Payroll & payslips", "Partners' shares"]}
      style={style}
      copyWidth={640}
    >
      <Screen x={830} y={150} width={980} logical={[1280, 800]} style={useEnter(4)}>
        <AdminShell
          active="Profit & loss"
          crumb="Money"
          title="Profit & loss"
          actions={
            <>
              <AdminButton>{tr("‹ September 2026 ›")}</AdminButton>
              <AdminButton>{tr("Export")}</AdminButton>
            </>
          }
        >
          <StatStrip
            stats={[
              { label: "Profit", value: "EGP 86,400", tone: S.success },
              { label: "Net sales", value: "EGP 412,000" },
              { label: "Prime cost", value: "58%" },
            ]}
          />
          <div style={{ marginTop: 16, borderRadius: 14, border: `1px solid ${S.border}`, padding: "16px 20px" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{tr("Where the money went")}</div>
            {WATERFALL.map((w, i) => {
              const at = 20 + i * 7;
              const grow = interpolate(frame, [at, at + 18], [0, 1], { ...clamp, easing: glide });
              const color = w.kind === "total" ? S.fg : w.kind === "profit" ? S.success : "rgba(220,38,38,0.7)";
              return (
                <div key={w.label} style={{ display: "flex", alignItems: "center", gap: 14, height: 40 }}>
                  <div style={{ width: 120, fontSize: 13, color: w.kind === "cost" ? S.mutedFg : S.fg, fontWeight: w.kind === "cost" ? 400 : 600 }}>
                    {w.label}
                  </div>
                  <div style={{ flex: 1, height: 28, borderRadius: 6, backgroundColor: "rgba(241,245,249,0.5)", position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        insetInlineStart: `${(w.from / 420) * 100}%`,
                        width: `${((w.to - w.from) / 420) * 100 * grow}%`,
                        borderRadius: 6,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                  <div style={{ width: 90, textAlign: "right", fontSize: 13, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                    {w.amount}
                  </div>
                </div>
              );
            })}
          </div>
        </AdminShell>
      </Screen>
    </Chapter>
  );
};

export const Profit = Interactive.withSchema({
  Component: ProfitInner,
  componentName: "<Profit>",
  schema: copySchema(
    "Your profit, without a spreadsheet.",
    "Sales, refunds, stock, wages and expenses add up on their own, month by month.",
  ),
  wrapInSequence: true,
});

// ——— 13 The assistant in Claude or ChatGPT ——————————————————————————

const AssistantInner: React.FC<ChapterProps & { question?: string; action?: string }> = ({
  title,
  line,
  style,
  question: q = "What's running low in stock?",
  action: act = "Record 420 for milk from Fresh Dairy, paid from the drawer.",
}) => {
  const frame = useCurrentFrame();
  const tr = useT();
  // The owner types in the video's language.
  const question = tr(q);
  const action = tr(act);
  const typeFrom = 14;
  const perChar = 0.75;
  const sent = Math.ceil(typeFrom + question.length * perChar) + 4;
  const typed = question.slice(0, Math.max(0, Math.floor((frame - typeFrom) / perChar)));
  const tool = sent + 10;
  const reply = sent + 26;
  const ask2 = reply + 70;
  const tool2 = ask2 + 10;
  const reply2 = ask2 + 24;
  // What is left of each, against what the café keeps on hand.
  const bars = [
    { name: "Whole milk", margin: 15, left: "4 L" },
    { name: "Espresso beans", margin: 28, left: "1.4 kg" },
    { name: "Chocolate sauce", margin: 40, left: "0.8 kg" },
  ];
  const fade = (at: number) => ({
    opacity: interpolate(frame, [at, at + 8], [0, 1], clamp),
    translate: interpolate(frame, [at, at + 16], ["0px 20px", "0px 0px"], { ...clamp, easing: glide }),
  });
  const ToolChip: React.FC<{ text: string; at: number }> = ({ text, at }) => (
    <div
      style={{
        alignSelf: "flex-start",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        backgroundColor: S.muted,
        color: S.mutedFg,
        fontSize: 15,
        fontWeight: 600,
        ...fade(at),
      }}
    >
      <Wrench size={14} /> {tr(text)}
    </div>
  );

  return (
    <Chapter
      look="glass"
      n="10"
      eyebrow="For you"
      title={title}
      mark="anything."
      line={line}
      chips={["Claude", "ChatGPT", "Arabic & English", "Asks before it changes"]}
      style={style}
      copyWidth={640}
    >
      <Glass
        style={{
          left: 830,
          top: 110,
          width: 980,
          height: 860,
          backgroundColor: "rgba(255,255,255,0.86)",
          fontFamily: inter,
          color: S.fg,
          overflow: "hidden",
          ...useEnter(4),
        }}
      >
        <div
          style={{
            height: 76,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 30px",
            borderBottom: `1px solid ${S.border}`,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700 }}>{tr("Claude or ChatGPT")}</div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${S.border}`,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            <NMark size={24} /> ninja · {tr("connected")}
            <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: S.emerald }} />
          </div>
        </div>

        <div style={{ padding: "26px 30px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              alignSelf: "flex-end",
              maxWidth: 620,
              padding: "16px 22px",
              borderRadius: "24px 24px 6px 24px",
              backgroundColor: C.ink,
              color: "#fff",
              fontSize: 21,
              fontWeight: 500,
              lineHeight: 1.4,
              ...fade(sent),
            }}
          >
            {question}
          </div>
          <ToolChip text="Used ninja · stock" at={tool} />
          <Sfx name="ding" at={reply} />
          <Sfx name="success" at={reply2 + 34} />
          <div style={{ fontSize: 21, lineHeight: 1.45, ...fade(reply) }}>
            {tr("Running low right now:")}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14, maxWidth: 600 }}>
              {bars.map((b, i) => {
                const at = reply + 8 + i * 5;
                const w = interpolate(frame, [at, at + 18], [0, b.margin], { ...clamp, easing: glide });
                return (
                  <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 18 }}>
                    <span style={{ width: 160, fontWeight: 600 }}>{tr(b.name)}</span>
                    <div style={{ flex: 1, height: 14, borderRadius: 7, backgroundColor: S.muted }}>
                      <div
                        style={{
                          width: `${w}%`,
                          height: "100%",
                          borderRadius: 7,
                          backgroundColor: i === 0 ? "#ef4444" : S.fg,
                        }}
                      />
                    </div>
                    <span style={{ width: 90, fontWeight: 800, direction: "ltr", textAlign: "end" }}>{tr(b.left)}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14, color: "#334155", ...fade(reply + 30) }}>
              {tr("At today's pace the milk runs out tomorrow. You owe Fresh Dairy 1,280.")}
            </div>
          </div>
          <div
            style={{
              alignSelf: "flex-end",
              padding: "16px 22px",
              borderRadius: "24px 24px 6px 24px",
              backgroundColor: C.ink,
              color: "#fff",
              fontSize: 21,
              fontWeight: 500,
              ...fade(ask2),
            }}
          >
            {action}
          </div>
          <ToolChip text="Used ninja · drafted a change" at={tool2} />
          <div
            style={{
              display: frame >= reply2 + 34 ? "none" : "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 21,
              ...fade(reply2),
            }}
          >
            {tr("Expense: milk, 420.00 from the drawer. Confirm?")}
            <span
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                backgroundColor: C.ink,
                color: "#fff",
                fontSize: 17,
                fontWeight: 700,
                scale: interpolate(frame, [reply2 + 24, reply2 + 27, reply2 + 34], [1, 0.9, 1], clamp),
              }}
            >
              {tr("Confirm")}
            </span>
          </div>
          <div
            style={{
              display: frame >= reply2 + 34 ? "flex" : "none",
              alignItems: "center",
              gap: 12,
              fontSize: 21,
              ...fade(reply2 + 34),
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                backgroundColor: S.emerald,
                display: "grid",
                placeItems: "center",
                scale: interpolate(frame, [reply2 + 34, reply2 + 48], [0.3, 1], { ...clamp, easing: land }),
              }}
            >
              <Check size={20} color="#fff" strokeWidth={3} />
            </span>
            {tr("Done. The expense is recorded and the drawer is updated.")}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 30,
            right: 30,
            bottom: 26,
            height: 72,
            borderRadius: 999,
            border: `2px solid ${frame >= typeFrom && frame < sent ? C.indigo : S.border}`,
            backgroundColor: "#fff",
            display: "flex",
            alignItems: "center",
            padding: "0 26px",
            fontSize: 20,
            color: frame < sent && typed.length > 0 ? S.fg : "#94a3b8",
          }}
        >
          <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {frame < sent && typed.length > 0 ? typed : tr("Ask about your café…")}
            {frame < sent && frame >= typeFrom && Math.floor(frame / 8) % 2 === 0 ? "|" : ""}
          </span>
        </div>
      </Glass>
    </Chapter>
  );
};

export const Assistant = Interactive.withSchema({
  Component: AssistantInner,
  componentName: "<Assistant>",
  schema: copySchema(
    "Ask your café anything.",
    "Connect Claude or ChatGPT to Ninja, then ask about sales, profit, stock or staff, or have it make the change.",
  ),
  wrapInSequence: true,
});
