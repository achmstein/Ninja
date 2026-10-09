import {
  Armchair,
  Award,
  Bike,
  Building2,
  ChefHat,
  CreditCard,
  Palette,
  ReceiptText,
  TrendingUp,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type React from "react";
import {
  AbsoluteFill,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  type InteractivitySchema,
} from "remotion";
import { NMark, Wordmark } from "../parts";
import { C, clamp, glide, inter, land } from "../theme";
import { Stage } from "./Frame";
import { AR, plexArabic, useLang } from "./lang";

// The recap as a bento grid: 5 columns × 3 rows, two wide tiles, two photo tiles.
type Tile = {
  name: string;
  sub: string;
  col: number;
  row: number;
  span?: number;
  Icon?: LucideIcon;
  tone?: string;
  photo?: string;
  slab?: boolean;
};
const TILES: Tile[] = [
  { name: "Table ordering", sub: "Scan the QR, order, no account", col: 0, row: 0, span: 2, photo: "dishes/latte.jpg" },
  { name: "Your brand", sub: "Logo, colours, menu layout", col: 2, row: 0, Icon: Palette, tone: "#ec4899" },
  { name: "Pay & split", sub: "From the guest's phone", col: 3, row: 0, Icon: CreditCard, tone: C.indigo },
  { name: "Reservations", sub: "Held while they come", col: 4, row: 0, Icon: Armchair, tone: C.amber },
  { name: "Loyalty", sub: "Points and tiers", col: 0, row: 1, Icon: Award, tone: "#eab308" },
  { name: "Till", sub: "Rounds, shifts, refunds", col: 1, row: 1, Icon: ReceiptText, tone: C.ink },
  { name: "Kitchen", sub: "Every order, instantly", col: 2, row: 1, Icon: ChefHat, tone: C.teal },
  { name: "Own delivery", sub: "Your riders, no commission", col: 3, row: 1, Icon: Bike, tone: "#0284c7" },
  { name: "Branches", sub: "Prices and hours each", col: 4, row: 1, Icon: Building2, tone: "#8b5cf6" },
  { name: "Menu scan", sub: "Printed menu to online", col: 0, row: 2, photo: "dishes/waffle.jpg" },
  { name: "Food cost", sub: "Stock, recipes, margin per dish", col: 1, row: 2, Icon: Warehouse, tone: "#16a34a" },
  { name: "Profit & payroll", sub: "Without a spreadsheet", col: 2, row: 2, Icon: TrendingUp, tone: "#dc2626" },
  { name: "Ask your café", sub: "In Claude or ChatGPT, Arabic or English", col: 3, row: 2, span: 2, slab: true },
];

const W = 300;
const H = 196;
const GAP = 18;
const LEFT = (1920 - (5 * W + 4 * GAP)) / 2;
const TOP = 318;

type Props = {
  readonly headline: string;
  readonly tagline: string;
  readonly url: string;
  readonly style?: React.CSSProperties;
};

const FinaleInner: React.FC<Props> = ({ headline: h, tagline: tl, url, style }) => {
  const frame = useCurrentFrame();
  const ar = useLang() === "ar";
  const headline = ar ? AR.finaleHeadline : h;
  const tagline = ar ? AR.tagline : tl;
  const font = ar ? plexArabic : inter;
  const fold = 118;
  const words = headline.split(" ");

  return (
    <AbsoluteFill style={style}>
      <Stage look="light">
        <div
          style={{
            position: "absolute",
            top: 130,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            columnGap: "0.25em",
            fontFamily: font,
            direction: ar ? "rtl" : "ltr",
            fontSize: ar ? 84 : 96,
            fontWeight: ar ? 700 : 800,
            letterSpacing: ar ? 0 : "-0.045em",
            color: C.ink,
            opacity: interpolate(frame, [fold, fold + 10], [1, 0], clamp),
          }}
        >
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: interpolate(frame, [2 + i * 3, 8 + i * 3], [0, 1], clamp),
                translate: interpolate(frame, [2 + i * 3, 16 + i * 3], ["0px 50px", "0px 0px"], { ...clamp, easing: glide }),
              }}
            >
              {w}
            </span>
          ))}
        </div>

        {TILES.map((t, i) => {
          const at = 10 + (t.col + t.row) * 4;
          const x0 = LEFT + t.col * (W + GAP);
          const y = TOP + t.row * (H + GAP);
          const w = (t.span ?? 1) * W + ((t.span ?? 1) - 1) * GAP;
          const x = ar ? 1920 - x0 - w : x0;
          // On the fold every tile glides to the centre and shrinks into the mark.
          const f = interpolate(frame, [fold + i * 0.6, fold + 16 + i * 0.6], [0, 1], { ...clamp, easing: glide });
          const dx = (960 - (x + w / 2)) * f;
          const dy = (470 - (y + H / 2)) * f;
          const dark = t.slab || t.photo;
          return (
            <div
              key={t.name}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: w,
                height: H,
                borderRadius: 30,
                overflow: "hidden",
                padding: 26,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                fontFamily: font,
                direction: ar ? "rtl" : "ltr",
                backgroundColor: t.slab ? "#020617" : "#fff",
                color: dark ? "#fff" : C.ink,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 24px 60px -28px rgba(15,23,42,0.35)",
                opacity: interpolate(frame, [at, at + 6], [0, 1], clamp) * interpolate(f, [0.6, 1], [1, 0], clamp),
                translate: `${dx}px ${dy + interpolate(frame, [at, at + 16], [40, 0], { ...clamp, easing: land })}px`,
                scale: `${interpolate(frame, [at, at + 16], [0.86, 1], { ...clamp, easing: land }) * interpolate(f, [0, 1], [1, 0.2])}`,
              }}
            >
              {t.photo ? (
                <>
                  <Img
                    src={staticFile(t.photo)}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      scale: `${interpolate(frame, [at, at + 120], [1.12, 1], clamp)}`,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.05) 60%)",
                    }}
                  />
                </>
              ) : null}
              {t.Icon ? (
                <div
                  style={{
                    position: "absolute",
                    top: 24,
                    [ar ? "right" : "left"]: 26,
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    backgroundColor: t.tone,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <t.Icon size={28} color="#fff" />
                </div>
              ) : null}
              {t.slab ? (
                <div style={{ position: "absolute", top: 24, [ar ? "right" : "left"]: 26 }}>
                  <NMark size={56} />
                </div>
              ) : null}
              <div style={{ position: "relative", fontSize: ar ? 28 : 30, fontWeight: ar ? 700 : 800, letterSpacing: ar ? 0 : "-0.02em" }}>
                {ar ? (AR.tiles[t.name]?.[0] ?? t.name) : t.name}
              </div>
              <div
                style={{
                  position: "relative",
                  marginTop: 4,
                  fontSize: 19,
                  fontWeight: 500,
                  color: dark ? "rgba(255,255,255,0.75)" : C.muted,
                }}
              >
                {ar ? (AR.tiles[t.name]?.[1] ?? t.sub) : t.sub}
              </div>
            </div>
          );
        })}

        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: inter }}>
          <div
            style={{
              marginTop: -50,
              scale: `${interpolate(frame, [fold + 12, fold + 34], [0, 1], { ...clamp, easing: land })}`,
            }}
          >
            <NMark size={190} style={{ filter: "drop-shadow(0 40px 70px rgba(15,23,42,0.35))" }} />
          </div>
          <Wordmark
            size={130}
            color={C.ink}
            style={{
              marginTop: 18,
              opacity: interpolate(frame, [fold + 22, fold + 30], [0, 1], clamp),
              translate: interpolate(frame, [fold + 22, fold + 38], ["0px 30px", "0px 0px"], { ...clamp, easing: glide }),
            }}
          />
          <div
            style={{
              marginTop: 26,
              fontFamily: font,
              fontSize: 48,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: C.muted,
              opacity: interpolate(frame, [fold + 30, fold + 38], [0, 1], clamp),
            }}
          >
            {tagline}
          </div>
          <div
            style={{
              marginTop: 44,
              height: 96,
              padding: "0 54px",
              borderRadius: 999,
              backgroundColor: C.ink,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 42,
              fontWeight: 800,
              opacity: interpolate(frame, [fold + 38, fold + 44], [0, 1], clamp),
              scale: `${interpolate(frame, [fold + 38, fold + 54], [0.7, 1], { ...clamp, easing: land })}`,
            }}
          >
            {url}
          </div>
        </AbsoluteFill>
      </Stage>
    </AbsoluteFill>
  );
};

const schema = {
  headline: { type: "text-content", default: "Everything your café runs on.", description: "Headline over the grid" },
  tagline: { type: "text-content", default: "One app for your whole café.", description: "Tagline under the logo" },
  url: { type: "text-content", default: "ninjapp.net", description: "Website" },
} as const satisfies InteractivitySchema;

export const Finale = Interactive.withSchema({
  Component: FinaleInner,
  componentName: "<Finale>",
  schema,
  wrapInSequence: true,
});
