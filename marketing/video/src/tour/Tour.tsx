import { springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Audio } from "@remotion/media";
import { interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Finale } from "./Finale";
import { Book, Brand, Loyalty, Order, Pay } from "./guests";
import { Intro } from "./Intro";
import { AiMenu, Assistant, Profit, Stock } from "./owner";
import { Branches, Delivery, Kitchen, Till } from "./team";

const next = () => springTiming({ config: { damping: 200 }, durationInFrames: 15 });

// The feature tour for café owners, 1920 × 1080: 15 scenes, 3930 frames minus
// fourteen 15-frame transitions = 3720 frames (2:04).
export const Tour = () => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  return (
    <>
      {/* Lyria 3 Pro instrumental (Artlist), past its 1.5 s of lead-in silence; fades out over the end card */}
      <Audio
        name="Music"
        src={staticFile("tour-music.mp3")}
        trimBefore={1.5 * fps}
        premountFor={fps}
        volume={interpolate(
          frame,
          [0, 0.4 * fps, durationInFrames - 3 * fps, durationInFrames - 1],
          [0, 0.85, 0.85, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )}
      />
      <TransitionSeries>
      <TransitionSeries.Sequence name="Intro" durationInFrames={210} premountFor={fps}>
        <Intro question="How many apps did you open today?" answer="One app runs your whole café." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="01 Your brand" durationInFrames={300} premountFor={fps}>
        <Brand
          title="It looks like your café."
          line="Set your logo, colours and menu layout. The guest app changes as you choose."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={next()} />
      <TransitionSeries.Sequence name="02 Table ordering" durationInFrames={330} premountFor={fps}>
        <Order
          title="Guests order from the table."
          line="They scan the QR on the table and order in seconds. It lands on the till and in the kitchen."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={next()} />
      <TransitionSeries.Sequence name="03 Pay & split" durationInFrames={270} premountFor={fps}>
        <Pay
          title="Pay at the table, split any way."
          line="Each friend pays their share from their own phone. You see the bill fill up at the till."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={next()} />
      <TransitionSeries.Sequence name="04 Rooms & tables" durationInFrames={270} premountFor={fps}>
        <Book
          title="Rooms and tables, booked ahead."
          line="Guests see what's free and hold it from their phone. The till keeps it for them."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={next()} />
      <TransitionSeries.Sequence name="05 Loyalty" durationInFrames={210} premountFor={fps}>
        <Loyalty
          title="Every visit earns points."
          line="Guests watch their points and tier grow, and come back for the rewards you choose."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="06 Till" durationInFrames={240} premountFor={fps}>
        <Till
          title="A till your staff learn in a minute."
          line="Tap to sell, split rounds by who's paying, and close the shift with the drawer counted."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={next()} />
      <TransitionSeries.Sequence name="07 Kitchen" durationInFrames={210} premountFor={fps}>
        <Kitchen
          title="The kitchen sees it instantly."
          line="Tickets change colour as they wait, so nothing is forgotten on a busy night."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="08 Own delivery" durationInFrames={300} premountFor={fps}>
        <Delivery
          title="Deliver with your own riders."
          line="No commission. Riders get their own app, and guests watch their order come to the door."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={next()} />
      <TransitionSeries.Sequence name="09 Branches" durationInFrames={210} premountFor={fps}>
        <Branches
          title="Every branch, in one place."
          line="Each branch keeps its own prices and hours. Guests are sent to the one nearest them."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="10 Menu scan" durationInFrames={300} premountFor={fps}>
        <AiMenu
          title="Photograph your menu. It's online in minutes."
          line="Ninja reads your printed menu into categories and prices, and the photo studio makes every dish look its best."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={next()} />
      <TransitionSeries.Sequence name="11 Stock & food cost" durationInFrames={300} premountFor={fps}>
        <Stock
          title="Know what every dish really costs."
          line="Snap a supplier's receipt to fill your stock. Recipes turn it into each dish's cost and margin."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={next()} />
      <TransitionSeries.Sequence name="12 Profit & payroll" durationInFrames={240} premountFor={fps}>
        <Profit
          title="Your profit, without a spreadsheet."
          line="Sales, refunds, stock, wages and expenses add up on their own, month by month."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="13 Ask your café" durationInFrames={330} premountFor={fps}>
        <Assistant
          title="Ask your café anything."
          line="Connect Claude or ChatGPT to Ninja, then ask about sales, profit, stock or staff, or have it make the change."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={next()} />
      <TransitionSeries.Sequence name="End card" durationInFrames={210} premountFor={fps}>
        <Finale
          recap="Your brand · Table ordering · Pay & split · Rooms & tables · Loyalty · Till · Kitchen · Own delivery · Branches · Menu scan · Photo studio · Stock & recipes · Food cost · Profit · Payroll · Ask your café"
          tagline="Everything your café runs on."
          url="ninjapp.net"
        />
      </TransitionSeries.Sequence>
      </TransitionSeries>
    </>
  );
};
