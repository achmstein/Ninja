// The real screens "The clock" shows, copied from the apps rather than drawn for the film:
// - the customer app's Book tab, booking form, hold panel and room sheet
//   (src/client_app/lib/features/places: places_screen.dart, hold_form.dart,
//   reservation_panel.dart; service_request/widgets/request_tiles.dart)
// - the till's open bills page (src/pos_web/src/features/floor, requests, orders)
// with each app's own words in both languages. Sizes are the apps' logical px.
import {
  Armchair,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  DoorOpen,
  Footprints,
  Gamepad2,
  Hourglass,
  IdCard,
  PackageCheck,
  PanelLeftClose,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  TimerReset,
  X,
  History,
} from "lucide-react";
import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { clamp, land } from "../theme";
import { useLang } from "./lang";
import { S } from "./ui";

// ——— The apps' own words ———————————————————————————————————————————————
const CLIENT = {
  book: { en: "Book", ar: "احجز" },
  free3: { en: "3 free now", ar: "3 فاضيين دلوقتي" },
  available: { en: "Available", ar: "متاحة" },
  occupied: { en: "Occupied", ar: "مشغولة" },
  reserved: { en: "Reserved", ar: "محجوزة" },
  reserveNow: { en: "Reserve Now", ar: "احجز دلوقتي" },
  arrive: { en: "10 minutes to arrive", ar: "عندك 10 دقايق توصل" },
  startNow: { en: "Start the time now, don't wait for me", ar: "ابدأ الوقت دلوقتي" },
  heldFor: { en: "Held for you", ar: "محجوزة ليك" },
  walkOver: { en: "Walk over and show this at the counter", ar: "تعالى ووري ده للكاشير" },
  startsOnConfirm: { en: "The time starts as soon as it's confirmed", ar: "الوقت هيبدأ أول ما الحجز يتأكد" },
  cancelReservation: { en: "Cancel Reservation", ar: "الغي الحجز" },
  clockRunning: { en: "Clock running", ar: "العداد شغال" },
  yourRoom: { en: "Your room", ar: "أوضتك" },
  otherPlaces: { en: "Other places", ar: "أماكن تانية" },
  waiter: { en: "Waiter", ar: "الويتر" },
  getBill: { en: "Get Bill", ar: "الشيك" },
  controller: { en: "Controller", ar: "دراع" },
  sent: { en: "Sent", ar: "اتبعت" },
  tapToCancel: { en: "Tap to cancel", ar: "دوس للإلغاء" },
  onTheWay: { en: "On the way", ar: "جايلك" },
  you: { en: "You", ar: "إنت" },
  players: { en: "PS5 · up to 4 players", ar: "PS5 · لحد 4 لاعيبة" },
  perHour: { en: "/hour", ar: "/ساعة" },
} as const;

const TILL = {
  openBills: { en: "Open bills", ar: "الفواتير المفتوحة" },
  newSale: { en: "New sale", ar: "بيع جديد" },
  requests: { en: "Requests", ar: "الطلبات" },
  changeController: { en: "Change controller", ar: "تغيير ذراع التحكم" },
  acknowledge: { en: "Acknowledge", ar: "تم الاستلام" },
  done: { en: "Done", ar: "تم" },
  rooms: { en: "Rooms", ar: "الغرف" },
  newTab: { en: "New tab", ar: "فاتورة جديدة" },
  search: { en: "Search rooms and tables", ar: "ابحث عن غرفة أو طاولة" },
  waiting: { en: "Waiting for confirmation", ar: "بانتظار التأكيد" },
  confirm: { en: "Confirm", ar: "تأكيد" },
  justNow: { en: "just now", ar: "الآن" },
  all: { en: "All", ar: "الكل" },
  reserved: { en: "Reserved", ar: "محجوزة" },
  main: { en: "Main branch", ar: "الفرع الرئيسي" },
} as const;

