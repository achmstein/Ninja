import { springTiming, TransitionSeries } from "@remotion/transitions";
import { pushCut } from "@remotion/transitions/push-cut";
import { Audio } from "@remotion/media";
import { interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Finale } from "./Finale";
import { Book } from "./book";
import { Brand, Loyalty } from "./guests";
import { Journey, JOURNEY_FRAMES } from "./journey";
import { Pay } from "./pay";
import { Intro } from "./Intro";
import { LangContext, type Lang } from "./lang";
import { AiMenu, Assistant, Profit, Stock } from "./owner";
import { Branches } from "./team";

const next = () => springTiming({ config: { damping: 200 }, durationInFrames: 15 });

// The feature tour for café owners, 1920 × 1080: 12 scenes, 3660 frames minus
// eleven 15-frame transitions = 3495 frames (1:56.5).
export const Tour: React.FC<{ readonly lang?: Lang }> = ({ lang = "en" }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  return (
    <LangContext.Provider value={lang}>
      {/* Lyria 3 Pro instrumental (Artlist): high-energy tech-launch, 126 BPM; fades out over the end card.
          The calmer first track is public/tour-music.mp3. */}
      <Audio
        name="Music"
        src={staticFile("tour-music-hype.mp3")}
        premountFor={fps}
        volume={interpolate(
          frame,
          [0, 0.4 * fps, durationInFrames - 3 * fps, durationInFrames - 1],
          [0, 0.85, 0.85, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )}
      />
      <TransitionSeries>
      <TransitionSeries.Sequence name="Intro" durationInFrames={240} premountFor={fps}>
        <Intro
          headline="Your whole café, in one place."
          features="Ordering · Payments · Reservations · Loyalty · Delivery · Stock · Profit"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={pushCut()} timing={next()} />
      <TransitionSeries.Sequence name="01 Your brand" durationInFrames={300} premountFor={fps}>
        <Brand
          title="It looks like your café."
          line="Set your logo, colours and menu layout. The guest app changes as you choose."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={pushCut()} timing={next()} />
      <TransitionSeries.Sequence name="02 One order, every app" durationInFrames={JOURNEY_FRAMES} premountFor={fps}>
        <Journey headline="Follow one order through every app." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={pushCut()} timing={next()} />
      <TransitionSeries.Sequence name="03 Pay & split" durationInFrames={270} premountFor={fps}>
        <Pay
          title="Pay at the table, split any way."
          line="The bill is in the dock. Each friend opens it and pays their share from their own phone."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={pushCut()} timing={next()} />
      <TransitionSeries.Sequence name="04 Rooms & tables" durationInFrames={270} premountFor={fps}>
        <Book
          title="Rooms and tables, booked ahead."
          line="Guests hold a table from their phone and watch the countdown while they walk over."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={pushCut()} timing={next()} />
      <TransitionSeries.Sequence name="05 Loyalty" durationInFrames={210} premountFor={fps}>
        <Loyalty
          title="Every visit earns points."
          line="Guests watch their points and tier grow, and come back for the rewards you choose."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={pushCut()} timing={next()} />
      <TransitionSeries.Sequence name="06 Branches" durationInFrames={210} premountFor={fps}>
        <Branches
          title="Every branch, one dashboard."
          line="Each branch keeps its own prices and hours. Guests are sent to the one nearest them."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={pushCut()} timing={next()} />
      <TransitionSeries.Sequence name="07 Menu scan" durationInFrames={300} premountFor={fps}>
        <AiMenu
          title="Photograph your menu. It's online in minutes."
          line="Ninja reads your printed menu into categories and prices, and the photo studio makes every dish look its best."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={pushCut()} timing={next()} />
      <TransitionSeries.Sequence name="08 Stock & food cost" durationInFrames={300} premountFor={fps}>
        <Stock
          title="Know what every dish really costs."
          line="Snap a supplier's receipt to fill your stock. Recipes turn it into each dish's cost and margin."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={pushCut()} timing={next()} />
      <TransitionSeries.Sequence name="09 Profit & payroll" durationInFrames={240} premountFor={fps}>
        <Profit
          title="Your profit, without a spreadsheet."
          line="Sales, refunds, stock, wages and expenses add up on their own, month by month."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={pushCut()} timing={next()} />
      <TransitionSeries.Sequence name="10 Ask your café" durationInFrames={330} premountFor={fps}>
        <Assistant
          title="Ask your café anything."
          line="Connect Claude or ChatGPT to Ninja, then ask about sales, profit, stock or staff, or have it make the change."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={pushCut()} timing={next()} />
      <TransitionSeries.Sequence name="End card" durationInFrames={210} premountFor={fps}>
        <Finale
          headline="Everything your café runs on."
          tagline="One app for your whole café."
          url="ninjapp.net"
        />
      </TransitionSeries.Sequence>
      </TransitionSeries>
    </LangContext.Provider>
  );
};
