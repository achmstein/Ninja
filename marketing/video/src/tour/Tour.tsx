import { springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Audio } from "@remotion/media";
import { interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Finale } from "./Finale";
import { Book } from "./book";
import { Brand, Loyalty } from "./guests";
import { Journey } from "./journey";
import { Sfx } from "./sfx";
import { Pay } from "./pay";
import { Opening } from "./Opening";
import { LangContext, type Lang } from "./lang";
import { AiMenu, Assistant, Profit, Stock } from "./owner";
import { Branches } from "./team";

// Where each push-cut lands (frames), on the music's bars.
const CUTS = [232, 520, 1289, 1578, 1818, 2010, 2202, 2491, 2779, 3019, 3308];

const next = () => springTiming({ config: { damping: 200 }, durationInFrames: 15 });

// The feature tour for café owners, 1920 × 1080: 12 scenes whose cuts land on the music's bars,
// 3676 frames minus eleven 15-frame transitions = 3511 frames (1:57).
export const Tour: React.FC<{ readonly lang?: Lang }> = ({ lang = "en" }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  return (
    <LangContext.Provider value={lang}>
      {/* Lyria 3 Pro instrumental (Artlist), 150 BPM: a beat is 12 frames, a bar 48. It starts 154 frames
          in, so its drop (12.85 s) hits the first cut, and every chapter is a whole number of bars,
          so every cut lands on a bar. The calmer first track is public/tour-music.mp3. */}
      <Audio
        name="Music"
        src={staticFile("tour-music-hype.mp3")}
        trimBefore={154}
        premountFor={fps}
        volume={interpolate(
          frame,
          [0, 0.4 * fps, durationInFrames - 3 * fps, durationInFrames - 1],
          [0, 0.85, 0.85, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )}
      />
      {/* The cuts: a whoosh into each, the drop's impact on the first */}
      <Sfx name="riser" at={CUTS[0] - 44} />
      <Sfx name="impact" at={CUTS[0] - 1} />
      {CUTS.map((c) => (
        <Sfx key={c} name="whoosh" at={c - 9} />
      ))}
      <TransitionSeries>
      <TransitionSeries.Sequence name="Intro" durationInFrames={240} premountFor={fps}>
        <Opening line="Everything your café runs on." lineAr="كل اللي الكافيه بتاعك محتاجه." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="01 Your brand" durationInFrames={303} premountFor={fps}>
        <Brand
          title="It looks like your place."
          line="Café, restaurant, burger kitchen or game station: your logo, your colours, your menu layout."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="02 One order, every app" durationInFrames={784} premountFor={fps}>
        <Journey headline="One order, from the table to the door." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="03 Pay & split" durationInFrames={304} premountFor={fps}>
        <Pay
          title="Pay at the table, split any way."
          line="The bill is in the dock. Each friend opens it and pays their share from their own phone."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="04 Rooms & tables" durationInFrames={255} premountFor={fps}>
        <Book
          title="Rooms, booked ahead."
          line="Guests hold a room from their phone and watch the countdown while they walk over."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="05 Loyalty" durationInFrames={207} premountFor={fps}>
        <Loyalty
          title="Every visit earns points."
          line="Guests watch their points and tier grow, and come back for the rewards you choose."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="06 Branches" durationInFrames={207} premountFor={fps}>
        <Branches
          title="Every branch, one dashboard."
          line="Each branch keeps its own prices and hours. Guests are sent to the one nearest them."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="07 Menu scan" durationInFrames={304} premountFor={fps}>
        <AiMenu
          title="Photograph your menu. It's online in minutes."
          line="Ninja reads your printed menu into categories and prices, and the photo studio makes every dish look its best."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="08 Stock & food cost" durationInFrames={303} premountFor={fps}>
        <Stock
          title="Know what every dish really costs."
          line="Snap a supplier's receipt to fill your stock. Recipes turn it into each dish's cost and margin."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="09 Profit & payroll" durationInFrames={255} premountFor={fps}>
        <Profit
          title="Your profit, without a spreadsheet."
          line="Sales, refunds, stock, wages and expenses add up on their own, month by month."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="10 Ask your café" durationInFrames={304} premountFor={fps}>
        <Assistant
          title="Ask your café anything."
          line="Connect Claude or ChatGPT to Ninja, then ask about sales, profit, stock or staff, or have it make the change."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="End card" durationInFrames={210} premountFor={fps}>
        <Finale
          headline="One place for the whole café."
          tagline="Get Ninja for your café."
          url="ninjapp.net"
        />
      </TransitionSeries.Sequence>
      </TransitionSeries>
    </LangContext.Provider>
  );
};