export const useClient = () => {
  const ar = useLang() === "ar";
  return (k: keyof typeof CLIENT) => (ar ? CLIENT[k].ar : CLIENT[k].en);
};
const useTill = () => {
  const ar = useLang() === "ar";
  return (k: keyof typeof TILL) => (ar ? TILL[k].ar : TILL[k].en);
};

// ——— Shared bits ——————————————————————————————————————————————————————
export const hms = (s: number) =>
  `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const money = (n: number) => `EGP ${Number.isInteger(n) ? n : n.toFixed(2)}`;

// Flutter's Color.lerp between two hex colours, for the dark sheet's mixed roles.
export const mix = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
};

const GREEN = "#34D399"; // NinjaColors.success
const GREEN_SOLID = "#10B981";
const AMBER = "#FBBF24"; // NinjaColors.warning
const AMBER_SOLID = "#F59E0B";
const RADIUS = { card: 28, panel: 24, tile: 20 };
const SLAB_SHADOW = "0 6px 18px -10px rgba(0,0,0,0.28)";
const CTA_SHADOW = "0 8px 20px -10px rgba(0,0,0,0.45)";
const TYPE = { title: 25.6, body: 15, note: 14, caption: 13 };

const StatusPill: React.FC<{ label: string; dot: string; ink: string; bg: string }> = ({ label, dot, ink, bg }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, backgroundColor: bg, fontSize: TYPE.caption, fontWeight: 700, color: ink }}>
    <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />
    {label}
  </span>
);

// The page's large title, as NinjaPage draws it: the title, how many are free, the history button.
export const BookHeader: React.FC<{ sub: string }> = ({ sub }) => {
  const u = useClient();
  return (
    <div style={{ position: "absolute", top: 120, left: 16, right: 16, display: "flex", alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: TYPE.title, lineHeight: 1.15, fontWeight: 800, letterSpacing: "-0.02em" }}>{u("book")}</div>
        <div style={{ fontSize: TYPE.body, color: S.mutedFg, marginTop: 4 }}>{sub}</div>
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: S.muted, display: "grid", placeItems: "center" }}>
        <History size={18} />
      </div>
    </div>
  );
};

// ——— The Book tab: a free place on the slab, its booking sliding in under it ————————
export type BookTimes = { open: number; toggle: number; reserve: number; panel: number };

export const PlaceCard: React.FC<{
  name: string;
  rate: number;
  slab: string;
  free: boolean;
  status?: "occupied" | "reserved";
  plus?: { openAt: number };
  children?: React.ReactNode;
}> = ({ name, rate, slab, free, status = "occupied", plus, children }) => {
  const frame = useCurrentFrame();
  const u = useClient();
  const ink = free ? "#fff" : S.fg;
  const turn = plus ? interpolate(frame, [plus.openAt, plus.openAt + 10], [0, 45], { ...clamp, easing: land }) : 0;
  return (
    <div
      style={{
        borderRadius: RADIUS.card,
        overflow: "hidden",
        backgroundColor: free ? slab : "#fff",
        boxShadow: free ? SLAB_SHADOW : S.surface,
        color: ink,
      }}
    >
      <div style={{ position: "relative", padding: 20, overflow: "hidden" }}>
        <Gamepad2 size={176} style={{ position: "absolute", insetInlineEnd: -24, bottom: -32, rotate: "-12deg", opacity: free ? 0.12 : 0.06 }} color={ink} />
        <div style={{ display: "flex", alignItems: "center" }}>
          {free ? (
            <StatusPill label={u("available")} dot={GREEN} ink={GREEN} bg="rgba(52,211,153,0.2)" />
          ) : (
            <StatusPill
              label={u(status)}
              dot={status === "reserved" ? AMBER : S.red}
              ink={status === "reserved" ? "#b45309" : S.red}
              bg={S.muted}
            />
          )}
          <span style={{ flex: 1 }} />
          {plus ? (
            <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", display: "grid", placeItems: "center", rotate: `${turn}deg` }}>
              <Plus size={20} color={slab} />
            </div>
          ) : null}
        </div>
        <div style={{ marginTop: 16, fontSize: TYPE.title, lineHeight: 1.15, fontWeight: 800, letterSpacing: "-0.02em" }}>{name}</div>
        <div style={{ marginTop: 6, fontSize: TYPE.note, color: free ? "rgba(255,255,255,0.8)" : S.mutedFg }}>{u("players")}</div>
        <div
          style={{
            display: "inline-block",
            marginTop: 10,
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: TYPE.caption,
            fontWeight: 600,
            backgroundColor: free ? "rgba(255,255,255,0.12)" : S.muted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {`${rate}${u("perHour")}`}
        </div>
      </div>
      {children}
    </div>
  );
};

// The booking under the card (hold_form.dart): the window to arrive in, the start-now switch, one button.
export const HoldForm: React.FC<{ t: BookTimes; primary: string }> = ({ t, primary }) => {
  const frame = useCurrentFrame();
  const u = useClient();
  const h = interpolate(frame, [t.open, t.open + 12], [0, 212], { ...clamp, easing: land });
  const on = frame >= t.toggle;
  const knob = interpolate(frame, [t.toggle, t.toggle + 6], [0, 1], clamp);
  const busy = frame >= t.reserve + 2 && frame < t.reserve + 16;
  const done = frame >= t.reserve + 16;
  const idle = !busy && !done;
  const w = interpolate(frame, [t.reserve + 2, t.reserve + 12], [100, 0], { ...clamp, easing: land });
  return (
    <div style={{ height: h, overflow: "hidden" }}>
      <div style={{ margin: "0 6px 6px", padding: 16, borderRadius: 22, backgroundColor: "#fff", color: S.fg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `color-mix(in srgb, ${primary} 10%, transparent)`, display: "grid", placeItems: "center" }}>
            <Clock size={20} color={primary} />
          </div>
          <div style={{ fontSize: TYPE.body, fontWeight: 600 }}>{u("arrive")}</div>
        </div>
        <div style={{ marginTop: 12, minHeight: 48, padding: "8px 16px", borderRadius: 16, backgroundColor: "rgba(241,245,249,0.6)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, fontSize: TYPE.note, fontWeight: 500 }}>{u("startNow")}</div>
          <div style={{ width: 44, height: 26, borderRadius: 13, padding: 3, backgroundColor: on ? primary : "#cbd5e1", direction: "ltr" }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", translate: `${knob * 18}px 0px`, boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
          </div>
        </div>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
          <div
            style={{
              height: 48,
              width: `calc(48px + (100% - 48px) * ${w / 100})`,
              borderRadius: 24,
              backgroundColor: done ? GREEN_SOLID : primary,
              boxShadow: idle ? CTA_SHADOW : undefined,
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontSize: TYPE.body,
              fontWeight: 700,
              overflow: "hidden",
              whiteSpace: "nowrap",
              scale: `${interpolate(frame, [t.reserve, t.reserve + 3, t.reserve + 10], [1, 0.96, 1], clamp)}`,
            }}
          >
            {done ? (
              <Check size={24} />
            ) : busy ? (
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff",
                  rotate: `${frame * 24}deg`,
                }}
              />
            ) : (
              u("reserveNow")
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// The hold (reservation_panel.dart): the tab becomes one slab, the time running down round a ring.
export const HoldPanel: React.FC<{ at: number; name: string; slab: string; startNow: boolean }> = ({ at, name, slab, startNow }) => {
  const frame = useCurrentFrame();
  const u = useClient();
  const total = 600;
  const left = Math.max(0, total - Math.floor(Math.max(0, frame - at) / 30));
  const beat = (k: number) => {
    const p = interpolate(frame, [at + k * 27, at + k * 27 + 12], [0, 1], { ...clamp, easing: land });
    return { opacity: p, translate: `0px ${16 * (1 - p)}px` };
  };
  const drawn = interpolate(frame, [at + 4, at + 22], [0, 1], { ...clamp, easing: land });
  const r = 103;
  const len = 2 * Math.PI * r;
  const share = (left / total) * drawn;
  return (
    <div
      style={{
        position: "absolute",
        top: 116,
        left: 8,
        right: 8,
        bottom: 80,
        borderRadius: 32,
        backgroundColor: slab,
        boxShadow: SLAB_SHADOW,
        color: "#fff",
        padding: "28px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        opacity: interpolate(frame, [at - 4, at + 4], [0, 1], clamp),
        scale: `${interpolate(frame, [at - 4, at + 10], [0.96, 1], { ...clamp, easing: land })}`,
      }}
    >
      <div style={beat(0)}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, backgroundColor: "rgba(251,191,36,0.15)", color: AMBER_SOLID, fontSize: TYPE.caption, fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: AMBER_SOLID }} />
          {u("heldFor")}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ position: "relative", width: 216, height: 216, ...beat(0.1) }}>
          <svg width={216} height={216} style={{ position: "absolute", inset: 0 }}>
            <circle cx={108} cy={108} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={10} />
            <circle
              cx={108}
              cy={108}
              r={r}
              fill="none"
              stroke={AMBER}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={len}
              strokeDashoffset={len * (1 - share)}
              transform="rotate(-90 108 108)"
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 52, fontWeight: 800, letterSpacing: -1, fontVariantNumeric: "tabular-nums", direction: "ltr" }}>
            {mmss(left)}
          </div>
        </div>
        <div style={{ marginTop: 16, fontSize: TYPE.title, fontWeight: 800, letterSpacing: "-0.02em" }}>{name}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, ...beat(0.45) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: TYPE.body, fontWeight: 600 }}>
          <Footprints size={16} /> {u("walkOver")}
        </div>
        {startNow ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: TYPE.caption, color: mix(slab.length === 7 ? slab : "#1a0b33", "#ffffff", 0.62) }}>
            <TimerReset size={14} /> {u("startsOnConfirm")}
          </div>
        ) : null}
      </div>
      <div style={{ width: 240, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: TYPE.note, fontWeight: 600, ...beat(0.6) }}>
        <X size={16} /> {u("cancelReservation")}
      </div>
    </div>
  );
};

// ——— The room the customer is in (places_screen.dart YourRoomCard) ——————————————
export const YourRoomCard: React.FC<{ name: string; secs: number; slab: string; pressAt?: number }> = ({ name, secs, slab, pressAt = -99 }) => {
  const frame = useCurrentFrame();
  const u = useClient();
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        padding: 20,
        borderRadius: RADIUS.card,
        backgroundColor: slab,
        boxShadow: SLAB_SHADOW,
        color: "#fff",
        scale: `${interpolate(frame, [pressAt, pressAt + 3, pressAt + 10], [1, 0.98, 1], clamp)}`,
      }}
    >
      <Gamepad2 size={176} color="#fff" style={{ position: "absolute", insetInlineEnd: -24, bottom: -32, rotate: "-12deg", opacity: 0.12 }} />
      <div style={{ display: "flex", alignItems: "center" }}>
        <StatusPill label={u("clockRunning")} dot={GREEN} ink={GREEN} bg="rgba(52,211,153,0.2)" />
        <span style={{ flex: 1 }} />
        <span style={{ height: 36, display: "inline-flex", alignItems: "center", gap: 4, paddingInlineStart: 14, paddingInlineEnd: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", fontSize: TYPE.note, fontWeight: 600 }}>
          {u("yourRoom")} <ChevronUp size={16} />
        </span>
      </div>
      <div style={{ marginTop: 16, fontSize: TYPE.title, fontWeight: 800, letterSpacing: "-0.02em" }}>{name}</div>
      <div style={{ marginTop: 4, fontSize: 40, lineHeight: 1.1, fontWeight: 800, letterSpacing: -0.5, fontVariantNumeric: "tabular-nums", direction: "ltr", textAlign: "start" }}>{hms(secs)}</div>
    </div>
  );
};

export type RequestPhase = "idle" | "sent" | "onTheWay";

// The room sheet (showRoomSheet): the dock's slab grown up, the clock, who is in the room, what to ask for.
export const RoomSheet: React.FC<{
  at: number;
  closeAt?: number;
  slab: string;
  primary: string;
  secs: number;
  members: string[];
  controller: RequestPhase;
}> = ({ at, closeAt = 9999, slab, primary, secs, members, controller }) => {
  const frame = useCurrentFrame();
  const u = useClient();
  const up = interpolate(frame, [at, at + 14], [0, 1], { ...clamp, easing: land }) * (1 - interpolate(frame, [closeAt, closeAt + 10], [0, 1], clamp));
  if (up <= 0) return null;
  const muted = mix(slab, "#ffffff", 0.1);
  const mutedFg = mix(slab, "#ffffff", 0.62);
  const tiles: { label: string; Icon: typeof Bell; phase: RequestPhase }[] = [
    { label: u("waiter"), Icon: Bell, phase: "idle" },
    { label: u("getBill"), Icon: ReceiptText, phase: "idle" },
    { label: u("controller"), Icon: Gamepad2, phase: controller },
  ];
  return (
    <>
      <div style={{ position: "absolute", inset: 0, backgroundColor: `rgba(0,0,0,${0.45 * up})`, backdropFilter: `blur(${2 * up}px)`, zIndex: 30 }} />
      <div
        style={{
          position: "absolute",
          left: 8,
          right: 8,
          bottom: 8,
          borderRadius: 28,
          backgroundColor: slab,
          boxShadow: "0 24px 60px -16px rgba(0,0,0,0.55)",
          color: "#fff",
          zIndex: 31,
          translate: `0px ${(1 - up) * 520}px`,
          overflow: "hidden",
        }}
      >
        <div style={{ height: 28, display: "grid", placeItems: "center" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" }} />
        </div>
        <div style={{ position: "relative", padding: "0 20px 20px" }}>
          <Gamepad2 size={176} color="#fff" style={{ position: "absolute", insetInlineEnd: -4, top: -20, rotate: "12deg", opacity: 0.07 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: TYPE.caption, fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN }} />
            {u("clockRunning")}
          </div>
          <div style={{ marginTop: 20, fontSize: 52, lineHeight: 1, fontWeight: 800, letterSpacing: -1, fontVariantNumeric: "tabular-nums", direction: "ltr", textAlign: "start" }}>{hms(secs)}</div>
          <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {members.map((m, i) => (
              <span key={m} style={{ padding: "4px 12px", borderRadius: 999, fontSize: TYPE.caption, fontWeight: 600, backgroundColor: i === 0 ? "#fff" : muted, color: i === 0 ? slab : "#fff" }}>
                {i === 0 ? u("you") : m}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
            {tiles.map(({ label, Icon, phase }) => {
              const fill = phase === "onTheWay" ? "rgba(16,185,129,0.15)" : phase === "sent" ? `color-mix(in srgb, ${primary} 12%, transparent)` : muted;
              const disc = phase === "onTheWay" ? GREEN_SOLID : phase === "sent" ? primary : slab;
              const Shown = phase === "onTheWay" ? Check : phase === "sent" ? Hourglass : Icon;
              return (
                <div key={label} style={{ flex: 1, minHeight: 112, padding: 16, borderRadius: RADIUS.panel, backgroundColor: fill, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: disc, display: "grid", placeItems: "center" }}>
                    <Shown size={20} color="#fff" />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: TYPE.note, fontWeight: 600, lineHeight: 1.3 }}>{label}</div>
                    {phase !== "idle" ? <div style={{ fontSize: TYPE.caption, color: mutedFg }}>{u(phase === "sent" ? "sent" : "onTheWay")}</div> : null}
                    {phase === "sent" ? <div style={{ fontSize: 11, color: mutedFg }}>{u("tapToCancel")}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

// ——— The till: the open bills page (pos_web features/floor) ——————————————————
export type TillBill = { name: string; secs?: number; total: number; kind?: "room" | "table" };
export type TillRequest = { room: string; at: number; ackAt?: number };
export type TillOrder = { room: string; number: number; who: string; total: number; at: number; confirmAt?: number };
const POS = { primary: "#0f172a", border: "#e2e8f0", card: "#fff", muted: "#f1f5f9", mutedFg: "#64748b", amber: "#d97706" };

const Btn: React.FC<{ children: React.ReactNode; primary?: boolean; style?: React.CSSProperties }> = ({ children, primary, style }) => (
  <div
    style={{
      height: 44,
      padding: "0 14px",
      borderRadius: 8,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      fontSize: 15,
      fontWeight: 500,
      backgroundColor: primary ? POS.primary : "#fff",
      color: primary ? "#fff" : POS.primary,
      border: primary ? "none" : `1px solid ${POS.border}`,
      boxShadow: primary ? undefined : "0 1px 2px rgba(0,0,0,0.05)",
      ...style,
    }}
  >
    {children}
  </div>
);

const Heading: React.FC<{ icon?: React.ReactNode; children: React.ReactNode; count?: number }> = ({ icon, children, count }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    {icon}
    <div style={{ fontSize: 18, fontWeight: 600 }}>{children}</div>
    {count ? (
      <span style={{ height: 24, minWidth: 24, padding: "0 8px", borderRadius: 6, backgroundColor: POS.primary, color: "#fff", fontSize: 12, fontWeight: 600, display: "grid", placeItems: "center" }}>{count}</span>
    ) : null}
  </div>
);

// The till's header and the floor's own: the branch, then Open bills with New sale.
const TillTop: React.FC<{ biz: string }> = ({ biz }) => {
  const t = useTill();
  return (
    <>
      <div style={{ height: 64, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderBottom: `1px solid ${POS.border}`, backgroundColor: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 10px", height: 44, borderRadius: 8 }}>
          <Store size={20} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>{biz}</span>
          <span style={{ fontSize: 14, color: POS.mutedFg }}>{t("main")}</span>
          <ChevronDown size={16} color={POS.mutedFg} />
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ width: 48, height: 48, display: "grid", placeItems: "center" }}>
          <Settings size={20} />
        </div>
      </div>
    </>
  );
};

const SectionTop: React.FC = () => {
  const t = useTill();
  return (
    <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderBottom: `1px solid ${POS.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 40, height: 40, display: "grid", placeItems: "center", color: POS.mutedFg }}>
          <PanelLeftClose size={20} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{t("openBills")}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn primary style={{ height: 48, padding: "0 20px", fontSize: 16 }}>
          <ShoppingCart size={20} /> {t("newSale")}
        </Btn>
        {[ReceiptText, IdCard, PackageCheck].map((I, i) => (
          <Btn key={i} style={{ width: 48, height: 48, padding: 0 }}>
            <I size={20} />
          </Btn>
        ))}
      </div>
    </div>
  );
};

