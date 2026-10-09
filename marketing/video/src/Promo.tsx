import { springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { useVideoConfig } from "remotion";
import { Assistant } from "./scenes/Assistant";
import { Hook } from "./scenes/Hook";
import { Kitchen } from "./scenes/Kitchen";
import { Order } from "./scenes/Order";
import { Outro } from "./scenes/Outro";
import { Rider } from "./scenes/Rider";

// 22 s vertical promo: hook → QR order → kitchen → rider → Ninja AI → end card.
// Six scenes of 90+150+110+110+150+110 frames, minus five 12-frame transitions = 660.
export const Promo = () => {
  const { fps } = useVideoConfig();

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence name="Hook" durationInFrames={90} premountFor={fps}>
        <Hook problem="Your café runs on six apps." answer="Run it on one." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence name="Order" durationInFrames={150} premountFor={fps}>
        <Order headline="Guests order from the table." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence name="Kitchen" durationInFrames={110} premountFor={fps}>
        <Kitchen headline="The kitchen sees it instantly." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={wipe({ direction: "from-bottom" })}
        timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence name="Rider" durationInFrames={110} premountFor={fps}>
        <Rider headline="Your own riders deliver it." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence name="Ninja AI" durationInFrames={150} premountFor={fps}>
        <Assistant headline="Ask your café anything." question="Which dishes have my lowest margins?" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence name="End card" durationInFrames={110} premountFor={fps}>
        <Outro features="Order. Kitchen. Delivery. AI." tagline="One app for your whole café." url="ninjapp.net" />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
