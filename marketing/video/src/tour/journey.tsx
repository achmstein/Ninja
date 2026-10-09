// The pipeline: one real order (#1042, Mona, a latte and a waffle, delivered) travelling
// through every app in one take — the guest app, the till, the kitchen, the rider — while
// a small copy of the guest's phone follows its status the whole way.
import { Bike, Check, ChefHat, House, MapPin, Send, Navigation, Phone as PhoneIcon } from "lucide-react";
import type React from "react";
import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, type InteractivitySchema } from "remotion";
import { C, clamp, inter, land } from "../theme";
import { Stage } from "./Frame";
import { Flight, TrayRow, TraySheet } from "./guests";
import { AR, MirrorContext, plexArabic, useLang, useT, useUnmirror } from "./lang";
import { MenuScreen } from "./menu-screen";
import { TICKETS, TicketCard, type Ticket } from "./team";
import { BillRow, Dish, DISHES, Dock, GuestPhone, S, Screen, Touch } from "./ui";

const ease = Easing.bezier(0.65, 0, 0.35, 1);
const W = 1920; // one station per screen width

// When things happen (frames).
const T = {
  addLatte: 52,
  addWaffle: 84,
  order: 120,
  place: 152,
  sent: 168,
  fly1: 186, // the order leaves the phone…
  arrive1: 232, // …and lands on the till
  confirm: 280,
  assign: 326,
  fly2: 360,
  arrive2: 404,
  ready: 480,
  fly3: 512,
  arrive3: 556,
  onTheWay: 600,
  delivered: 690,
  end: 780,
};

// The camera: one station at a time, gliding to the next as the order flies.
const camAt = (f: number) =>
  interpolate(f, [T.fly1, T.arrive1, T.fly2, T.arrive2, T.fly3, T.arrive3], [0, W, W, 2 * W, 2 * W, 3 * W], {
    ...clamp,
    easing: ease,
  });

type Caption = { step: string; title: string; line: string; chips: string[] };
const CAPTIONS: Record<"en" | "ar", Caption[]> = {
  en: [
    { step: "1", title: "The guest orders.", line: "From the app or the web: photo menu, notes, delivery or the table.", chips: ["Photo menu", "Delivery", "Pay online or cash"] },
    { step: "2", title: "The till confirms.", line: "The order pops up on the till: one tap to confirm, one to send a rider.", chips: ["One-tap confirm", "Assign a rider", "Receipt printed"] },
    { step: "3", title: "The kitchen cooks.", line: "The ticket lands instantly and counts its wait time.", chips: ["Live tickets", "Notes in amber", "Ready in a tap"] },
    { step: "4", title: "Your rider delivers.", line: "Your own rider, no commission. The guest follows every step to the door.", chips: ["Rider app", "Cash to collect", "Live status"] },
  ],
  ar: [
    { step: "1", title: "العميل يطلب.", line: "من الأبلكيشن أو الويب: منيو بالصور، ملاحظات، دليفري أو على الترابيزة.", chips: ["منيو بالصور", "دليفري", "دفع أونلاين أو كاش"] },
    { step: "2", title: "الكاشير يأكد.", line: "الطلب بيظهر على الكاشير: لمسة يأكده، ولمسة يبعت طيار.", chips: ["تأكيد بلمسة", "اختيار الطيار", "الإيصال بيتطبع"] },
    { step: "3", title: "المطبخ يجهّز.", line: "التذكرة بتوصل في ساعتها وبتعدّ وقت الانتظار.", chips: ["تذاكر لايف", "الملاحظات واضحة", "جاهز بلمسة"] },
    { step: "4", title: "الطيار بتاعك يوصّل.", line: "طيارك إنت ومن غير عمولة، والعميل يتابع كل خطوة لحد الباب.", chips: ["أبلكيشن الطيار", "الكاش المطلوب", "حالة لايف"] },
  ],
};

