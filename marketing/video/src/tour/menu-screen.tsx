import { LayoutGrid } from "lucide-react";
import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { clamp, glide } from "../theme";
import { CHILLAX, type Business, type Item } from "./businesses";
import { AddButton, Dish, DISHES, S, TopBar } from "./ui";
import { useT } from "./lang";

export type Dishkey = keyof typeof DISHES;


// The menu layouts the brand page offers (menu-style.ts): Classic list (row), Photo grid,
// Compact (no photos), Magazine (hero, big photos), Cards to swipe (deck) and Card grid (tiles).
export type MenuLayout = "row" | "grid" | "compact" | "hero" | "deck" | "tiles";
export const LAYOUT_NAMES: Record<MenuLayout, string> = {
  row: "Classic list",
  grid: "Photo grid",
  compact: "Compact, no photos",
  hero: "Magazine, big photos",
  deck: "Cards to swipe",
  tiles: "Card grid",
};

// The guest menu in the Ninja style, in any of its layouts, chips above the dock.
export const MenuScreen: React.FC<{
  layout?: MenuLayout;
  primary?: string;
  brand?: string;
  brandColor?: string;
  counts?: Partial<Record<Dishkey, number>>;
  enterAt?: number;
  offer?: Dishkey;
  biz?: Business;
}> = ({ layout = "row", primary = S.primary, brand, brandColor, counts = {}, enterAt = -100, offer, biz = CHILLAX }) => {
  const it = biz.items;
  const ROWS = it.slice(0, 5);
  const GRID = [it[0], it[1], it[3], it[4]];
  const count = (d: Item) => (counts as Record<string, number>)[d.key] ?? 0;
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
      <TopBar brand={brand} color={brandColor} logo={biz.logo} />
      <div style={{ position: "absolute", top: 116, left: 16, right: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 12, ...rise(0) }}>
          {tr(biz.categories[0])}
        </div>
        {layout === "row" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {ROWS.map((d, i) => {
              const k = d.key;
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
                  <AddButton count={count(d)} primary={primary} />
                </div>
              );
            })}
          </div>
        ) : layout === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12, rowGap: 20 }}>
            {GRID.map((d, i) => {
              const k = d.key;
              return (
                <div key={k} style={{ ...rise(i + 1) }}>
                  <div style={{ position: "relative" }}>
                    <Dish img={d.img} size="100%" ratio="4 / 5" radius={24} />
                    <AddButton
                      count={count(d)}
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
        ) : layout === "compact" ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[...it, it[2]].map((d, i) => {
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 0",
                    borderTop: i ? `1px solid ${S.border}` : undefined,
                    ...rise(i + 1),
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{tr(d.name)}</div>
                    <div style={{ fontSize: 13, color: S.mutedFg, marginTop: 2 }}>{tr(d.note)}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{tr(`EGP ${d.price}`)}</div>
                  <AddButton primary={primary} style={{ width: 36, height: 36 }} />
                </div>
              );
            })}
          </div>
        ) : layout === "hero" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[it[1], it[3]].map((d, i) => {
              return (
                <div key={d.key} style={{ position: "relative", borderRadius: 28, overflow: "hidden", ...rise(i + 1) }}>
                  <Dish img={d.img} size="100%" ratio="16 / 11" radius={0} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent 55%)" }} />
                  <div style={{ position: "absolute", insetInlineStart: 18, bottom: 16, color: "#fff" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{tr(d.name)}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, opacity: 0.9 }}>{tr(`EGP ${d.price}`)}</div>
                  </div>
                  <AddButton primary="#fff" style={{ position: "absolute", insetInlineEnd: 14, bottom: 14, color: S.fg }} />
                </div>
              );
            })}
          </div>
        ) : layout === "deck" ? (
          <div style={{ position: "relative", height: 560 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 28,
                overflow: "hidden",
                scale: "0.92",
                translate: "0px -22px",
                opacity: 0.5,
              }}
            >
              <Dish img={it[4].img} size="100%" ratio="auto" radius={0} style={{ height: "100%" }} />
            </div>
            <div style={{ position: "absolute", inset: 0, borderRadius: 28, overflow: "hidden", ...rise(1) }}>
              <Dish img={it[0].img} size="100%" ratio="auto" radius={0} style={{ height: "100%" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent 50%)" }} />
              <div style={{ position: "absolute", insetInlineStart: 24, insetInlineEnd: 24, bottom: 24, color: "#fff" }}>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em" }}>{tr(it[0].name)}</div>
                <div style={{ fontSize: 15, opacity: 0.85, marginTop: 4 }}>{tr(it[0].note)}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{tr(`EGP ${it[0].price}`)}</span>
                  <AddButton primary="#fff" style={{ color: S.fg }} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {it.map((d, i) => {
              return (
                <div
                  key={d.key}
                  style={{ padding: 8, borderRadius: 24, backgroundColor: "#fff", boxShadow: S.surface, ...rise(i + 1) }}
                >
                  <Dish img={d.img} size="100%" ratio="1 / 1" radius={18} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 4px 2px" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{tr(d.name)}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: S.mutedFg }}>{tr(`EGP ${d.price}`)}</div>
                    </div>
                    <AddButton primary={primary} style={{ width: 32, height: 32 }} />
                  </div>
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
        {biz.categories.map((c, i) => (
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