const RequestCard: React.FC<{ r: TillRequest }> = ({ r }) => {
  const frame = useCurrentFrame();
  const t = useTill();
  const acked = r.ackAt !== undefined && frame >= r.ackAt + 2;
  const pressed = r.ackAt !== undefined ? interpolate(frame, [r.ackAt, r.ackAt + 3, r.ackAt + 8], [1, 0.95, 1], clamp) : 1;
  return (
    <div style={{ width: 280, padding: 12, borderRadius: 12, border: `1px solid ${POS.border}`, backgroundColor: POS.card, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(245,158,11,0.1)", display: "grid", placeItems: "center" }}>
          <Gamepad2 size={20} color={POS.amber} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 16, fontWeight: 600 }}>
            <DoorOpen size={16} color={POS.mutedFg} /> {r.room}
          </div>
          <div style={{ fontSize: 14, color: POS.mutedFg, whiteSpace: "nowrap" }}>
            {t("changeController")} · {t("justNow")}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {!acked ? (
          <Btn style={{ flex: 1, scale: `${pressed}` }}>
            <Check size={20} /> {t("acknowledge")}
          </Btn>
        ) : null}
        <Btn primary style={{ flex: 1 }}>
          {t("done")}
        </Btn>
      </div>
    </div>
  );
};