// The order itself, as a card that flies from app to app.
const OrderCard: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const tr = useT();
  const ar = useLang() === "ar";
  return (
    <div
      style={{
        position: "absolute",
        width: 380,
        padding: "16px 18px",
        borderRadius: 26,
        backgroundColor: S.slab,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "0 30px 60px -20px rgba(2,6,23,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
        fontFamily: ar ? plexArabic : inter,
        direction: ar ? "rtl" : "ltr",
        zIndex: 60,
        ...style,
        ...useUnmirror(),
      }}
    >
      <div style={{ display: "flex" }}>
        <Dish img={DISHES.latte.img} size={48} radius={24} style={{ border: "2px solid #020617" }} />
        <Dish img={DISHES.waffle.img} size={48} radius={24} style={{ border: "2px solid #020617", marginInlineStart: -14 }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, opacity: 0.7 }}>{tr("Order #1042")} · {tr("Delivery")}</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{tr("Lina")}</div>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{tr("EGP 210")}</div>
    </div>
  );
};

// The till: the new delivery order on top of the sale screen.
const TillIncoming: React.FC<{ arrive: number; confirm: number; assign: number }> = ({ arrive, confirm, assign }) => {
  const frame = useCurrentFrame();
  const tr = useT();
  const confirmed = frame >= confirm + 2;
  const assigned = frame >= assign + 2;
  const items = [DISHES.latte, DISHES.mocha, DISHES.cappuccino, DISHES.waffle, DISHES.cake, DISHES.lemonade];
  return (
    <>
      <div style={{ height: 64, display: "flex", alignItems: "center", padding: "0 20px", borderBottom: `1px solid ${S.border}`, fontSize: 20, fontWeight: 800 }}>
        {tr("Till")}
      </div>
      <div style={{ position: "absolute", top: 80, insetInlineStart: 16, width: 880, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, opacity: 0.45 }}>
        {[...items, ...items.slice(0, 4)].map((d, i) => (
          <div key={i} style={{ padding: 8, borderRadius: 14, border: `1px solid ${S.border}` }}>
            <Dish img={d.img} size="100%" ratio="4 / 3" radius={10} />
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>{tr(d.name)}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, backgroundColor: `rgba(2,6,23,${interpolate(frame, [arrive, arrive + 8], [0, 0.35], clamp)})` }} />
      {/* The incoming order */}
      <div
        style={{
          position: "absolute",
          left: 340,
          top: 90,
          width: 600,
          borderRadius: 24,
          backgroundColor: "#fff",
          boxShadow: "0 40px 90px -30px rgba(2,6,23,0.6)",
          padding: 26,
          opacity: interpolate(frame, [arrive, arrive + 6], [0, 1], clamp),
          scale: `${interpolate(frame, [arrive, arrive + 14], [0.9, 1], { ...clamp, easing: land })}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ padding: "4px 12px", borderRadius: 999, backgroundColor: confirmed ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.18)", color: confirmed ? "#047857" : "#b45309", fontSize: 14, fontWeight: 700 }}>
            {tr(confirmed ? "Confirmed" : "New order")}
          </span>
          <span style={{ fontSize: 16, color: S.mutedFg }}>
            {tr("Order #1042")} · {tr("Delivery")}
          </span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, marginTop: 12 }}>{tr("Lina")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, color: S.mutedFg, marginTop: 4 }}>
          <MapPin size={15} /> {tr("12 Brazil St, Zamalek · 2nd floor")}
        </div>
        <div style={{ marginTop: 16, borderTop: `1px solid ${S.border}`, paddingTop: 12, fontSize: 16 }}>
          {[
            ["1× Latte", "75"],
            ["1× Waffle", "110"],
            ["Delivery fee", "25"],
          ].map(([a, b]) => (
            <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span>{tr(a)}</span>
              <span>{b}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 18, fontWeight: 800 }}>
            <span>{tr("Total")}</span>
            <span>{tr("EGP 210")}</span>
          </div>
        </div>
        {!confirmed ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginTop: 18 }}>
            <div style={{ height: 56, borderRadius: 14, border: `1px solid ${S.border}`, display: "grid", placeItems: "center", fontSize: 17, fontWeight: 700 }}>{tr("Reject")}</div>
            <div
              style={{
                height: 56,
                borderRadius: 14,
                backgroundColor: S.primary,
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 17,
                fontWeight: 700,
                scale: `${interpolate(frame, [confirm, confirm + 3, confirm + 10], [1, 0.96, 1], clamp)}`,
              }}
            >
              {tr("Confirm")}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 18, opacity: interpolate(frame, [confirm + 2, confirm + 10], [0, 1], clamp) }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: S.mutedFg }}>{tr("Assign a rider")}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              {["Mostafa", "Youssef"].map((r, i) => {
                const on = i === 0 && assigned;
                return (
                  <div
                    key={r}
                    style={{
                      flex: 1,
                      height: 56,
                      borderRadius: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "0 14px",
                      border: on ? undefined : `1px solid ${S.border}`,
                      backgroundColor: on ? S.primary : "#fff",
                      color: on ? "#fff" : S.fg,
                      fontSize: 16,
                      fontWeight: 700,
                      scale: i === 0 ? `${interpolate(frame, [assign, assign + 3, assign + 10], [1, 0.96, 1], clamp)}` : undefined,
                    }}
                  >
                    <Bike size={18} />
                    <span style={{ flex: 1 }}>{tr(r)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.7 }}>{on ? "✓" : tr("On duty")}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <Touch x={640 + 100} y={90 + 26 + 300 + 28} at={confirm} size={52} />
      <Touch x={340 + 26 + 130} y={90 + 26 + 300 + 50} at={assign} size={52} />
    </>
  );
};

// The rider's phone: the delivery card for #1042.
const RiderScreen: React.FC<{ onTheWay: number; delivered: number }> = ({ onTheWay, delivered }) => {
  const frame = useCurrentFrame();
  const tr = useT();
  const out = frame >= onTheWay + 2;
  const done = frame >= delivered + 2;
  const stage = done
    ? { label: "Delivered", bg: "rgba(16,185,129,0.12)", fg: "#047857" }
    : out
      ? { label: "On the way", bg: "rgba(2,132,199,0.12)", fg: "#0284c7" }
      : { label: "Ready to go", bg: "rgba(16,185,129,0.12)", fg: "#047857" };
  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: "#f8fafc" }}>
      <div style={{ position: "absolute", top: 60, left: 16, right: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }}>{tr("Deliveries")}</div>
        <div style={{ marginTop: 14, padding: 16, borderRadius: 20, backgroundColor: "#fff", border: `1px solid ${out && !done ? "#0284c7" : S.border}`, boxShadow: "0 4px 12px rgba(15,23,42,0.08)" }}>
          <div style={{ fontSize: 13, color: S.mutedFg }}>{tr("Order #1042")}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{tr("Lina")}</div>
            <div style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, backgroundColor: stage.bg, color: stage.fg }}>{tr(stage.label)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 14 }}>
            <MapPin size={16} /> {tr("12 Brazil St, Zamalek · 2nd floor")}
          </div>
          <div style={{ fontSize: 12, color: S.mutedFg, marginTop: 12 }}>{tr("In the bag")}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {["1× Latte", "1× Waffle"].map((c) => (
              <span key={c} style={{ padding: "4px 10px", borderRadius: 999, backgroundColor: S.muted, fontSize: 12, fontWeight: 600 }}>
                {tr(c)}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: S.muted }}>
            <div style={{ fontSize: 12, color: S.mutedFg }}>{tr("Cash to collect")}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{tr("EGP 210")}</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {[
              { Icon: Navigation, l: "Navigate" },
              { Icon: PhoneIcon, l: "Call" },
            ].map(({ Icon, l }) => (
              <div key={l} style={{ flex: 1, height: 40, borderRadius: 12, border: `1px solid ${S.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 14, fontWeight: 600 }}>
                <Icon size={15} /> {tr(l)}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, height: 60, borderRadius: 14, backgroundColor: done ? S.emerald : S.primary, color: "#fff", display: "grid", placeItems: "center", fontSize: 17, fontWeight: 700 }}>
            {tr(done ? "Delivered ✓" : out ? "Delivered" : "I'm on the way")}
          </div>
        </div>
      </div>
      <Touch x={195} y={632} at={onTheWay} />
      <Touch x={195} y={632} at={delivered} />
    </div>
  );
};

