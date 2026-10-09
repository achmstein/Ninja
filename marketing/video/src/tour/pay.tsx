// Chapter 03: paying as the mobile app does it (client_app dock_bill, ninja_sheet,
// bill_tile, pay_bill_bar, pay_sheet): the dock's bill row opens "Your bill" in a
// floating slab sheet, "Split bill" → "Divide equally" → Pay → "Paid, thank you!".
import { ArrowLeft, Check, ChevronDown, ChevronUp, CreditCard, Split, Utensils } from "lucide-react";
import type React from "react";
import { AbsoluteFill, Interactive, interpolate, useCurrentFrame } from "remotion";
import { clamp, land } from "../theme";
import { Chapter, copySchema, useEnter, type ChapterProps } from "./chapter";
import { MenuScreen } from "./menu-screen";
import { BillRow, Dock, GuestPhone, S, Touch } from "./ui";

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
  const open = 34;
  const split = 96;
  const equally = 138;
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
  const paidAmount = frame >= paid ? 150 : 0;

  return (
    <Chapter
      look="glass"
      n="03"
      eyebrow="For your guests"
      title={title}
      mark="split"
      line={line}
      chips={["Pay fully", "Split equally", "Pay for your items", "Custom amount"]}
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
                <div style={{ fontSize: 20, fontWeight: 800 }}>Your bill</div>
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
                      Unpaid
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: ink.mutedFg, marginTop: 14 }}>Total</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 30, fontWeight: 800 }}>EGP 450.00</div>
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
                          <span>{a}</span>
                          <span style={{ color: ink.mutedFg }}>{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26, fontSize: 14 }}>
                  <span style={{ color: "#34D399" }}>Paid so far EGP 0.00</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Remaining EGP 450.00</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  <PillButton primary>
                    <CreditCard size={17} /> Pay fully
                  </PillButton>
                  <PillButton press={split}>
                    <Split size={17} /> Split bill
                  </PillButton>
                </div>
              </div>
            ) : stage === "pay" ? (
              <div style={swap(split + 2)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ArrowLeft size={20} />
                  <div style={{ fontSize: 20, fontWeight: 800 }}>Split bill</div>
                </div>
                <div style={{ fontSize: 14, color: ink.mutedFg, marginTop: 4, marginLeft: 30 }}>Remaining: EGP 450.00</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 22 }}>How do you want to split?</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {["Pay for your items", "Divide equally", "Custom amount"].map((m, i) => (
                    <PillButton key={m} on={i === 1 && frame >= equally + 2} press={i === 1 ? equally : undefined}>
                      {m}
                    </PillButton>
                  ))}
                </div>
                <div style={{ opacity: interpolate(frame, [equally + 2, equally + 10], [0, 1], clamp) }}>
                  {[
                    ["Split between", "3"],
                    ["You pay for", "1"],
                  ].map(([label, v]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
                      <span style={{ display: "flex", alignItems: "center" }}>
                        <span style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: ink.muted, display: "grid", placeItems: "center", fontSize: 20 }}>−</span>
                        <span style={{ width: 56, textAlign: "center", fontSize: 20, fontWeight: 800 }}>{v}</span>
                        <span style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: ink.muted, display: "grid", placeItems: "center", fontSize: 20 }}>+</span>
                      </span>
                    </div>
                  ))}
                  <div style={{ borderTop: `1px solid ${ink.border}`, marginTop: 18, paddingTop: 12, fontSize: 14 }}>
                    {[
                      ["Your share", "EGP 150.00"],
                      ["Online payment fee", "EGP 0.00"],
                    ].map(([a, b]) => (
                      <div key={a} style={{ display: "flex", justifyContent: "space-between", color: ink.mutedFg, padding: "3px 0" }}>
                        <span>{a}</span>
                        <span>{b}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                      <span style={{ fontSize: 18, fontWeight: 700 }}>You pay</span>
                      <span style={{ fontSize: 18, fontWeight: 700 }}>EGP 150.00</span>
                    </div>
                    <div style={{ fontSize: 12, color: ink.mutedFg, marginTop: 4 }}>You'll pay on a secure payment page</div>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <PillButton primary press={pay}>
                      Pay EGP 150.00
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
                    <div style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>Waiting for your payment…</div>
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
                    <div style={{ marginTop: 16, fontSize: 22, fontWeight: 800 }}>Paid, thank you!</div>
                    <div style={{ marginTop: 6, fontSize: 15, color: ink.mutedFg }}>EGP {paidAmount}.00 charged</div>
                    <div style={{ marginTop: 2, fontSize: 15, color: ink.mutedFg }}>EGP 300.00 left for your friends</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <Touch x={274} y={844 - 8 - 640 + 28 + 344} at={split} />
        <Touch x={238} y={844 - 8 - 640 + 28 + 152} at={equally} />
        <Touch x={110} y={844 - 8 - 640 + 28 + 540} at={pay} />
        <div style={{ display: "none" }}>
          <ChevronUp />
        </div>
      </GuestPhone>
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
