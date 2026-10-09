// The tour's words in Egyptian Arabic. The app screens stay as they are; every
// caption around them (chapter copy, chips, phone labels, intro, features grid)
// switches when the tour runs with lang="ar".
import { loadFont } from "@remotion/google-fonts/IBMPlexSansArabic";
import { createContext, useContext } from "react";

export type Lang = "en" | "ar";
export const LangContext = createContext<Lang>("en");
export const useLang = () => useContext(LangContext);

// The customer app's Arabic font.
export const { fontFamily: plexArabic } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["arabic", "latin"],
});

export type ChapterText = { eyebrow: string; title: string; mark: string; line: string; chips: string[] };

const GUESTS = "لعملائك";
const TEAM = "لفريقك";
const YOU = "ليك إنت";

export const AR_CHAPTERS: Record<string, ChapterText> = {
  "01": {
    eyebrow: "كافيهك بشكلك",
    title: "شكله شكل الكافيه بتاعك.",
    mark: "الكافيه بتاعك.",
    line: "حط اللوجو والألوان وشكل المنيو، والأبلكيشن بيتغيّر قدامك.",
    chips: ["اللوجو بتاعك", "ألوانك", "٦ أشكال للمنيو", "عربي وإنجليزي"],
  },
  "02": {
    eyebrow: GUESTS,
    title: "العميل يطلب من على الترابيزة.",
    mark: "الترابيزة.",
    line: "يعمل سكان للـ QR اللي على الترابيزة ويطلب في ثواني، والطلب يوصل للكاشير والمطبخ على طول.",
    chips: ["من غير تحميل", "من غير حساب", "ملاحظات واختيارات", "عربي وإنجليزي"],
  },
  "03": {
    eyebrow: GUESTS,
    title: "يدفع من على الترابيزة ويقسم براحته.",
    mark: "ويقسم",
    line: "الحساب جوه الأبلكيشن، وكل واحد من الصحاب يدفع نصيبه من موبايله.",
    chips: ["يدفع الكل", "يقسم بالتساوي", "يدفع اللي طلبه", "مبلغ يحدده"],
  },
  "04": {
    eyebrow: GUESTS,
    title: "يحجز ترابيزته قبل ما يوصل.",
    mark: "يحجز",
    line: "العميل يحجز من موبايله ويشوف العدّاد وهو جاي في الطريق.",
    chips: ["ترابيزات", "أوض", "محجوزة لحد ما يوصل", "عدّاد لايف"],
  },
  "05": {
    eyebrow: GUESTS,
    title: "كل زيارة بنقط.",
    mark: "بنقط.",
    line: "العميل يشوف نقطه ومستواه بيكبروا، ويرجعلك عشان المكافآت اللي إنت بتحددها.",
    chips: ["نقط", "مستويات", "مكافآت على مزاجك"],
  },
  "06": {
    eyebrow: TEAM,
    title: "كاشير الموظف يتعلمه في دقيقة.",
    mark: "دقيقة.",
    line: "دوس وبيع، قسّم الحساب على كل واحد، واقفل الوردية والدرج متعدّ.",
    chips: ["حساب كل واحد", "ورديات", "مرتجعات", "طلبات دليفري"],
  },
  "07": {
    eyebrow: TEAM,
    title: "المطبخ يشوف الطلب في ساعتها.",
    mark: "ساعتها.",
    line: "التذاكر بتغيّر لونها كل ما تستنى، فمفيش طلب يتنسي في الزحمة.",
    chips: ["لون حسب الانتظار", "الملاحظات واضحة", "جاهز بلمسة"],
  },
  "08": {
    eyebrow: TEAM,
    title: "وصّل بالطيارين بتوعك.",
    mark: "الطيارين بتوعك.",
    line: "من غير عمولة. الطيار ليه أبلكيشن، والعميل يتابع طلبه لحد الباب.",
    chips: ["أبلكيشن للطيار", "الكاش اللي هيحصّله", "متابعة لايف للعميل"],
  },
  "09": {
    eyebrow: "لشغلك",
    title: "كل الفروع من لوحة واحدة.",
    mark: "الفروع",
    line: "كل فرع بأسعاره ومواعيده، والعميل يروح لأقرب فرع ليه.",
    chips: ["أسعار لكل فرع", "مواعيد لكل فرع", "أقرب فرع"],
  },
  "10": {
    eyebrow: YOU,
    title: "صوّر المنيو، يبقى أونلاين في دقايق.",
    mark: "دقايق.",
    line: "نينجا بيقرا المنيو المطبوع بأقسامه وأسعاره، وستوديو الصور بيخلّي كل صنف شكله يفتح النفس.",
    chips: ["سكان للمنيو", "أقسام وأسعار", "ستوديو الصور"],
  },
  "11": {
    eyebrow: YOU,
    title: "اعرف كل صنف بيكلفك كام بالظبط.",
    mark: "بالظبط.",
    line: "صوّر فاتورة المورد والمخزن يتحدّث لوحده، والوصفات تحسبلك تكلفة وهامش كل صنف.",
    chips: ["سكان للفاتورة", "وصفات", "هامش لكل صنف", "تنبيه قبل ما المخزن يخلص"],
  },
  "12": {
    eyebrow: YOU,
    title: "مكسبك من غير إكسيل.",
    mark: "إكسيل.",
    line: "المبيعات والمرتجعات والمخزن والمرتبات والمصاريف بتتجمع لوحدها كل شهر.",
    chips: ["المكسب والخسارة", "المصاريف", "المرتبات", "نصيب الشركا"],
  },
  "13": {
    eyebrow: YOU,
    title: "اسأل الكافيه بتاعك أي حاجة.",
    mark: "أي حاجة.",
    line: "اربط Claude أو ChatGPT بنينجا، واسأل عن المبيعات والمكسب والمخزن والموظفين، أو خليه يعمل التعديل.",
    chips: ["Claude", "ChatGPT", "عربي وإنجليزي", "بيستأذنك قبل ما يغيّر"],
  },
};

export const AR = {
  introHeadline: "كافيهك كله في مكان واحد.",
  introFeatures: "الطلبات · الدفع · الحجوزات · الولاء · الدليفري · المخزن · المكسب",
  finaleHeadline: "كل اللي الكافيه بتاعك محتاجه.",
  tagline: "أبلكيشن واحد للكافيه كله.",
  labels: {
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