// Where the guest's order stands, as their phone's dock shows it.
const guestRow = (f: number) =>
  f >= T.delivered + 2 ? (
    <BillRow Icon={House} tone={S.emerald} line="Delivered · #1042" total="EGP 210" pill="Your order" />
  ) : f >= T.onTheWay + 2 ? (
    <BillRow Icon={Bike} tone="#0284c7" line="On its way · #1042" total="EGP 210" pill="Your order" />
  ) : f >= T.arrive2 ? (
    <BillRow Icon={ChefHat} tone={S.emerald} line="Being made · #1042" total="EGP 210" pill="Your order" />
  ) : f >= T.confirm + 2 ? (
    <BillRow Icon={Check} tone={S.emerald} line="Confirmed · #1042" total="EGP 210" pill="Your order" />
  ) : (
    <BillRow Icon={Send} tone="rgba(255,255,255,0.12)" line="Sent · #1042" total="EGP 210" pill="Your order" />
  );

// Big enough to read: where Lina's order stands right now, over her phone.
const GuestStatus: React.FC = () => {
  const frame = useCurrentFrame();
  const tr = useT();
  const ar = useLang() === "ar";
  const steps: [number, string, string][] = [
    [0, "Sent", "rgba(15,23,42,0.85)"],
    [T.confirm + 2, "Confirmed", S.emerald],
    [T.arrive2, "Being made", S.emerald],
    [T.onTheWay + 2, "On its way", "#0284c7"],
    [T.delivered + 2, "Delivered", S.emerald],
  ];
  const cur = steps.filter(([at]) => frame >= at).pop() ?? steps[0];
  const since = frame - cur[0];
  return (
    <div
      style={{
        position: "absolute",
        bottom: 396,
        [ar ? "left" : "right"]: -10,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 18px",
        borderRadius: 999,
        backgroundColor: cur[2],
        color: "#fff",
        fontFamily: ar ? plexArabic : inter,
        direction: ar ? "rtl" : "ltr",
        fontSize: 22,
        fontWeight: 700,
        whiteSpace: "nowrap",
        boxShadow: "0 16px 30px -14px rgba(2,6,23,0.5)",
        scale: `${interpolate(since, [0, 4, 12], [0.85, 1.06, 1], clamp)}`,
      }}
    >
      {tr("Lina")} · {tr(cur[1])}
    </div>
  );
};

