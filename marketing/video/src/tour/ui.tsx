// The Ninja apps, redrawn at their real sizes (logical px, as in the source) and
// scaled into device frames. Values follow client_web (Ninja style), admin_web,
// pos_web, kds_web and rider_app.
import {
  Armchair,
  Bike,
  Building2,
  ChevronRight,
  ChevronUp,
  Info,
  Languages,
  PanelLeft,
  Search,
  Sun,
  ClipboardList,
  Coffee,
  Contact,
  CreditCard,
  Gamepad2,
  LayoutDashboard,
  Megaphone,
  Motorbike,
  Palette,
  Plus,
  Radio,
  Receipt,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TabletSmartphone,
  TrendingUp,
  Truck,
  User,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type React from "react";
import { useContext } from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, geist, inter, jakarta, lift, surfer } from "../theme";
import { alexandria, AR, DeviceContext, kufi, plexArabic, useLang, useT, useUnmirror } from "./lang";
import { Sfx } from "./sfx";
import { loadFont as loadPacifico } from "@remotion/google-fonts/Pacifico";

const { fontFamily: pacifico } = loadPacifico("normal", { weights: ["400"], subsets: ["latin"] });

// Each app's Arabic font: the guest app IBM Plex Sans Arabic, the admin Noto Kufi Arabic,
// the till, kitchen and rider Alexandria.
const arabicFor = (font: string) => (font === geist ? kufi : font === inter ? alexandria : plexArabic);

export const S = {
  bg: "#ffffff",
  fg: "#020617",
  primary: "#0f172a",
  muted: "#f1f5f9",
  mutedFg: "#64748b",
  border: "#e2e8f0",
  slab: "#020617",
  emerald: "#10b981",
  emerald400: "#34d399",
  amber400: "#fbbf24",
  amber500: "#f59e0b",
  red: "#dc2626",
  success: "#16a34a",
  surface: "0 1px 2px rgb(0 0 0 / .04), 0 8px 24px -8px rgb(0 0 0 / .16)",
} as const;

// ——— Device frames ———————————————————————————————————————————————

// The light catching the glass: a soft diagonal sheen over every screen.
const Glare: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: "linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 28%, transparent 42%)",
    }}
  />
);

// iOS status bar at 390-pt scale: time on the left, signal, Wi-Fi and battery on the right.
const StatusBar: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const ink = dark ? "#fff" : "#000";
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 30px 0 34px",
        fontFamily: "-apple-system, 'SF Pro Text', Inter, sans-serif",
        fontSize: 16,
        fontWeight: 600,
        color: ink,
        zIndex: 40,
      }}
    >
      <span>9:41</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="18" height="12" viewBox="0 0 18 12">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 5} y={9 - i * 3} width="3" height={3 + i * 3} rx="1" fill={ink} />
          ))}
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12">
          <path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0Z M3.4 6.8a6.5 6.5 0 0 1 9.2 0l-1.4 1.4a4.5 4.5 0 0 0-6.4 0Z M1.2 4.6a9.6 9.6 0 0 1 13.6 0l-1.4 1.4a7.6 7.6 0 0 0-10.8 0Z" fill={ink} />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke={ink} opacity="0.4" />
          <rect x="2" y="2" width="18" height="9" rx="2" fill={ink} />
          <rect x="24.5" y="4.5" width="1.5" height="4" rx="0.75" fill={ink} opacity="0.4" />
        </svg>
      </span>
    </div>
  );
};

