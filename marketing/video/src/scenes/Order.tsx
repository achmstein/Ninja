import type React from "react";
import {
  AbsoluteFill,
  Interactive,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  type InteractivitySchema,
} from "remotion";
import { Backdrop, Headline, Phone, Step, Tap, useRise } from "../parts";
import { C, clamp, glide, land } from "../theme";

// The app's own menu photos (public/dishes, from src/Catalog.API/Pics).
const DISHES = [
  { name: "Latte", price: 75, img: "latte" },
  { name: "Iced Mocha", price: 95, img: "mocha" },
  { name: "Waffle", price: 110, img: "waffle" },
  { name: "Chocolate Cake", price: 120, img: "cake" },
];
const TILE_W = 238;
const tileX = (i: number) => 36 + (i % 2) * (TILE_W + 20);
const tileY = (i: number) => 330 + Math.floor(i / 2) * 320;

// A fixed, made-up QR pattern (21 × 21 with the three finder squares).
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
  if (f !== null) return f;
  return ((x * 7 + y * 13 + x * y * 3) % 5) < 2;
});

type Props = {
  readonly headline: string;
  readonly style?: React.CSSProperties;
};

const OrderInner: React.FC<Props> = ({ headline, style }) => {
  const frame = useCurrentFrame();
  const phone = useRise(4, 400);
  const scanned = 42;
  const tapLatte = 66;
  const tapClub = 86;
  const tapSend = 112;
  const count = frame >= tapClub + 2 ? 2 : frame >= tapLatte + 2 ? 1 : 0;
  const total = count === 2 ? 185 : count === 1 ? 75 : 0;

  return (
    <AbsoluteFill style={style}>
      <Backdrop />
      <Step n="01" label="At the table" />
      <Headline text={headline} mark="table" at={2} />

      <Phone style={{ ...phone }}>
        {/* Menu */}
        <AbsoluteFill style={{ padding: "100px 36px 0", backgroundColor: "#fff" }}>
          <div style={{ fontSize: 26, fontWeight: 600, color: C.muted }}>Table 3 · Café Layla</div>
          <div style={{ fontSize: 52, fontWeight: 800, color: C.ink, letterSpacing: "-0.03em", marginTop: 6 }}>
            Menu
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 26 }}>
            {["Coffee", "Iced", "Food", "Desserts"].map((c, i) => (
              <div
                key={c}
                style={{
                  padding: "14px 24px",
                  borderRadius: 999,
                  fontSize: 24,
                  fontWeight: 700,
                  backgroundColor: i === 0 ? C.ink : "#f1f5f9",
                  color: i === 0 ? "#fff" : C.slate700,
                }}
              >
                {c}
              </div>
            ))}
          </div>
        </AbsoluteFill>
        {DISHES.map((d, i) => {
          const added = (i === 0 && frame >= tapLatte + 2) || (i === 2 && frame >= tapClub + 2);
          const tappedAt = i === 0 ? tapLatte : tapClub;
          return (
            <div
              key={d.name}
              style={{
                position: "absolute",
                left: tileX(i),
                top: tileY(i),
                width: TILE_W,
                height: 300,
                opacity: interpolate(frame, [scanned + i * 3, scanned + i * 3 + 8], [0, 1], clamp),
                translate: interpolate(frame, [scanned + i * 3, scanned + i * 3 + 16], ["0px 40px", "0px 0px"], {
                  ...clamp,
                  easing: glide,
                }),
              }}
            >
              <Img
                src={staticFile(`dishes/${d.img}.jpg`)}
                style={{ width: "100%", height: 190, borderRadius: 28, objectFit: "cover", display: "block" }}
              />
              <div style={{ fontSize: 26, fontWeight: 700, color: C.ink, marginTop: 14 }}>{d.name}</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: C.muted, marginTop: 4 }}>EGP {d.price}</div>
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: added ? 30 : 40,
                  fontWeight: 800,
                  backgroundColor: added ? C.ink : "#f1f5f9",
                  color: added ? "#fff" : C.ink,
                  scale: interpolate(frame, [tappedAt, tappedAt + 3, tappedAt + 12], [1, 0.8, 1], {
                    ...clamp,
                    easing: land,
                  }),
                }}
              >
                {added ? "1" : "+"}
              </div>
            </div>
          );
        })}

        {/* Cart pill */}
        <div
          style={{
            position: "absolute",
            left: 36,
            right: 36,
            bottom: 40,
            height: 110,
            borderRadius: 999,
            backgroundColor: C.ink,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 40px",
            fontSize: 28,
            whiteSpace: "nowrap",
            fontWeight: 700,
            translate: interpolate(frame, [tapLatte + 2, tapLatte + 16], ["0px 200px", "0px 0px"], {
              ...clamp,
              easing: land,
            }),
            scale: interpolate(frame, [tapSend, tapSend + 3, tapSend + 10], [1, 0.95, 1], clamp),
          }}
        >
          <span>
            {count} {count === 1 ? "item" : "items"} · EGP {total}
          </span>
          <span>Send →</span>
        </div>

        {/* Sent */}
        <AbsoluteFill
          style={{
            backgroundColor: "#fff",
            justifyContent: "center",
            alignItems: "center",
            gap: 30,
            opacity: interpolate(frame, [tapSend + 6, tapSend + 12], [0, 1], clamp),
          }}
        >
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: "50%",
              backgroundColor: C.green,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 100,
              fontWeight: 800,
              scale: interpolate(frame, [tapSend + 8, tapSend + 24], [0, 1], { ...clamp, easing: land }),
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, color: C.ink, letterSpacing: "-0.02em" }}>Order sent</div>
          <div style={{ fontSize: 28, fontWeight: 500, color: C.muted }}>No app, no account, no waiting.</div>
        </AbsoluteFill>

        {/* Camera scanning the table's QR */}
        <AbsoluteFill
          style={{
            backgroundColor: "#111318",
            justifyContent: "center",
            alignItems: "center",
            opacity: interpolate(frame, [scanned - 4, scanned + 2], [1, 0], clamp),
          }}
        >
          <div
            style={{
              position: "relative",
              width: 340,
              height: 340,
              padding: 26,
              borderRadius: 30,
              backgroundColor: "#fff",
              display: "grid",
              gridTemplateColumns: "repeat(21, 1fr)",
              scale: interpolate(frame, [8, 40], [0.86, 1.04], clamp),
            }}
          >
            {QR.map((on, k) => (
              <div key={k} style={{ backgroundColor: on ? C.ink : "transparent" }} />
            ))}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: 6,
                borderRadius: 3,
                backgroundColor: C.teal,
                boxShadow: `0 0 30px ${C.teal}`,
                top: interpolate(frame, [10, 26, 40], [20, 314, 20], clamp),
              }}
            />
          </div>
          <div style={{ color: "#fff", fontSize: 28, fontWeight: 600, marginTop: 40 }}>Scan the table</div>
        </AbsoluteFill>
        <AbsoluteFill
          style={{
            backgroundColor: "#fff",
            opacity: interpolate(frame, [scanned - 2, scanned, scanned + 8], [0, 0.9, 0], clamp),
          }}
        />

        <Tap x={tileX(0) + TILE_W - 32} y={tileY(0) + 268} at={tapLatte} />
        <Tap x={tileX(2) + TILE_W - 32} y={tileY(2) + 268} at={tapClub} />
        <Tap x={360} y={1113} at={tapSend} />
      </Phone>
    </AbsoluteFill>
  );
};

const schema = {
  headline: { type: "text-content", default: "Guests order from the table.", description: "Headline" },
} as const satisfies InteractivitySchema;

export const Order = Interactive.withSchema({
  Component: OrderInner,
  componentName: "<Order>",
  schema,
  wrapInSequence: true,
});
