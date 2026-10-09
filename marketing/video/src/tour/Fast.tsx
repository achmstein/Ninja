import { Audio } from "@remotion/media";
import { springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type React from "react";
import { interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Book } from "./book";
import { Finale } from "./Finale";
import { Brand } from "./guests";
import { beat, HeroContext, WordBeat, type Hero } from "./hero";
import { slide } from "@remotion/transitions/slide";
import { Opening } from "./Opening";
import { Journey } from "./journey";
import { LangContext, type Lang } from "./lang";
import { AiMenu, Assistant, Profit, Stock } from "./owner";
import { Pay } from "./pay";
import { Sfx } from "./sfx";
import { Branches } from "./team";

// The fast cut (~69 s): the hero moments with the camera on the action, one short title
// each, a word beat, a montage of the back office at double speed, every cut on a bar
// of the 150 BPM track (12 frames a beat). The long tour is Tour.tsx.
const next = () => springTiming({ config: { damping: 200 }, durationInFrames: 15 });
const CUTS = [151, 343, 391, 823, 1015, 1207, 1303, 1447, 1543, 1639, 1879];

const H: Record<string, Hero> = {
  brand: { title: "Any place. Your look.", titleAr: "أي مكان، بشكلك.", cam: [{ f: 0, s: 1.08, x: 1556, y: 540 }] },
  pay: {
    title: "Split the bill.",
    titleAr: "قسّم الحساب.",
    rate: 1.25,
    cam: [
      { f: beat(0, 1.25), s: 1, x: 1556, y: 540 },
      { f: beat(2, 1.25), s: 1.45, x: 1556, y: 600 },
      { f: beat(13, 1.25), s: 1.45, x: 1556, y: 600 },
      { f: beat(14, 1.25), s: 1.2, x: 1440, y: 560 },
    ],
  },
  book: {
    title: "Book a room.",
    titleAr: "احجز اوضة.",
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
  branches: { rate: 2.2, title: "Every branch.", titleAr: "كل الفروع.", cam: [{ f: 0, s: 1.1, x: 1320, y: 480 }] },
  menu: {
    rate: 1.8,
    title: "Menu from a photo.",
    titleAr: "المنيو من صورة.",
    cam: [
      { f: 0, s: 0.92, x: 1130, y: 520 },
      { f: 150, s: 0.92, x: 1130, y: 520 },
      { f: 176, s: 1.35, x: 1520, y: 740 },
      { f: 300, s: 1.35, x: 1520, y: 740 },
    ],
  },
  stock: { rate: 2.2, title: "Every dish costed.", titleAr: "تكلفة كل صنف.", cam: [{ f: 0, s: 0.95, x: 1150, y: 520 }] },
  profit: { rate: 2.2, title: "Profit, live.", titleAr: "مكسبك لايف.", cam: [{ f: 0, s: 1.1, x: 1320, y: 470 }] },
  ask: {
    title: "Ask your café.",
    titleAr: "اسأل الكافيه بتاعك.",
    rate: 1.25,
    cam: [
      { f: beat(0, 1.25), s: 1, x: 1320, y: 540 },
      { f: beat(4, 1.25), s: 1.22, x: 1240, y: 460 },
      { f: beat(10, 1.25), s: 1.22, x: 1240, y: 460 },
      { f: beat(11, 1.25), s: 1.22, x: 1320, y: 650 },
    ],
  },
};

const P = { title: "", line: "" };

export const Fast: React.FC<{ readonly lang?: Lang }> = ({ lang = "en" }) => {
  // A sideways camera pan between hero scenes, in reading direction.
  const pan = () => slide({ direction: lang === "ar" ? "from-left" : "from-right" });
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  return (
    <LangContext.Provider value={lang}>
      {/* The same track as the tour, started 235 frames in so its drop hits the first cut. */}
      <Audio
        name="Music"
        src={staticFile("tour-music-hype.mp3")}
        trimBefore={235}
        premountFor={fps}
        volume={interpolate(frame, [0, 0.3 * fps, durationInFrames - 2 * fps, durationInFrames - 1], [0, 0.85, 0.85, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
      />
      <Sfx name="riser" at={CUTS[0] - 44} />
      <Sfx name="impact" at={CUTS[0] - 1} />
      {CUTS.map((c) => (
        <Sfx key={c} name="whoosh" at={c - 9} />
      ))}
      <TransitionSeries>
        <TransitionSeries.Sequence name="Lineup" durationInFrames={159} premountFor={fps}>
          <Opening line="Your whole café, in one place." lineAr="كافيهك كله في مكان واحد." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={next()} />
        <TransitionSeries.Sequence name="Any place" durationInFrames={207} premountFor={fps}>
          <HeroContext.Provider value={H.brand}>
            <Brand {...P} />
          </HeroContext.Provider>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={next()} />
        <TransitionSeries.Sequence name="Order. Cook. Deliver." durationInFrames={63} premountFor={fps}>
          <WordBeat words={["Order.", "Cook.", "Deliver."]} wordsAr={["اطلب.", "جهّز.", "وصّل."]} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={next()} />
        <TransitionSeries.Sequence name="One order" durationInFrames={447} premountFor={fps}>
          <Journey headline="" minimal playbackRate={1.75} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={next()} />
        <TransitionSeries.Sequence name="Split the bill" durationInFrames={207} premountFor={fps}>
          <HeroContext.Provider value={H.pay}>
            <Pay {...P} playbackRate={1.25} />
          </HeroContext.Provider>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={pan()} timing={next()} />
        <TransitionSeries.Sequence name="Book a room" durationInFrames={207} premountFor={fps}>
          <HeroContext.Provider value={H.book}>
            <Book {...P} playbackRate={1.25} />
          </HeroContext.Provider>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={pan()} timing={next()} />
        <TransitionSeries.Sequence name="Every branch" durationInFrames={111} premountFor={fps}>
          <HeroContext.Provider value={H.branches}>
            <Branches {...P} playbackRate={2.2} />
          </HeroContext.Provider>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={pan()} timing={next()} />
        <TransitionSeries.Sequence name="Menu from a photo" durationInFrames={159} premountFor={fps}>
          <HeroContext.Provider value={H.menu}>
            <AiMenu {...P} playbackRate={1.8} />
          </HeroContext.Provider>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={pan()} timing={next()} />
        <TransitionSeries.Sequence name="Every dish costed" durationInFrames={111} premountFor={fps}>
          <HeroContext.Provider value={H.stock}>
            <Stock {...P} playbackRate={2.2} />
          </HeroContext.Provider>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={pan()} timing={next()} />
        <TransitionSeries.Sequence name="Profit, live" durationInFrames={111} premountFor={fps}>
          <HeroContext.Provider value={H.profit}>
            <Profit {...P} playbackRate={2.2} />
          </HeroContext.Provider>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={pan()} timing={next()} />
        <TransitionSeries.Sequence name="Ask your café" durationInFrames={255} premountFor={fps}>
          <HeroContext.Provider value={H.ask}>
            <Assistant {...P} playbackRate={1.25} />
          </HeroContext.Provider>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={next()} />
        <TransitionSeries.Sequence name="End card" durationInFrames={210} premountFor={fps}>
          <Finale headline="Everything your café runs on." tagline="One app for your whole café." url="ninjapp.net" />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </LangContext.Provider>
  );
};