// A phone whose screen is the guest app at 390 × 844 logical px.
export const GuestPhone: React.FC<{
  x: number;
  y: number;
  height: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  font?: string;
  screen?: string;
  darkStatus?: boolean;
  label?: string;
}> = ({ x, y, height, children, style, font = jakarta, screen = S.bg, darkStatus, label }) => {
  const ar = useLang() === "ar";
  const unmirror = useUnmirror();
  const bezel = height * 0.018;
  const inner = height - bezel * 2;
  const k = inner / 844;
  const width = 390 * k + bezel * 2;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        padding: bezel,
        borderRadius: height * 0.075,
        backgroundColor: "#18181b",
        boxShadow: `${lift}, inset 0 0 0 2px #3f3f46`,
        ...style,
        ...unmirror,
      }}
    >
      {label ? (
        <div
          style={{
            position: "absolute",
            top: -46,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              padding: "6px 16px",
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.85)",
              border: "1px solid #fff",
              boxShadow: "0 8px 20px -10px rgba(15,23,42,0.3)",
              fontFamily: ar ? plexArabic : geist,
              fontSize: 18,
              fontWeight: 600,
              color: S.fg,
              whiteSpace: "nowrap",
            }}
          >
            {ar ? (AR.labels[label] ?? label) : label}
          </span>
        </div>
      ) : null}
      <div
        style={{
          position: "relative",
          width: 390 * k,
          height: inner,
          borderRadius: height * 0.062,
          overflow: "hidden",
          backgroundColor: screen,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 390,
            height: 844,
            scale: `${k}`,
            transformOrigin: "0 0",
            fontFamily: ar ? arabicFor(font) : font,
            direction: ar ? "rtl" : "ltr",
            color: S.fg,
          }}
        >
          <DeviceContext.Provider value={390}>{children}</DeviceContext.Provider>
          <StatusBar dark={darkStatus} />
          <div
            style={{
              position: "absolute",
              top: 11,
              left: 140,
              width: 110,
              height: 30,
              borderRadius: 999,
              backgroundColor: "#000",
            }}
          />
        </div>
        <Glare />
      </div>
    </div>
  );
};

// A tablet or laptop screen holding a logical canvas (the till, the kitchen, the admin).
export const Screen: React.FC<{
  x: number;
  y: number;
  width: number;
  logical: [number, number];
  children: React.ReactNode;
  style?: React.CSSProperties;
  font?: string;
  bezel?: number;
  screen?: string;
  // Show it in a browser window at this address instead of a tablet.
  browser?: string;
}> = ({ x, y, width, logical, children, style, font = geist, bezel: b = 14, screen = S.bg, browser }) => {
  const ar = useLang() === "ar";
  const unmirror = useUnmirror();
  const bezel = browser ? 0 : b;
  const bar = browser ? 40 : 0;
  const k = (width - bezel * 2) / logical[0];
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height: logical[1] * k + bezel * 2 + bar,
        padding: bezel,
        borderRadius: browser ? 14 : 28,
        backgroundColor: browser ? "#eef0f3" : "#18181b",
        boxShadow: browser
          ? "0 0 0 1px rgba(2,6,24,.08), 0 40px 80px -24px rgba(2,6,24,.35), 0 16px 32px -20px rgba(2,6,24,.25)"
          : `${lift}, inset 0 0 0 2px #3f3f46`,
        overflow: browser ? "hidden" : undefined,
        ...style,
        ...unmirror,
      }}
    >
      {browser ? (
        <div style={{ height: bar, display: "flex", alignItems: "center", gap: 7, padding: "0 14px", direction: "ltr" }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: c }} />
          ))}
          <div
            style={{
              margin: "0 auto",
              height: 24,
              minWidth: 300,
              padding: "0 14px",
              borderRadius: 7,
              backgroundColor: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: geist,
              fontSize: 12,
              color: "#62748e",
            }}
          >
            {browser}
          </div>
          <span style={{ width: 47 }} />
        </div>
      ) : null}
      <div
        style={{
          position: "relative",
          width: logical[0] * k,
          height: logical[1] * k,
          borderRadius: browser ? 0 : 16,
          overflow: "hidden",
          backgroundColor: screen,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: logical[0],
            height: logical[1],
            scale: `${k}`,
            transformOrigin: "0 0",
            fontFamily: ar ? arabicFor(font) : font,
            direction: ar ? "rtl" : "ltr",
            color: S.fg,
          }}
        >
          <DeviceContext.Provider value={logical[0]}>{children}</DeviceContext.Provider>
        </div>
        <Glare />
      </div>
    </div>
  );
};

