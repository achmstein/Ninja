// The ad's hook: two bars of a busy night before Ninja appears. The things an owner
// hears pop up one per beat, scattered, then blur back for one question.
import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { clamp, inter, land } from "../theme";
import { plexArabic, useLang } from "./lang";
import { Sfx } from "./sfx";

export type Bubble = { en: string; ar: string; who: string; whoAr: string; x: number; y: number; r: number; tone: string };
const BUBBLES: Bubble[] = [
  { who: "Table 4", whoAr: "ترابيزة 4", en: "Still waiting for our order…", ar: "لسه مستنيين الطلب…", x: 180, y: 170, r: -3, tone: "#ef4444" },
  { who: "Table 7", whoAr: "ترابيزة 7", en: "Can we get the bill?", ar: "ممكن الحساب؟", x: 1120, y: 120, r: 4, tone: "#f59e0b" },
  { who: "Waiter", whoAr: "الويتر", en: "Two lattes. No, three.", ar: "اتنين لاتيه، لأ… تلاتة.", x: 980, y: 560, r: -4, tone: "#64748b" },
  { who: "Kitchen", whoAr: "المطبخ", en: "Which table was the waffle?", ar: "الوافل كان لأنهي ترابيزة؟", x: 120, y: 620, r: 3, tone: "#0d9488" },
  { who: "Kitchen", whoAr: "المطبخ", en: "Is that order paid?", ar: "الطلب ده اتدفع؟", x: 640, y: 360, r: -2, tone: "#0d9488" },
];

export const Hook: React.FC<{ question: string; questionAr: string; bubbles?: Bubble[]; neon?: boolean }> = ({
  question,
  questionAr,
  bubbles = BUBBLES,
  neon,
}) => {
  const frame = useCurrentFrame();
  const ar = useLang() === "ar";
  const font = ar ? plexArabic : inter;
  const ask = 67;
  const blur = interpolate(frame, [ask - 4, ask + 6], [0, 10], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: neon ? "#04060d" : "#0b0d12" }}>
      <AbsoluteFill
        style={{
          background: neon
            ? "radial-gradient(ellipse 70% 60% at 75% 20%, rgba(37,99,235,0.3), transparent 70%), radial-gradient(ellipse 60% 50% at 15% 85%, rgba(14,165,233,0.12), transparent 70%)"
            : "radial-gradient(ellipse 70% 60% at 50% 50%, #1a1d26 0%, #0b0d12 70%)",
        }}
      />
      <AbsoluteFill
        style={{
          filter: `blur(${blur}px)`,
          opacity: interpolate(frame, [ask - 4, ask + 6], [1, 0.35], clamp),
          scale: `${interpolate(frame, [0, ask + 30], [1.04, 1])}`,
        }}
      >
        {bubbles.map((b, i) => {
          const at = 7 + i * 12;
          const k = interpolate(frame, [at, at + 10], [0, 1], { ...clamp, easing: land });
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: ar ? 1920 - b.x - 620 : b.x,
                top: b.y,
                maxWidth: 620,
                padding: "22px 28px",
                borderRadius: 28,
                backgroundColor: "#fff",
                fontFamily: font,
                direction: ar ? "rtl" : "ltr",
                boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6)",
                opacity: Math.min(1, k * 2),
                scale: `${0.7 + 0.3 * k}`,
                rotate: `${b.r * (ar ? -1 : 1)}deg`,
              }}
            >
              <Sfx name="pop" at={at} volume={2.4} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 700, color: b.tone }}>
                <span style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: b.tone }} />
                {ar ? b.whoAr : b.who}
              </div>
              <div style={{ fontSize: 40, fontWeight: 700, color: "#0f172a", marginTop: 6, letterSpacing: ar ? 0 : "-0.02em" }}>
                {ar ? b.ar : b.en}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ overflow: "hidden", padding: "0 80px 12px" }}>
          <div
            style={{
              fontFamily: font,
              direction: ar ? "rtl" : "ltr",
              fontSize: ar ? 104 : 112,
              fontWeight: ar ? 700 : 800,
              letterSpacing: ar ? 0 : "-0.045em",
              color: "#fff",
              textAlign: "center",
              lineHeight: 1.1,
              translate: `0px ${interpolate(frame, [ask, ask + 16], [110, 0], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) })}%`,
            }}
          >
            {ar ? questionAr : question}
          </div>
        </div>
      </AbsoluteFill>
      <Sfx name="impact" at={ask} volume={0.6} />
    </AbsoluteFill>
  );
};
