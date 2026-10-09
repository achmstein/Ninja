// The Ninja apps, redrawn at their real sizes (logical px, as in the source) and
// scaled into device frames. Values follow client_web (Ninja style), admin_web,
// pos_web, kds_web and rider_app.
import {
  Armchair,
  Bike,
  Building2,
  ChevronUp,
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
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, geist, jakarta, lift } from "../theme";

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
}> = ({ x, y, height, children, style, font = jakarta, screen = S.bg, darkStatus }) => {
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
      }}
    >
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
            fontFamily: font,
            color: S.fg,
          }}
        >
          {children}
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
}> = ({ x, y, width, logical, children, style, font = geist, bezel = 14, screen = S.bg }) => {
  const k = (width - bezel * 2) / logical[0];
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height: logical[1] * k + bezel * 2,
        padding: bezel,
        borderRadius: 28,
        backgroundColor: "#18181b",
        boxShadow: `${lift}, inset 0 0 0 2px #3f3f46`,
        ...style,
      }}
    >
      <div
        style={{
          position: "relative",
          width: logical[0] * k,
          height: logical[1] * k,
          borderRadius: 16,
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
            fontFamily: font,
            color: S.fg,
          }}
        >
          {children}
        </div>
        <Glare />
      </div>
    </div>
  );
};

// A finger tap in logical px.
export const Touch: React.FC<{ x: number; y: number; at: number; size?: number }> = ({ x, y, at, size = 44 }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < -8 || t > 22) return null;
  return (
    <>
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

export const TopBar: React.FC<{ brand?: string; color?: string }> = ({ brand = "Layla", color = S.fg }) => (
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
    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color }}>{brand}</div>
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

export const PageTitle: React.FC<{ title: string; sub?: string; top?: number }> = ({ title, sub, top = 116 }) => (
  <div style={{ position: "absolute", top, left: 16, right: 16 }}>
    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</div>
    {sub ? <div style={{ fontSize: 14, color: S.mutedFg, marginTop: 4, fontWeight: 500 }}>{sub}</div> : null}
  </div>
);

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
              {label}
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
}> = ({ Icon, tone, line, total, pill = "Your table", iconColor = "#fff" }) => (
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
      <div style={{ fontSize: 13, opacity: 0.7, fontWeight: 500 }}>{line}</div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{total}</div>
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
      {pill}
      <ChevronUp size={16} />
    </div>
  </div>
);

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
export const AdminShell: React.FC<{
  cafe?: string;
  branch?: string;
  active: string;
  crumb: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ cafe = "Café Layla", branch = "Zamalek", active, crumb, title, description, actions, children }) => (
  <div style={{ position: "absolute", inset: 0, backgroundColor: "#f8fafc", display: "flex", fontFamily: geist }}>
    <div style={{ width: 232, padding: "14px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 8px" }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: S.primary,
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          {cafe.replace(/^(The|Café) /, "").charAt(0)}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{cafe}</div>
          <div style={{ fontSize: 11, color: S.mutedFg }}>{branch}</div>
        </div>
      </div>
      {SIDEBAR.map((g) => (
        <div key={g.group}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              opacity: 0.55,
              padding: "0 8px 4px",
            }}
          >
            {g.group}
          </div>
          {g.items.map(({ label, Icon }) => {
            const on = label === active;
            return (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  height: 28,
                  padding: "0 8px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: on ? 600 : 500,
                  color: on ? S.fg : "#334155",
                  backgroundColor: on ? S.muted : "transparent",
                  boxShadow: on ? "0 1px 2px rgb(0 0 0 / .05)" : undefined,
                }}
              >
                <Icon size={15} />
                {label}
              </div>
            );
          })}
        </div>
      ))}
    </div>
    <div
      style={{
        flex: 1,
        margin: 8,
        marginLeft: 0,
        borderRadius: 14,
        backgroundColor: S.bg,
        boxShadow: "0 1px 3px rgb(0 0 0 / .08)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 24px",
          borderBottom: `1px solid ${S.border}`,
          fontSize: 14,
        }}
      >
        <span style={{ color: S.mutedFg }}>{crumb}</span>
        <span style={{ color: S.mutedFg }}>›</span>
        <span style={{ fontWeight: 500 }}>{title}</span>
        <div
          style={{
            marginLeft: "auto",
            marginRight: "auto",
            width: 360,
            height: 36,
            borderRadius: 10,
            border: `1px solid ${S.border}`,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            color: S.mutedFg,
            fontSize: 13,
          }}
        >
          Go to…
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              border: `1px solid ${S.border}`,
              borderRadius: 5,
              padding: "1px 5px",
            }}
          >
            ⌘K
          </span>
        </div>
      </div>
      <div style={{ padding: "18px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</div>
            {description ? (
              <div style={{ fontSize: 14, color: S.mutedFg, marginTop: 4 }}>{description}</div>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 8 }}>{actions}</div>
        </div>
        <div style={{ marginTop: 20 }}>{children}</div>
      </div>
    </div>
  </div>
);

export const AdminButton: React.FC<{ children: React.ReactNode; primary?: boolean; style?: React.CSSProperties }> = ({
  children,
  primary,
  style,
}) => (
  <div
    style={{
      height: 36,
      padding: "0 14px",
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 13,
      fontWeight: 600,
      backgroundColor: primary ? S.primary : S.bg,
      color: primary ? "#fff" : S.fg,
      border: primary ? undefined : `1px solid ${S.border}`,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </div>
);

// One bordered row of stats (stat-strip.tsx).
export const StatStrip: React.FC<{ stats: { label: string; value: string; tone?: string }[] }> = ({ stats }) => (
  <div style={{ display: "flex", border: `1px solid ${S.border}`, borderRadius: 10, overflow: "hidden" }}>
    {stats.map((s, i) => (
      <div
        key={s.label}
        style={{
          flex: 1,
          padding: "12px 16px",
          borderLeft: i ? `1px solid ${S.border}` : undefined,
        }}
      >
        <div style={{ fontSize: 12, color: S.mutedFg }}>{s.label}</div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            marginTop: 2,
            fontVariantNumeric: "tabular-nums",
            color: s.tone ?? S.fg,
          }}
        >
          {s.value}
        </div>
      </div>
    ))}
  </div>
);
