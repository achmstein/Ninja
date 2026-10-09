import { LayoutGrid } from "lucide-react";
import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { clamp, glide } from "../theme";
import { AddButton, Dish, DISHES, S, TopBar } from "./ui";
import { useT } from "./lang";

export type Dishkey = keyof typeof DISHES;
const ROWS: Dishkey[] = ["latte", "mocha", "cappuccino", "waffle", "cake"];
const GRID: Dishkey[] = ["latte", "mocha", "waffle", "cake"];

// The guest menu in the Ninja style: "row" (default) or "grid" (photo tiles), chips above the dock.
export const MenuScreen: React.FC<{
  layout?: "row" | "grid";
  primary?: string;
  brand?: string;
  brandColor?: string;
  counts?: Partial<Record<Dishkey, number>>;
  enterAt?: number;
  offer?: Dishkey;
}> = ({ layout = "row", primary = S.primary, brand, brandColor, counts = {}, enterAt = -100, offer }) => {
  const frame = useCurrentFrame();
  const tr = useT();
  const rise = (i: number) => ({
    opacity: interpolate(frame, [enterAt + i * 3, enterAt + i * 3 + 8], [0, 1], clamp),
    translate: interpolate(frame, [enterAt + i * 3, enterAt + i * 3 + 16], ["0px 30px", "0px 0px"], {
      ...clamp,
      easing: glide,
    }),
  });
  return (
    <>
      <TopBar brand={brand} color={brandColor} />
      <div style={{ position: "absolute", top: 116, left: 16, right: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 12, ...rise(0) }}>
          {tr("Coffee")}
        </div>
        {layout === "row" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {ROWS.map((k, i) => {
              const d = DISHES[k];
              const isOffer = k === offer;
              return (
                <div key={k} style={{ display: "flex", gap: 14, alignItems: "center", ...rise(i + 1) }}>
                  <Dish img={d.img} size={80} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{tr(d.name)}</div>
                    <div style={{ fontSize: 14, color: S.mutedFg, marginTop: 2 }}>{tr(d.note)}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, display: "flex", gap: 6 }}>
                      {isOffer ? (
                        <>
                          <span style={{ color: primary }}>{tr(`EGP ${Math.round(d.price * 0.8)}`)}</span>
                          <span style={{ color: S.mutedFg, textDecoration: "line-through", fontWeight: 500 }}>
                            {d.price}
                          </span>
                        </>
                      ) : (
                        <span>{tr(`EGP ${d.price}`)}</span>
                      )}
                    </div>
                  </div>
                  <AddButton count={counts[k] ?? 0} primary={primary} />
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12, rowGap: 20 }}>
            {GRID.map((k, i) => {
              const d = DISHES[k];
              return (
                <div key={k} style={{ ...rise(i + 1) }}>
                  <div style={{ position: "relative" }}>
                    <Dish img={d.img} size="100%" ratio="4 / 5" radius={24} />
                    <AddButton
                      count={counts[k] ?? 0}
                      primary={primary}
                      style={{ position: "absolute", insetInlineEnd: 8, bottom: 8 }}
                    />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>{tr(d.name)}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.mutedFg }}>{tr(`EGP ${d.price}`)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Category chips, just above the dock */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 80,
          height: 52,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 12px",
          backgroundColor: "rgba(255,255,255,0.92)",
        }}
      >
        {["Coffee", "Iced", "Food", "Desserts"].map((c, i) => (
          <div
            key={c}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              fontSize: 14,
              fontWeight: 600,
              backgroundColor: i === 0 ? primary : "transparent",
              color: i === 0 ? "#fff" : S.mutedFg,
            }}
          >
            {tr(c)}
          </div>
        ))}
        <div
          style={{
            marginLeft: "auto",
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: S.muted,
            display: "grid",
            placeItems: "center",
          }}
        >
          <LayoutGrid size={16} />
        </div>
      </div>
    </>
  );
};