// A finger tap in logical px.
export const Touch: React.FC<{ x: number; y: number; at: number; size?: number }> = ({ x: x0, y, at, size = 44 }) => {
  const frame = useCurrentFrame();
  const W = useContext(DeviceContext);
  const x = useLang() === "ar" && W ? W - x0 : x0;
  const t = frame - at;
  if (t < -8 || t > 22) return <Sfx name="tap" at={at} />;
  return (
    <>
      <Sfx name="tap" at={at} />
      <div
        style={{
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: "rgba(15,23,42,0.25)",
          border: "2px solid rgba(255,255,255,0.95)",
          zIndex: 50,
          opacity: interpolate(t, [-8, -2, 10, 22], [0, 1, 1, 0], clamp),
          scale: interpolate(t, [-2, 2, 6], [1, 0.8, 1], clamp),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          border: "3px solid rgba(15,23,42,0.35)",
          zIndex: 50,
          opacity: interpolate(t, [0, 16], [0.9, 0], clamp),
          scale: interpolate(t, [0, 16], [1, 2.2], clamp),
        }}
      />
    </>
  );
};

// A dish photo: the app's own menu photos (src/Catalog.API/Pics), copied into public/dishes.
export const Dish: React.FC<{
  img: string;
  size: number | string;
  radius?: number;
  ratio?: string;
  style?: React.CSSProperties;
}> = ({ img, size, radius = 20, ratio = "1 / 1", style }) => (
  <Img
    src={staticFile(`dishes/${img}.jpg`)}
    style={{
      width: size,
      aspectRatio: ratio,
      borderRadius: radius,
      objectFit: "cover",
      flexShrink: 0,
      display: "block",
      ...style,
    }}
  />
);

export const DISHES = {
  latte: { name: "Latte", note: "Double shot, steamed milk", price: 75, img: "latte" },
  mocha: { name: "Iced Mocha", note: "Chocolate, espresso, cream", price: 95, img: "mocha" },
  cappuccino: { name: "Cappuccino", note: "Espresso, velvet foam", price: 70, img: "cappuccino" },
  waffle: { name: "Waffle", note: "Belgian, chocolate drizzle", price: 110, img: "waffle" },
  cake: { name: "Chocolate Cake", note: "Three layers, dark ganache", price: 120, img: "cake" },
  lemonade: { name: "Lemonade", note: "Fresh lemon, ice", price: 65, img: "lemonade" },
} as const;

// ——— Guest app chrome ————————————————————————————————————————————

// The café's logo: Mellow, a made-up café, as a script wordmark in the brand colour.
export const CafeLogo: React.FC<{ height: number; color?: string }> = ({ height, color = S.fg }) => (
  <span style={{ fontFamily: pacifico, fontSize: height * 0.95, lineHeight: 1.2, color, direction: "ltr", display: "inline-block" }}>
    Mellow
  </span>
);

export const TopBar: React.FC<{
  brand?: string;
  color?: string;
  logo?: (color: string, height: number) => React.ReactNode;
}> = ({ color = S.fg, logo }) => {
  return (
  <div
    style={{
      position: "absolute",
      top: 44,
      left: 0,
      right: 0,
      height: 64,
      padding: "0 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: S.bg,
    }}
  >
    {logo ? <div style={{ direction: "ltr" }}>{logo(color, 28)}</div> : <CafeLogo height={28} color={color} />}
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        backgroundColor: S.muted,
        display: "grid",
        placeItems: "center",
      }}
    >
      <ScanLine size={18} color={S.fg} />
    </div>
  </div>
  );
};

