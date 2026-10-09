// Chapter 03: paying as the mobile app does it (client_app dock_bill, ninja_sheet,
// bill_tile, pay_bill_bar, pay_sheet): the dock's bill row opens "Your bill" in a
// floating slab sheet, "Split bill" → the guest's own items already ticked → Pay → "Paid, thank you!".
import { ArrowLeft, Check, ChevronDown, ChevronUp, CreditCard, Split, Utensils } from "lucide-react";
import type React from "react";
import { AbsoluteFill, Interactive, interpolate, useCurrentFrame } from "remotion";
import { clamp, land } from "../theme";
import { Chapter, copySchema, useEnter, type ChapterProps } from "./chapter";
import { plexArabic, useLang } from "./lang";
import { jakarta } from "../theme";
import { PopOut } from "./hero";
import { Sfx } from "./sfx";
import { MenuScreen } from "./menu-screen";
import { BillRow, Dock, GuestPhone, S, Touch } from "./ui";
import { useT } from "./lang";

const enter = { easing: (t: number) => 1 - Math.pow(1 - t, 3) } as const;
// Inside a slab (SlabInk): muted, muted text and borders are the slab mixed toward white.
const ink = { muted: "#1b1f2e", mutedFg: "#9a9ba2", border: "#2b2e3c", tile: "#191d2b" };

const PillButton: React.FC<{ children: React.ReactNode; primary?: boolean; on?: boolean; press?: number }> = ({
  children,
  primary,
  on,
  press,
}) => {
  const frame = useCurrentFrame();
  const filled = primary || on;
  return (
    <div
      style={{
        height: 48,
        padding: "0 18px",
        borderRadius: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontSize: 15,
        fontWeight: 700,
        whiteSpace: "nowrap",
        backgroundColor: filled ? "#fff" : "transparent",
        color: filled ? S.fg : "#fff",
        border: filled ? undefined : `1.5px solid ${ink.border}`,
        scale: press !== undefined ? `${interpolate(frame, [press, press + 3, press + 10], [1, 0.97, 1], clamp)}` : undefined,
      }}
    >
      {children}
    </div>
  );
};