type Props = { readonly headline: string; readonly style?: React.CSSProperties };

const JourneyInner: React.FC<Props> = ({ headline, style }) => {
  const frame = useCurrentFrame();
  const tr = useT();
  const ar = useLang() === "ar";
  const font = ar ? plexArabic : inter;
  const head = ar ? AR.journeyHeadline : headline;
  const cam = camAt(frame);
  const station = cam < W * 0.5 ? 0 : cam < W * 1.5 ? 1 : cam < W * 2.5 ? 2 : 3;
  const stationStart = [0, T.arrive1, T.arrive2, T.arrive3][station] - (station ? 24 : 0);
  const cap = CAPTIONS[ar ? "ar" : "en"][station];

  // Ordering on the phone (station 0).
  const items = frame >= T.addWaffle + 2 ? ["latte", "waffle"] : ["latte"];
  const total = frame >= T.addWaffle + 2 ? 185 : 75;
  const row =
    frame >= T.sent ? (
      <BillRow Icon={Send} tone="rgba(255,255,255,0.12)" line="Sent · #1042" total="EGP 210" pill="Your order" />
    ) : (
      <TrayRow items={items} count={items.length} total={total} button={frame >= T.place ? "Sending…" : frame >= T.order + 2 ? "Place Order" : "Order"} />
    );

  // The order card's path: phone → till → kitchen → rider, in world coordinates.
  const legs = [
    { from: [1250 + 30, 640], to: [W + 820 + 330, 300], at: T.fly1, end: T.arrive1 },
    { from: [W + 820 + 330, 300], to: [2 * W + 820 + 60, 330], at: T.fly2, end: T.arrive2 },
    { from: [2 * W + 820 + 60, 330], to: [3 * W + 1250 + 30, 260], at: T.fly3, end: T.arrive3 },
  ];
  const leg = legs.find((l) => frame >= l.at - 14 && frame <= l.end + 2);
  let card: React.ReactNode = null;
  if (leg) {
    const t = interpolate(frame, [leg.at, leg.end], [0, 1], { ...clamp, easing: ease });
    const x = leg.from[0] + (leg.to[0] - leg.from[0]) * t;
    const y = leg.from[1] + (leg.to[1] - leg.from[1]) * t - Math.sin(Math.PI * t) * 160;
    card = (
      <OrderCard
        style={{
          left: x,
          top: y,
          opacity: interpolate(frame, [leg.at - 14, leg.at - 6, leg.end - 4, leg.end + 2], [0, 1, 1, 0], clamp),
          scale: `${interpolate(frame, [leg.at - 14, leg.at - 4, leg.end - 6, leg.end], [0.6, 1.08, 1, 0.7], clamp)}`,
        }}
      />
    );
  }

  const freshTicket: Ticket = {
    n: "#1042",
    channel: "Delivery",
    time: `0:${String(Math.max(0, Math.floor((frame - T.arrive2) / 30))).padStart(2, "0")}`,
    name: "Lina",
    lines: [
      [1, "Latte"],
      [1, "Waffle"],
    ],
    note: "Extra chocolate, please",
    age: "fresh",
  };

  const world = (
    <AbsoluteFill style={{ translate: `${-cam}px 0px` }}>
      {/* 1 · the guest's phone */}
      <GuestPhone x={1250} y={70} height={940} label="Mobile app">
        <MenuScreen counts={{ latte: frame >= T.addLatte + 2 ? 1 : 0, waffle: frame >= T.addWaffle + 2 ? 1 : 0 }} />
        <TraySheet openAt={T.order + 2} closeAt={T.sent} lines={["latte", "waffle"]} />
        <Dock row={row} rowAt={T.addLatte + 10} />
        <Flight dish="latte" row={0} slot={0} at={T.addLatte} />
        <Flight dish="waffle" row={3} slot={1} at={T.addWaffle} />
        <Touch x={352} y={192} at={T.addLatte} />
        <Touch x={352} y={480} at={T.addWaffle} />
        <Touch x={318} y={746} at={T.order} />
        <Touch x={300} y={746} at={T.place} />
      </GuestPhone>

      {/* 2 · the till */}
      <Screen x={W + 820} y={170} width={980} logical={[1280, 800]} font={inter}>
        <TillIncoming arrive={T.arrive1} confirm={T.confirm} assign={T.assign} />
      </Screen>

      {/* 3 · the kitchen */}
      <Screen x={2 * W + 820} y={200} width={980} logical={[1100, 560]} font={inter} screen="#f8fafc">
        <div style={{ height: 64, display: "flex", alignItems: "center", gap: 12, padding: "0 20px", backgroundColor: "#fff", borderBottom: `1px solid ${S.border}` }}>
          <ChefHat size={22} />
          <div style={{ fontSize: 20, fontWeight: 800 }}>{tr("Kitchen")}</div>
        </div>
        {TICKETS.map((t, i) => (
          <TicketCard key={t.n} t={t} style={{ insetInlineStart: 16 + (i + 1) * 268 }} />
        ))}
        <TicketCard
          t={freshTicket}
          ready={frame >= T.ready + 2}
          pressAt={T.ready}
          style={{
            insetInlineStart: 16,
            opacity: interpolate(frame, [T.arrive2 - 4, T.arrive2 + 4], [0, 1], clamp),
            translate: interpolate(frame, [T.arrive2 - 4, T.arrive2 + 14], ["0px -160px", "0px 0px"], { ...clamp, easing: land }),
            boxShadow: `0 0 ${interpolate(frame, [T.arrive2 + 8, T.arrive2 + 22, T.arrive2 + 48], [0, 40, 0], clamp)}px rgba(245,158,11,0.9)`,
          }}
        />
        <Touch x={144} y={80 + 82 + 108 + 38} at={T.ready} size={48} />
      </Screen>

      {/* 4 · the rider */}
      <GuestPhone x={3 * W + 1250} y={70} height={940} font={inter} screen="#f8fafc" label="Rider app">
        <RiderScreen onTheWay={T.onTheWay} delivered={T.delivered} />
      </GuestPhone>

      {card}
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill style={style}>
      <Stage look="light">
        {ar ? (
          <MirrorContext.Provider value>
            <AbsoluteFill style={{ transform: "scaleX(-1)" }}>{world}</AbsoluteFill>
          </MirrorContext.Provider>
        ) : (
          world
        )}

        {/* The guest's phone in the corner, from the till on */}
        <div
          style={{
            position: "absolute",
            [ar ? "left" : "right"]: 50,
            bottom: 40,
            opacity: interpolate(frame, [T.fly1 + 10, T.fly1 + 24], [0, 1], clamp),
            translate: `0px ${interpolate(frame, [T.fly1 + 10, T.fly1 + 30], [80, 0], { ...clamp, easing: land })}px`,
          }}
        >
          <GuestStatus />
          <GuestPhone x={0} y={0} height={380} style={{ position: "relative" }}>
            <MenuScreen />
            <Dock row={guestRow(frame)} rowAt={-20} />
          </GuestPhone>
        </div>

        {/* The words, one station at a time */}
        <div
          style={{
            position: "absolute",
            [ar ? "right" : "left"]: 130,
            top: 0,
            bottom: 0,
            width: 640,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            fontFamily: font,
            direction: ar ? "rtl" : "ltr",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 600, color: C.muted }}>{head}</div>
          <div key={station} style={{ marginTop: 22 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                opacity: interpolate(frame, [stationStart, stationStart + 8], [0, 1], clamp),
                translate: `0px ${interpolate(frame, [stationStart, stationStart + 16], [40, 0], { ...clamp, easing: land })}px`,
              }}
            >
              <span
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  backgroundColor: C.ink,
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: inter,
                  fontSize: 30,
                  fontWeight: 800,
                }}
              >
                {cap.step}
              </span>
              <span style={{ fontSize: ar ? 76 : 84, fontWeight: ar ? 700 : 800, letterSpacing: ar ? 0 : "-0.04em", color: C.ink, lineHeight: 1.15 }}>
                {cap.title}
              </span>
            </div>
            <div
              style={{
                marginTop: 22,
                fontSize: ar ? 34 : 36,
                lineHeight: ar ? 1.6 : 1.35,
                fontWeight: 500,
                color: C.muted,
                opacity: interpolate(frame, [stationStart + 8, stationStart + 18], [0, 1], clamp),
              }}
            >
              {cap.line}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
              {cap.chips.map((c, i) => (
                <div
                  key={c}
                  style={{
                    padding: "12px 22px",
                    borderRadius: 999,
                    fontSize: 25,
                    fontWeight: 700,
                    color: C.ink,
                    backgroundColor: "rgba(255,255,255,0.8)",
                    border: "1px solid #fff",
                    boxShadow: "0 10px 30px -12px rgba(15,23,42,0.25)",
                    opacity: interpolate(frame, [stationStart + 16 + i * 4, stationStart + 22 + i * 4], [0, 1], clamp),
                    scale: `${interpolate(frame, [stationStart + 16 + i * 4, stationStart + 30 + i * 4], [0.6, 1], { ...clamp, easing: land })}`,
                  }}
                >
                  {c}
                </div>
              ))}
            </div>
          </div>
          {/* Progress: four dots, one per app */}
          <div style={{ display: "flex", gap: 10, marginTop: 44 }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 8,
                  width: i === station ? 48 : 8,
                  borderRadius: 4,
                  backgroundColor: i <= station ? C.ink : "rgba(15,23,42,0.18)",
                }}
              />
            ))}
          </div>
        </div>
      </Stage>
    </AbsoluteFill>
  );
};

const schema = {
  headline: { type: "text-content", default: "Follow one order through every app.", description: "Line over the steps" },
} as const satisfies InteractivitySchema;

export const JOURNEY_FRAMES = T.end;

export const Journey = Interactive.withSchema({
  Component: JourneyInner,
  componentName: "<Journey>",
  schema,
  wrapInSequence: true,
});