export const PageTitle: React.FC<{ title: string; sub?: string; top?: number }> = ({ title, sub, top = 116 }) => {
  const t = useT();
  return (
    <div style={{ position: "absolute", top, left: 16, right: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{t(title)}</div>
      {sub ? <div style={{ fontSize: 14, color: S.mutedFg, marginTop: 4, fontWeight: 500 }}>{t(sub)}</div> : null}
    </div>
  );
};

type Tab = "Menu" | "Book" | "You";
const TABS: { label: Tab; Icon: LucideIcon }[] = [
  { label: "Menu", Icon: Coffee },
  { label: "Book", Icon: Gamepad2 },
  { label: "You", Icon: User },
];

// The floating slab dock: an optional top row (tray or bill) above the three tabs.
export const Dock: React.FC<{ active?: Tab; slab?: string; row?: React.ReactNode; rowAt?: number }> = ({
  active = "Menu",
  slab = S.slab,
  row,
  rowAt = 0,
}) => {
  const frame = useCurrentFrame();
  const t = useT();
  const rowH = row ? interpolate(frame, [rowAt, rowAt + 10], [0, 68], clamp) : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        right: 8,
        bottom: 8,
        borderRadius: 28,
        backgroundColor: slab,
        color: "#fff",
        boxShadow: "0 6px 18px -10px rgb(0 0 0 / .28)",
        overflow: "hidden",
      }}
    >
      {row ? (
        <div
          style={{
            height: rowH,
            overflow: "hidden",
            borderBottom: rowH > 1 ? "1px solid rgba(255,255,255,0.1)" : undefined,
            opacity: interpolate(frame, [rowAt + 4, rowAt + 10], [0, 1], clamp),
          }}
        >
          {row}
        </div>
      ) : null}
      <div style={{ height: 56, display: "flex", alignItems: "center", padding: "0 6px" }}>
        {TABS.map(({ label, Icon }) => {
          const on = label === active;
          return (
            <div
              key={label}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                backgroundColor: on ? "color-mix(in oklab, white 16%, transparent)" : "transparent",
                color: on ? "#fff" : "rgba(255,255,255,0.55)",
              }}
            >
              <Icon size={18} />
              {t(label)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// The dock's bill row: stage icon, status line over the total, the "Your table" pill.
export const BillRow: React.FC<{
  Icon: LucideIcon;
  tone: string;
  line: string;
  total: string;
  pill?: string;
  iconColor?: string;
}> = ({ Icon, tone, line, total, pill = "Your table", iconColor = "#fff" }) => {
  const t = useT();
  return (
  <div style={{ height: 68, display: "flex", alignItems: "center", gap: 12, padding: "0 14px", position: "relative" }}>
    <div
      style={{
        position: "absolute",
        top: 5,
        left: "50%",
        width: 36,
        height: 4,
        marginLeft: -18,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.3)",
      }}
    />
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        backgroundColor: tone,
        display: "grid",
        placeItems: "center",
      }}
    >
      <Icon size={20} color={iconColor} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, opacity: 0.7, fontWeight: 500 }}>{t(line)}</div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{t(total)}</div>
    </div>
    <div
      style={{
        height: 40,
        padding: "0 14px",
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.12)",
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {t(pill)}
      <ChevronUp size={16} />
    </div>
  </div>
  );
};

export const AddButton: React.FC<{ count?: number; primary?: string; style?: React.CSSProperties }> = ({
  count = 0,
  primary = S.primary,
  style,
}) =>
  count > 0 ? (
    <div
      style={{
        height: 44,
        padding: "0 6px",
        borderRadius: 999,
        backgroundColor: primary,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 15,
        fontWeight: 800,
        boxShadow: "0 8px 20px -10px rgb(0 0 0 / .45)",
        ...style,
      }}
    >
      <span style={{ width: 32, textAlign: "center", fontSize: 20 }}>−</span>
      {count}
      <span style={{ width: 32, textAlign: "center", fontSize: 20 }}>+</span>
    </div>
  ) : (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        backgroundColor: primary,
        color: "#fff",
        display: "grid",
        placeItems: "center",
        boxShadow: "0 8px 20px -10px rgb(0 0 0 / .45)",
        ...style,
      }}
    >
      <Plus size={20} strokeWidth={2.5} />
    </div>
  );

// ——— Admin chrome ————————————————————————————————————————————————

const SIDEBAR: { group: string; items: { label: string; Icon: LucideIcon }[] }[] = [
  {
    group: "Today",
    items: [
      { label: "Dashboard", Icon: LayoutDashboard },
      { label: "Live", Icon: Radio },
      { label: "Orders", Icon: ClipboardList },
      { label: "Places", Icon: Armchair },
    ],
  },
  { group: "Menu & stock", items: [{ label: "Menu", Icon: Coffee }, { label: "Stock", Icon: Warehouse }] },
  {
    group: "Money",
    items: [
      { label: "Till", Icon: ReceiptText },
      { label: "Expenses", Icon: Receipt },
      { label: "Suppliers & partners", Icon: Truck },
      { label: "Profit & loss", Icon: TrendingUp },
    ],
  },
  {
    group: "Team",
    items: [
      { label: "Employees", Icon: Contact },
      { label: "Riders", Icon: Motorbike },
      { label: "Login accounts", Icon: ShieldCheck },
    ],
  },
  { group: "Customers", items: [{ label: "Customers", Icon: Users }, { label: "Announcements", Icon: Megaphone }] },
  { group: "Business", items: [{ label: "Branches", Icon: Building2 }, { label: "Brand", Icon: Palette }] },
  {
    group: "Connections",
    items: [
      { label: "Payments", Icon: CreditCard },
      { label: "Talabat", Icon: Bike },
      { label: "Apps", Icon: TabletSmartphone },
      { label: "Ninja assistant", Icon: Sparkles },
    ],
  },
];

