// Each hero moment of the fast cut: its short title and where the camera goes, on the music's beats.
// Fast.tsx plays them in the film; web-clips.tsx plays them one at a time on the website.
import { beat, type Hero } from "./hero";

export const H: Record<string, Hero> = {
  brand: { title: "Your app, in your name and colours.", titleAr: "أبلكيشن باسمك وبألوانك.", cam: [{ f: 0, s: 1.08, x: 1556, y: 540 }] },
  pay: {
    title: "Pay at the table.",
    titleAr: "الدفع من على الترابيزة.",
    rate: 1.25,
    cam: [
      { f: beat(0, 1.25), s: 1, x: 1556, y: 540 },
      { f: beat(2, 1.25), s: 1.45, x: 1556, y: 600 },
      { f: beat(13, 1.25), s: 1.45, x: 1556, y: 600 },
      { f: beat(14, 1.25), s: 1.2, x: 1440, y: 560 },
    ],
  },
  book: {
    title: "Book a room from the phone.",
    titleAr: "احجز اوضة من موبايلك.",
    rate: 1.25,
    cam: [
      { f: beat(0, 1.25), s: 1, x: 1556, y: 540 },
      { f: beat(3, 1.25), s: 1.35, x: 1556, y: 400 },
      { f: beat(9, 1.25), s: 1.35, x: 1556, y: 400 },
      { f: beat(10, 1.25), s: 1.6, x: 1556, y: 420 },
      { f: beat(12, 1.25), s: 1.6, x: 1556, y: 420 },
      { f: beat(13, 1.25), s: 1.3, x: 1460, y: 400 },
    ],
  },
  branches: { rate: 2.2, title: "All your branches.", titleAr: "كل فروعك.", cam: [{ f: 0, s: 1.1, x: 1320, y: 480 }] },
  menu: {
    rate: 1.8,
    title: "Your menu, from a photo.",
    titleAr: "المنيو بتاعك من صورة.",
    cam: [
      { f: 0, s: 0.92, x: 1130, y: 520 },
      { f: 150, s: 0.92, x: 1130, y: 520 },
      { f: 176, s: 1.35, x: 1520, y: 740 },
      { f: 300, s: 1.35, x: 1520, y: 740 },
    ],
  },
  stock: { rate: 2.2, title: "Stock and recipes.", titleAr: "المخزون والوصفات.", cam: [{ f: 0, s: 0.95, x: 1150, y: 520 }] },
  profit: { rate: 2.2, title: "Expenses, pay and profit.", titleAr: "المصروفات والمرتبات والأرباح.", cam: [{ f: 0, s: 1.1, x: 1320, y: 470 }] },
  ask: {
    title: "Ask about your café.",
    titleAr: "اسأل عن الكافيه بتاعك.",
    rate: 1.25,
    cam: [
      { f: beat(0, 1.25), s: 1, x: 1320, y: 540 },
      { f: beat(4, 1.25), s: 1.22, x: 1240, y: 460 },
      { f: beat(10, 1.25), s: 1.22, x: 1240, y: 460 },
      { f: beat(11, 1.25), s: 1.22, x: 1320, y: 650 },
    ],
  },
};

