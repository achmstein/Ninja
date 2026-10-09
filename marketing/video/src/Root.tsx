import { Composition, Folder } from "remotion";
import { Promo } from "./Promo";
import { Assistant } from "./scenes/Assistant";
import { Hook } from "./scenes/Hook";
import { Kitchen } from "./scenes/Kitchen";
import { Order } from "./scenes/Order";
import { Outro } from "./scenes/Outro";
import { Rider } from "./scenes/Rider";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Promo" component={Promo} durationInFrames={660} fps={30} width={1080} height={1920} />
      <Folder name="Promo-Scenes">
        <Composition
          id="Hook"
          component={Hook}
          durationInFrames={90}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ problem: "Your café runs on six apps.", answer: "Run it on one." }}
        />
        <Composition
          id="Order"
          component={Order}
          durationInFrames={150}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ headline: "Guests order from the table." }}
        />
        <Composition
          id="Kitchen"
          component={Kitchen}
          durationInFrames={110}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ headline: "The kitchen sees it instantly." }}
        />
        <Composition
          id="Rider"
          component={Rider}
          durationInFrames={110}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ headline: "Your own riders deliver it." }}
        />
        <Composition
          id="Assistant"
          component={Assistant}
          durationInFrames={150}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ headline: "Ask your café anything.", question: "Which dishes have my lowest margins?" }}
        />
        <Composition
          id="Outro"
          component={Outro}
          durationInFrames={110}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{
            features: "Order. Kitchen. Delivery. AI.",
            tagline: "One app for your whole café.",
            url: "ninjapp.net",
          }}
        />
      </Folder>
    </>
  );
};