// The owner's dashboard at 1280 × 800: inset sidebar, header with breadcrumb, a page.
// ——— The owner's dashboard, as admin_web draws it (shadcn, Geist 400–600, slate) ———

// Admin tokens (admin_web/src/styles/theme.css).
export const A = {
  fg: "#020618",
  primary: "#0f172b",
  muted: "#f1f5f9",
  mutedFg: "#62748e",
  border: "#e2e8f0",
  sidebarFg: "#314158",
  success: "#12a05a",
  warning: "#eea02a",
  danger: "#e7000b",
  chart1: "#4f60e0",
  chart2: "#10a58a",
  chart3: "#e2893a",
  elev1: "0 0 0 1px rgba(2,6,24,.06), 0 1px 2px rgba(2,6,24,.04), 0 2px 6px -2px rgba(2,6,24,.04)",
  float: "0 0 0 1px rgba(2,6,24,.06), 0 24px 48px -12px rgba(2,6,24,.25), 0 12px 24px -16px rgba(2,6,24,.18)",
} as const;

// The inset sidebar layout: white page, 256px sidebar, the content panel lifted by a shadow ring.
export const AdminShell: React.FC<{
  cafe?: string;
  branch?: string;
  active: string;
  crumb: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ cafe = "Mellow", branch, active, crumb, title, actions, children }) => {
  const t = useT();
  const ar = useLang() === "ar";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "#fff",
        display: "flex",
        fontFamily: ar ? kufi : geist,
        fontSize: 14,
        letterSpacing: ar ? 0 : "-0.006em",
        color: A.fg,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div style={{ width: 256, padding: 8, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ height: 48, padding: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: A.fg,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: geist,
            }}
          >
            {cafe.charAt(0)}
          </div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t(cafe)}</div>
            {branch ? <div style={{ fontSize: 12, color: A.mutedFg }}>{t(branch)}</div> : null}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
          {SIDEBAR.map((g) => (
            <div key={g.group} style={{ padding: "0 8px" }}>
              <div
                style={{
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: ar ? 0 : "0.05em",
                  textTransform: "uppercase",
                  color: "#8e96a3",
                }}
              >
                {t(g.group)}
              </div>
              {g.items.map(({ label, Icon }) => {
                const on = label === active;
                return (
                  <div
                    key={label}
                    style={{
                      height: 30,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "0 8px",
                      marginBottom: 2,
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: on ? 500 : 400,
                      color: on ? A.primary : A.sidebarFg,
                      backgroundColor: on ? A.muted : "transparent",
                      boxShadow: on ? A.elev1 : undefined,
                    }}
                  >
                    <Icon size={16} strokeWidth={1.8} />
                    {t(label)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingBottom: 6,
            fontSize: 11,
            color: A.mutedFg,
          }}
        >
          {t("Powered by")} <span style={{ fontFamily: surfer, fontSize: 15, color: A.mutedFg, opacity: 0.8 }}>ninja</span>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          margin: 8,
          marginInlineStart: 0,
          borderRadius: 14,
          backgroundColor: "#fff",
          boxShadow: A.elev1,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Header: trigger + breadcrumb · Go to… · language, theme, avatar */}
        <div
          style={{
            height: 56,
            display: "grid",
            gridTemplateColumns: "1fr minmax(0, 448px) 1fr",
            alignItems: "center",
            gap: 12,
            padding: "0 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}>
            <PanelLeft size={16} color={A.mutedFg} />
            <span style={{ color: A.mutedFg }}>{t(crumb)}</span>
            <ChevronRight size={14} color="rgba(98,116,142,0.6)" style={{ rotate: ar ? "180deg" : undefined }} />
            <span style={{ fontWeight: 500 }}>{t(title)}</span>
          </div>
          <div
            style={{
              height: 36,
              borderRadius: 10,
              backgroundColor: "#f6f8fb",
              boxShadow: A.elev1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 12px",
              color: A.mutedFg,
              fontSize: 14,
            }}
          >
            <Search size={16} />
            <span style={{ flex: 1 }}>{t("Go to…")}</span>
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 4,
                border: `1px solid ${A.border}`,
                backgroundColor: "#fff",
                direction: "ltr",
              }}
            >
              Ctrl K
            </span>
          </div>
          <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 8, color: A.mutedFg }}>
            <Languages size={19} />
            <Sun size={19} style={{ marginInline: 6 }} />
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: A.muted,
                display: "grid",
                placeItems: "center",
                fontSize: 13,
                fontWeight: 500,
                color: A.fg,
                fontFamily: geist,
              }}
            >
              SM
            </div>
          </div>
        </div>
        <div style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 24, lineHeight: "32px", fontWeight: 600, letterSpacing: ar ? 0 : "-0.025em" }}>{t(title)}</div>
              <Info size={14} color={A.mutedFg} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{actions}</div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