const PayInner: React.FC<ChapterProps> = ({ title, line, style }) => {
  const frame = useCurrentFrame();
  const ar = useLang() === "ar";
  const tr = useT();
  const open = 34;
  const split = 96;
  const pay = 190;
  const paid = 222;
  const sheet = interpolate(frame, [open + 2, open + 13], [0, 1], { ...clamp, ...enter });
  // BlurSwap between the sheet's stages.
  const swap = (at: number) => ({
    opacity: interpolate(frame, [at, at + 8], [0, 1], clamp),
    filter: `blur(${interpolate(frame, [at, at + 8], [4, 0], clamp)}px)`,
    scale: `${interpolate(frame, [at, at + 8], [0.96, 1], { ...clamp, ...enter })}`,
  });
  const stage = frame >= pay + 2 ? "status" : frame >= split + 2 ? "pay" : "bill";
  const paidAmount = frame >= paid ? 185 : 0;

  return (
    <Chapter
      look="glass"
      n="03"
      eyebrow="For your guests"
      title={title}
      mark="split"
      line={line}
      chips={["Pay for your items", "Pay fully", "Split equally", "Custom amount"]}
      style={style}
    >
      <GuestPhone x={1330} y={70} height={940} label="Mobile app" style={useEnter(4)}>
        <MenuScreen />
        <Dock
          row={<BillRow Icon={Check} tone={S.emerald} line="Confirmed · #42" total="EGP 450" pill="Your bill" />}
          rowAt={-20}
        />
        <Touch x={330} y={746} at={open} />

        {/* Scrim, then the floating slab sheet */}
        <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${0.45 * sheet})` }} />
        <div
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: 8,
            height: 640,
            borderRadius: 28,
            backgroundColor: S.slab,
            color: "#fff",
            boxShadow: "0 24px 60px -16px rgba(0,0,0,.55)",
            overflow: "hidden",
            opacity: sheet,
            translate: `0px ${(1 - sheet) * 72}px`,
            scale: `${0.96 + 0.04 * sheet}`,
            transformOrigin: "50% 100%",
          }}
        >
          <div style={{ height: 28, display: "grid", placeItems: "center" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" }} />
          </div>
          <div style={{ padding: "0 20px 20px" }}>
            {stage === "bill" ? (
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{tr("Your bill")}</div>
                <div style={{ marginTop: 14, padding: 20, borderRadius: 28, backgroundColor: ink.tile }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: ink.mutedFg }}>
                    <Utensils size={14} /> Table 3 · 8:12 PM
                    <span
                      style={{
                        marginLeft: "auto",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        borderRadius: 999,
                        backgroundColor: "rgba(245,158,11,0.15)",
                        color: "#F59E0B",
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#F59E0B" }} />
                      {tr("Unpaid")}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: ink.mutedFg, marginTop: 14 }}>{tr("Total")}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 30, fontWeight: 800 }}>{tr("EGP 450.00")}</div>
                    <div
                      style={{
                        height: 32,
                        padding: "0 12px",
                        borderRadius: 16,
                        backgroundColor: ink.muted,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      2 rounds <ChevronDown size={14} />
                    </div>
                  </div>
                  {/* The stacked rounds, edges peeking underneath */}
                  <div style={{ position: "relative", marginTop: 14 }}>
                    <div style={{ position: "absolute", left: 12, right: 12, bottom: -12, height: 20, borderRadius: 20, backgroundColor: "#141826" }} />
                    <div style={{ position: "absolute", left: 6, right: 6, bottom: -6, height: 20, borderRadius: 20, backgroundColor: "#171b29" }} />
                    <div style={{ position: "relative", padding: 12, borderRadius: 20, backgroundColor: "#1d2232", fontSize: 14 }}>
                      {[
                        ["2x Latte", "150.00"],
                        ["1x Waffle", "110.00"],
                        ["2x Iced Mocha", "190.00"],
                      ].map(([a, b]) => (
                        <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                          <span>{tr(a)}</span>
                          <span style={{ color: ink.mutedFg }}>{tr(b)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26, fontSize: 14 }}>
                  <span style={{ color: "#34D399" }}>{tr("Paid so far EGP 0.00")}</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{tr("Remaining EGP 450.00")}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  <PillButton primary>
                    <CreditCard size={17} /> {tr("Pay fully")}
                  </PillButton>
                  <PillButton press={split}>
                    <Split size={17} /> {tr("Split bill")}
                  </PillButton>
                </div>
              </div>
            ) : stage === "pay" ? (
              <div style={swap(split + 2)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ArrowLeft size={20} />
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{tr("Split bill")}</div>
                </div>
                <div style={{ fontSize: 14, color: ink.mutedFg, marginTop: 4, marginLeft: 30 }}>{tr("Remaining: EGP 450.00")}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 22 }}>{tr("How do you want to split?")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {["Pay for your items", "Divide equally", "Custom amount"].map((m, i) => (
                    <PillButton key={m} on={i === 0}>
                      {tr(m)}
                    </PillButton>
                  ))}
                </div>
                {/* Pay for your items: the guest's own items come ticked */}
                <div style={{ marginTop: 14 }}>
                  {[
                    { name: "1x Latte", price: "75.00", mine: true },
                    { name: "1x Waffle", price: "110.00", mine: true },
                    { name: "1x Latte", price: "75.00", mine: false },
                    { name: "2x Iced Mocha", price: "190.00", mine: false },
                  ].map((it, k) => (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0", fontSize: 14 }}>
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          display: "grid",
                          placeItems: "center",
                          backgroundColor: it.mine ? "#fff" : "transparent",
                          border: it.mine ? undefined : `1.5px solid ${ink.border}`,
                          color: S.fg,
                        }}
                      >
                        {it.mine ? <Check size={15} strokeWidth={3} /> : null}
                      </span>
                      <span style={{ flex: 1, color: it.mine ? "#fff" : ink.mutedFg }}>{tr(it.name)}</span>
                      <span style={{ color: it.mine ? "#fff" : ink.mutedFg }}>{tr(it.price)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ borderTop: `1px solid ${ink.border}`, marginTop: 10, paddingTop: 12, fontSize: 14 }}>
                    {[
                      ["Your share", "EGP 185.00"],
                      ["Online payment fee", "EGP 0.00"],
                    ].map(([a, b]) => (
                      <div key={a} style={{ display: "flex", justifyContent: "space-between", color: ink.mutedFg, padding: "3px 0" }}>
                        <span>{tr(a)}</span>
                        <span>{tr(b)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                      <span style={{ fontSize: 18, fontWeight: 700 }}>{tr("You pay")}</span>
                      <span style={{ fontSize: 18, fontWeight: 700 }}>{tr("EGP 185.00")}</span>
                    </div>
                    <div style={{ fontSize: 12, color: ink.mutedFg, marginTop: 4 }}>{tr("You'll pay on a secure payment page")}</div>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <PillButton primary press={pay}>
                      {tr("Pay EGP 185.00")}
                    </PillButton>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ height: 560, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 12 }}>
                {frame < paid ? (
                  <div style={swap(pay + 2)}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        margin: "0 auto",
                        borderRadius: "50%",
                        border: "3px solid rgba(255,255,255,0.2)",
                        borderTopColor: "#fff",
                        rotate: `${frame * 20}deg`,
                      }}
                    />
                    <div style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>{tr("Waiting for your payment…")}</div>
                  </div>
                ) : (
                  <div style={swap(paid)}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        margin: "0 auto",
                        borderRadius: "50%",
                        backgroundColor: "#10B981",
                        display: "grid",
                        placeItems: "center",
                        scale: `${interpolate(frame, [paid, paid + 14], [0.4, 1], { ...clamp, easing: land })}`,
                      }}
                    >
                      <Check size={32} strokeWidth={3} />
                    </div>
                    <div style={{ marginTop: 16, fontSize: 22, fontWeight: 800 }}>{tr("Paid, thank you!")}</div>
                    <div style={{ marginTop: 6, fontSize: 15, color: ink.mutedFg }}>{tr(`EGP ${paidAmount}.00 charged`)}</div>
                    <div style={{ marginTop: 2, fontSize: 15, color: ink.mutedFg }}>{tr("EGP 265.00 left for your friends")}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <Sfx name="open" at={open + 2} />
        <Sfx name="success" at={paid} />
        <Touch x={274} y={844 - 8 - 640 + 28 + 344} at={split} />
        <Touch x={195} y={844 - 8 - 640 + 28 + 540} at={pay} />
        <div style={{ display: "none" }}>
          <ChevronUp />
        </div>
      </GuestPhone>
      <PopOut at={paid + 8} x={1080} y={470}>
        <div
            style={{
              padding: "22px 26px",
              borderRadius: 30,
              backgroundColor: "#fff",
              color: S.fg,
              fontFamily: ar ? plexArabic : jakarta,
              direction: ar ? "rtl" : "ltr",
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: "#10B981", display: "grid", placeItems: "center" }}>
              <Check size={36} color="#fff" strokeWidth={3} />
            </div>
            <div>
              <div style={{ fontSize: 30, fontWeight: 800 }}>{tr("Paid, thank you!")}</div>
              <div style={{ fontSize: 20, color: S.mutedFg, marginTop: 2 }}>{tr("EGP 185.00 charged")}</div>
            </div>
          </div>
      </PopOut>
    </Chapter>
  );
};

export const Pay = Interactive.withSchema({
  Component: PayInner,
  componentName: "<Pay>",
  schema: copySchema(
    "Pay at the table, split any way.",
    "The bill is in the dock. Each friend opens it and pays their share from their own phone.",
  ),
  wrapInSequence: true,
});
