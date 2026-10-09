// The tour's words in Egyptian Arabic. The app screens stay as they are; every
// caption around them (chapter copy, chips, phone labels, intro, features grid)
// switches when the tour runs with lang="ar".
import { loadFont as loadAlexandria } from "@remotion/google-fonts/Alexandria";
import { loadFont } from "@remotion/google-fonts/IBMPlexSansArabic";
import { loadFont as loadKufi } from "@remotion/google-fonts/NotoKufiArabic";
import { createContext, useContext, type CSSProperties } from "react";
import { toArabic } from "./ar-ui";

export type Lang = "en" | "ar";
export const LangContext = createContext<Lang>("en");
export const useLang = () => useContext(LangContext);

// The customer app's Arabic font.
export const { fontFamily: plexArabic } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["arabic", "latin"],
});

// The other apps' Arabic fonts: the admin's Noto Kufi Arabic, the till's and kitchen's Alexandria.
export const { fontFamily: kufi } = loadKufi("normal", { weights: ["400", "500", "600", "700"], subsets: ["arabic"] });
export const { fontFamily: alexandria } = loadAlexandria("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["arabic", "latin"],
});

// In the Arabic tour the stage is mirrored: devices sit on the left, the copy on the right.
// A device inside the mirror flips back so its own screen reads the right way round.
export const MirrorContext = createContext(false);
export const useUnmirror = (): CSSProperties => (useContext(MirrorContext) ? { transform: "scaleX(-1)" } : {});

// The logical width of the screen we are drawing inside (0 outside any device), so taps can mirror.
export const DeviceContext = createContext(0);

// The apps' own Arabic strings (ar-ui.ts); English stays the key.
export const useT = () => {
  const ar = useLang() === "ar";
  return (s: string) => (ar ? toArabic(s) : s);
};

export type ChapterText = { eyebrow: string; title: string; mark: string; line: string; chips: string[] };


// The copy deck: every chapter's words, in the website's voice. Edit here.
export const EN_CHAPTERS: Record<string, ChapterText> = {
  "01": {
    eyebrow: "Your café, your look",
    title: "Your app, in your name and colours.",
    mark: "your name",
    line: "Each café gets its own app in its own name and colours, and everything behind it.",
    chips: [],
  },
  "03": {
    eyebrow: "For your customers",
    title: "Pay at the table.",
    mark: "Pay",
    line: "Customers see the bill in the app, and each one pays their share from their phone.",
    chips: [],
  },
  "04": {
    eyebrow: "For your customers",
    title: "Book a room from the phone.",
    mark: "Book a room",
    line: "Rooms booked from the phone, held for a few minutes, and timed by the minute when the clock runs.",
    chips: [],
  },
  "05": {
    eyebrow: "For your customers",
    title: "Points on every order.",
    mark: "Points",
    line: "Points on every order and rewards customers can spend, so the regulars keep coming back.",
    chips: [],
  },
  "06": {
    eyebrow: "For your business",
    title: "All your branches.",
    mark: "branches.",
    line: "Each branch has its own prices and hours, and customers find the nearest one.",
    chips: [],
  },
  "07": {
    eyebrow: "For you",
    title: "Your menu, from a photo.",
    mark: "photo.",
    line: "Take a photo of your printed menu and Ninja puts it in, with categories and prices.",
    chips: [],
  },
  "08": {
    eyebrow: "For you",
    title: "Stock and recipes.",
    mark: "Stock",
    line: "What each dish takes from the shelf, what is running low, and what came in from which supplier.",
    chips: [],
  },
  "09": {
    eyebrow: "For you",
    title: "Expenses, pay and profit.",
    mark: "profit.",
    line: "Shifts, attendance and pay, expenses and the day's takings, in the same place as the orders they came from.",
    chips: [],
  },
  "10": {
    eyebrow: "For you",
    title: "Ask about your café.",
    mark: "Ask",
    line: "Connect Claude or ChatGPT to Ninja and ask about sales, stock or staff, in Arabic or English.",
    chips: [],
  },
};

