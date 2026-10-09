import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadSurfer } from "@remotion/google-fonts/OriginalSurfer";
import { Easing } from "remotion";

export const { fontFamily: inter } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

// Original Surfer is for the `ninja` wordmark and the N mark only, never headings.
export const { fontFamily: surfer } = loadSurfer("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

// Ninja's slate palette (client_web theme.css, POS/KDS colours).
export const C = {
  page: "#f4f5f7",
  ink: "#0f172a",
  muted: "#64748b",
  hair: "rgba(15, 23, 42, 0.08)",
  card: "#ffffff",
  night: "#020617",
  slate800: "#1e293b",
  slate700: "#334155",
  indigo: "#6366f1",
  amber: "#f59e0b",
  teal: "#14b8a6",
  green: "#22c55e",
  highlight: "rgba(250, 204, 21, 0.55)",
} as const;

export const lift =
  "0 1px 2px 0 rgba(0,0,0,0.04), 0 60px 120px -40px rgba(15,23,42,0.35)";

// One spring feel for things that land, one ease for things that glide.
export const land = Easing.spring({ damping: 14, stiffness: 160, mass: 0.8 });
export const glide = Easing.bezier(0.16, 1, 0.3, 1);

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