const OrderCard: React.FC<{ o: TillOrder }> = ({ o }) => {
  const frame = useCurrentFrame();
  const t = useTill();
  const pressed = o.confirmAt !== undefined ? interpolate(frame, [o.confirmAt, o.confirmAt + 3, o.confirmAt + 8], [1, 0.95, 1], clamp) : 1;
  return (
    <div style={{ width: 320, padding: 12, borderRadius: 12, border: `1px solid ${POS.border}`, backgroundColor: POS.card, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600 }}>
          <DoorOpen size={16} color={POS.mutedFg} /> {o.room}
        </div>
        <div style={{ fontSize: 14, color: POS.mutedFg, marginTop: 2 }}>
          #{o.number} · {o.who}
        </div>
        <div style={{ fontSize: 14, color: POS.mutedFg, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
          {t("justNow")} · {money(o.total)}
        </div>
      </div>
      <Btn primary style={{ height: 48, padding: "0 16px", scale: `${pressed}` }}>
        <Check size={20} /> {t("confirm")}
      </Btn>
    </div>
  );
};

const BillCard: React.FC<{ b: TillBill; popAt?: number }> = ({ b, popAt = -99 }) => {
  const frame = useCurrentFrame();
  const Icon = b.kind === "table" ? Armchair : DoorOpen;
  return (
    <div
      style={{
        minHeight: 112,
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${POS.border}`,
        backgroundColor: POS.card,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        scale: `${interpolate(frame, [popAt, popAt + 4, popAt + 14], [1, 1.06, 1], clamp)}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <Icon size={16} color={POS.mutedFg} style={{ marginTop: 2 }} />
        <div style={{ fontSize: 16, fontWeight: 600 }}>{b.name}</div>
      </div>
      {b.secs !== undefined ? (
        <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 14, color: POS.mutedFg, fontVariantNumeric: "tabular-nums", direction: "ltr", textAlign: "start" }}>{hms(b.secs)}</div>
      ) : null}
      <div style={{ marginTop: "auto", fontSize: 18, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{money(b.total)}</div>
    </div>
  );
};

const enterStyle = (frame: number, at: number): React.CSSProperties => ({
  opacity: interpolate(frame, [at, at + 6], [0, 1], clamp),
  translate: `0px ${interpolate(frame, [at, at + 12], [-14, 0], { ...clamp, easing: land })}px`,
});

// The section of the open bills page: requests, app orders waiting, reservations, the bills.
export const TillBills: React.FC<{
  bills: TillBill[];
  requests?: TillRequest[];
  orders?: TillOrder[];
  reserved?: { room: string; who: string; left: number };
  popAt?: Record<string, number>;
}> = ({ bills, requests = [], orders = [], reserved, popAt = {} }) => {
  const frame = useCurrentFrame();
  const t = useTill();
  const shownReq = requests.filter((r) => frame >= r.at);
  const shownOrd = orders.filter((o) => frame >= o.at && (o.confirmAt === undefined || frame < o.confirmAt + 6));
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <SectionTop />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 20 }}>
        {shownReq.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, ...enterStyle(frame, Math.min(...shownReq.map((r) => r.at))) }}>
            <Heading icon={<Bell size={20} color={POS.amber} />} count={shownReq.length}>
              {t("requests")}
            </Heading>
            <div style={{ display: "flex", gap: 12 }}>
              {shownReq.map((r) => (
                <RequestCard key={r.room} r={r} />
              ))}
            </div>
          </div>
        ) : null}
        {shownOrd.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, ...enterStyle(frame, Math.min(...shownOrd.map((o) => o.at))) }}>
            <Heading icon={<ShoppingBag size={20} color={POS.amber} />} count={shownOrd.length}>
              {t("waiting")}
            </Heading>
            <div style={{ display: "flex", gap: 12 }}>
              {shownOrd.map((o) => (
                <OrderCard key={o.number} o={o} />
              ))}
            </div>
          </div>
        ) : null}
        {reserved ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: POS.mutedFg }}>{t("reserved")}</div>
            <div style={{ width: 240, padding: 12, borderRadius: 12, border: `1px solid ${POS.border}`, backgroundColor: POS.card, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(245,158,11,0.1)", display: "grid", placeItems: "center" }}>
                <TimerReset size={20} color={POS.amber} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{reserved.room}</div>
                <div style={{ fontSize: 14, color: POS.mutedFg }}>{reserved.who}</div>
              </div>
              <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 14, color: POS.amber, direction: "ltr" }}>{mmss(Math.max(0, reserved.left - Math.floor(frame / 30)))}</div>
            </div>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8 }}>
          {[
            [t("all"), bills.length],
            [t("rooms"), bills.filter((b) => b.kind !== "table").length],
          ].map(([label, n], i) => (
            <div
              key={String(label)}
              style={{
                height: 44,
                padding: "0 18px",
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 15,
                fontWeight: 500,
                backgroundColor: i === 0 ? POS.primary : "#fff",
                color: i === 0 ? "#fff" : POS.primary,
                border: i === 0 ? "none" : `1px solid ${POS.border}`,
              }}
            >
              {label}
              <span style={{ padding: "1px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600, backgroundColor: i === 0 ? "rgba(255,255,255,0.15)" : POS.muted }}>{n}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 220px)", gap: 12 }}>
          {bills.map((b) => (
            <BillCard key={b.name} b={b} popAt={popAt[b.name]} />
          ))}
        </div>
      </div>
    </div>
  );
};

// The whole till: its header, the places column, the open bills.
export const TillFloor: React.FC<{
  biz: string;
  places: { name: string; dot: string; detail?: string }[];
  children: React.ReactNode;
}> = ({ biz, places, children }) => {
  const t = useTill();
  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: "#fff", color: POS.primary }}>
      <TillTop biz={biz} />
      <div style={{ display: "flex", height: "calc(100% - 64px)" }}>
        <div style={{ width: 288, flexShrink: 0, borderInlineEnd: `1px solid ${POS.border}`, display: "flex", flexDirection: "column" }}>
          <div style={{ height: 64, display: "flex", alignItems: "center", padding: "0 12px", borderBottom: `1px solid ${POS.border}` }}>
            <div style={{ position: "relative", width: "100%", height: 44, borderRadius: 8, border: `1px solid ${POS.border}`, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", color: POS.mutedFg, fontSize: 15 }}>
              <Search size={16} /> {t("search")}
            </div>
          </div>
          <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ height: 48, display: "flex", alignItems: "center", gap: 12, padding: "0 12px" }}>
              <Plus size={20} color={POS.mutedFg} />
              <span style={{ flex: 1, fontWeight: 500 }}>{t("newTab")}</span>
              <ShoppingBag size={16} color={POS.mutedFg} />
            </div>
            <div style={{ marginTop: 8, padding: "0 12px", fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: POS.mutedFg }}>{t("rooms")}</div>
            {places.map((p) => (
              <div key={p.name} style={{ height: 48, display: "flex", alignItems: "center", gap: 12, padding: "0 12px" }}>
                <span style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.dot }} />
                <span style={{ flex: 1, fontWeight: 500 }}>{p.name}</span>
                {p.detail ? <span style={{ fontSize: 14, color: POS.mutedFg }}>{p.detail}</span> : null}
                <DoorOpen size={16} color={POS.mutedFg} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
};

export const TILL_COLORS = POS;
