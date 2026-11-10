// The website's clips (src/site_web plays them live, as HTML, in a Remotion Player; this
// project can also render them): the film's own chapters in hero mode, each alone and
// without its title, since the page sets the words itself. Most are cut to the side of
// the stage the camera keeps the action on (the right; the left in Arabic, where the
// stage is mirrored), so a clip is the screen at work and nothing else.
import type React from "react";
import { AbsoluteFill } from "remotion";
import { Book } from "./tour/book";
import { H } from "./tour/cams";
import { Brand, Loyalty } from "./tour/guests";
import { HeroContext, type Hero } from "./tour/hero";
import { Journey } from "./tour/journey";
import { LangContext, type Lang } from "./tour/lang";
import { AiMenu, Assistant, Profit, Stock } from "./tour/owner";
import { Pay } from "./tour/pay";
import { Branches, Delivery, Kitchen, Till } from "./tour/team";

const P = { title: "", line: "" };
const still: Hero = { title: "", titleAr: "", cam: [{ f: 0, s: 1, x: 1250, y: 540 }] };
const silent = (hero: Hero): Hero => ({ ...hero, title: "", titleAr: "" });
// A tablet fills the cut a little more than it does the full stage.
const tablet: Hero = { title: "", titleAr: "", cam: [{ f: 0, s: 1.14, x: 1320, y: 520 }] };

// The part of the 1920-wide stage a clip keeps.
export const CROP = 1160;

type Clip = { id: string; frames: number; hero: Hero; scene: React.ReactNode };

export const CLIPS: Clip[] = [
  { id: "Brand", frames: 207, hero: silent(H.brand), scene: <Brand {...P} /> },
  { id: "Pay", frames: 207, hero: silent(H.pay), scene: <Pay {...P} playbackRate={1.25} /> },
  { id: "Book", frames: 207, hero: silent(H.book), scene: <Book {...P} playbackRate={1.25} /> },
  { id: "Loyalty", frames: 180, hero: still, scene: <Loyalty {...P} /> },
  { id: "Till", frames: 200, hero: tablet, scene: <Till {...P} /> },
  { id: "Kitchen", frames: 190, hero: tablet, scene: <Kitchen {...P} /> },
  { id: "Delivery", frames: 240, hero: still, scene: <Delivery {...P} /> },
  { id: "Branches", frames: 111, hero: silent(H.branches), scene: <Branches {...P} playbackRate={2.2} /> },
  { id: "Menu", frames: 159, hero: silent(H.menu), scene: <AiMenu {...P} playbackRate={1.8} /> },
  { id: "Stock", frames: 111, hero: silent(H.stock), scene: <Stock {...P} playbackRate={2.2} /> },
  { id: "Profit", frames: 111, hero: silent(H.profit), scene: <Profit {...P} playbackRate={2.2} /> },
  { id: "Ask", frames: 255, hero: silent(H.ask), scene: <Assistant {...P} playbackRate={1.25} /> },
];

// A composition's props must be plain data, so a clip is named and looked up here.
export const Cropped: React.FC<{ readonly lang: Lang; readonly id: string }> = ({ lang, id }) => {
  const clip = CLIPS.find((c) => c.id === id) ?? CLIPS[0];
  return (
  <LangContext.Provider value={lang}>
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: lang === "ar" ? 0 : CROP - 1920, width: 1920, height: 1080 }}>
        <HeroContext.Provider value={clip.hero}>{clip.scene}</HeroContext.Provider>
      </div>
    </AbsoluteFill>
  </LangContext.Provider>
  );
};

// One order through every app, the whole stage.
export const OneOrder: React.FC<{ readonly lang: Lang }> = ({ lang }) => (
  <LangContext.Provider value={lang}>
    <Journey headline="" minimal playbackRate={1.75} />
  </LangContext.Provider>
);


/** How long the order's journey runs, in frames */
export const JOURNEY_FRAMES = 447;
export const FPS = 30;