// shadcn Button: default (slate navy) or outline (white with a hairline ring).
export const AdminButton: React.FC<{
  children: React.ReactNode;
  primary?: boolean;
  small?: boolean;
  style?: React.CSSProperties;
}> = ({ children, primary, small, style }) => {
  const t = useT();
  return (
    <div
      style={{
        height: small ? 36 : 40,
        padding: small ? "0 12px" : "0 16px",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 14,
        fontWeight: 500,
        backgroundColor: primary ? A.primary : "#fff",
        color: primary ? "#f8fafc" : A.fg,
        boxShadow: primary ? `inset 0 1px 0 rgba(255,255,255,.14), ${A.elev1}` : A.elev1,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {typeof children === "string" ? t(children) : children}
    </div>
  );
};

// The stat strip (stat-strip.tsx): one bordered row, cells divided by hairlines.
export const StatStrip: React.FC<{ stats: { label: string; value: string; tone?: string }[] }> = ({ stats }) => {
  const t = useT();
  return (
    <div style={{ display: "flex", border: `1px solid ${A.border}`, borderRadius: 10, overflow: "hidden", backgroundColor: "#fff" }}>
      {stats.map((s, i) => (
        <div key={s.label} style={{ flex: 1, padding: 16, borderInlineStart: i ? `1px solid ${A.border}` : undefined }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: A.mutedFg }}>{t(s.label)}</div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              marginTop: 4,
              fontVariantNumeric: "tabular-nums",
              color: s.tone ?? A.fg,
            }}
          >
            {t(s.value)}
          </div>
        </div>
      ))}
    </div>
  );
};

// Card: rounded-xl with a shadow ring, no border.
export const AdminCard: React.FC<{ title?: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }> = ({
  title,
  right,
  children,
  style,
}) => {
  const t = useT();
  return (
    <div style={{ borderRadius: 14, boxShadow: A.elev1, backgroundColor: "#fff", padding: "20px 24px", ...style }}>
      {title ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1 }}>{t(title)}</div>
          {right}
        </div>
      ) : null}
      {children}
    </div>
  );
};

// StatusChip: soft badge, rounded-full, leading dot.
export const StatusChip: React.FC<{ tone: "success" | "danger" | "warning" | "muted"; children: string }> = ({ tone, children }) => {
  const t = useT();
  const c = {
    success: { bg: "rgba(18,160,90,.1)", fg: A.success, ring: "rgba(18,160,90,.25)" },
    danger: { bg: "rgba(231,0,11,.08)", fg: A.danger, ring: "rgba(231,0,11,.22)" },
    warning: { bg: "rgba(238,160,42,.15)", fg: "#4f2508", ring: "rgba(238,160,42,.35)" },
    muted: { bg: A.muted, fg: A.mutedFg, ring: A.border },
  }[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        backgroundColor: c.bg,
        color: c.fg,
        boxShadow: `inset 0 0 0 1px ${c.ring}`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "currentColor" }} />
      {t(children)}
    </span>
  );
};