export const AR_CHAPTERS: Record<string, ChapterText> = {
  "01": {
    eyebrow: "الكافيه بتاعك بشكلك",
    title: "أبلكيشن باسمك وبألوانك.",
    mark: "باسمك",
    line: "كل كافيه ليه أبلكيشن باسمه وبألوانه، وكل اللي وراه.",
    chips: [],
  },
  "03": {
    eyebrow: "لعملائك",
    title: "الدفع من على الترابيزة.",
    mark: "الدفع",
    line: "العميل بيشوف الحساب في الأبلكيشن، وكل واحد بيدفع نصيبه من موبايله.",
    chips: [],
  },
  "04": {
    eyebrow: "لعملائك",
    title: "احجز اوضة من موبايلك.",
    mark: "احجز اوضة",
    line: "الأوض بتتحجز من الموبايل، وبتفضل محجوزة كام دقيقة، والوقت بيتحسب بالدقيقة أول ما يبدأ.",
    chips: [],
  },
  "05": {
    eyebrow: "لعملائك",
    title: "نقط على كل طلب.",
    mark: "نقط",
    line: "نقط على كل طلب ومكافآت العميل يقدر يصرفها، فالزباين الدايمين يفضلوا يرجعوا.",
    chips: [],
  },
  "06": {
    eyebrow: "لشغلك",
    title: "كل فروعك.",
    mark: "فروعك.",
    line: "كل فرع بأسعاره ومواعيده، والعميل بيلاقي أقرب فرع ليه.",
    chips: [],
  },
  "07": {
    eyebrow: "ليك إنت",
    title: "المنيو بتاعك من صورة.",
    mark: "صورة.",
    line: "صوّر المنيو المطبوع ونينجا بيدخّله بأقسامه وأسعاره.",
    chips: [],
  },
  "08": {
    eyebrow: "ليك إنت",
    title: "المخزون والوصفات.",
    mark: "المخزون",
    line: "كل صنف بياخد إيه من الرف، وإيه اللي قرّب يخلص، وإيه اللي وصل من أنهي مورد.",
    chips: [],
  },
  "09": {
    eyebrow: "ليك إنت",
    title: "المصروفات والمرتبات والأرباح.",
    mark: "والأرباح.",
    line: "الورديات والحضور والمرتبات والمصروفات وإيراد اليوم، في نفس المكان مع الطلبات اللي جت منها.",
    chips: [],
  },
  "10": {
    eyebrow: "ليك إنت",
    title: "اسأل عن الكافيه بتاعك.",
    mark: "اسأل",
    line: "اربط Claude أو ChatGPT بنينجا واسأل عن المبيعات أو المخزون أو الموظفين، بالعربي أو بالإنجليزي.",
    chips: [],
  },
};

export const AR = {
  introHeadline: "كل اللي الكافيه بتاعك محتاجه.",
  introFeatures: "الطلبات · الدفع · الحجوزات · الولاء · الدليفري · المخزن · المكسب",
  finaleHeadline: "مكان واحد للكافيه كله.",
  tagline: "خلّي نينجا في الكافيه بتاعك.",
  journeyHeadline: "طلب واحد، من الترابيزة لحد الباب.",
  labels: {
    "Café · Mellow": "كافيه · Mellow",
    "Burger kitchen · Smash Lab": "مطبخ برجر · Smash Lab",
    "Restaurant · Zaytoun": "مطعم · Zaytoun",
    "Game station · Level Up": "بلايستيشن · Level Up",
    "Rider app": "أبلكيشن الطيار",
    "The guest's phone": "موبايل العميل",
    "The customer's phone": "موبايل العميل",
    "Mobile app": "أبلكيشن الموبايل",
    "Web · nothing to install": "ويب · من غير تحميل",
    "Mobile app & web": "الأبلكيشن والويب",
  } as Record<string, string>,
  tiles: {
    "Table ordering": ["الطلب من الترابيزة", "سكان QR واطلب من غير حساب"],
    "Your brand": ["البراند بتاعك", "لوجو وألوان وشكل المنيو"],
    "Pay & split": ["الدفع والتقسيم", "من موبايل العميل"],
    Reservations: ["الحجوزات", "محجوزة لحد ما يوصل"],
    Loyalty: ["الولاء", "نقط ومستويات"],
    Till: ["الكاشير", "حسابات وورديات ومرتجعات"],
    Kitchen: ["المطبخ", "كل طلب في ساعتها"],
    "Own delivery": ["دليفري بطياريك", "من غير عمولة"],
    Branches: ["الفروع", "أسعار ومواعيد لكل فرع"],
    "Menu scan": ["سكان المنيو", "من الورق للأونلاين"],
    "Food cost": ["تكلفة الأكل", "مخزن ووصفات وهامش"],
    "Profit & payroll": ["المكسب والمرتبات", "من غير إكسيل"],
    "Ask your café": ["اسأل الكافيه بتاعك", "في Claude أو ChatGPT بالعربي أو الإنجليزي"],
  } as Record<string, [string, string]>,
};
