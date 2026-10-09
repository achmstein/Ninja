import { Composition, Folder } from "remotion";
import { Promo } from "./Promo";
import { Assistant } from "./scenes/Assistant";
import { Hook } from "./scenes/Hook";
import { Kitchen } from "./scenes/Kitchen";
import { Order } from "./scenes/Order";
import { Outro } from "./scenes/Outro";
import { Rider } from "./scenes/Rider";
import { Finale } from "./tour/Finale";
import { Book } from "./tour/book";
import { Journey, JOURNEY_FRAMES } from "./tour/journey";
import { Brand, Loyalty } from "./tour/guests";
import { Pay } from "./tour/pay";
import { Intro } from "./tour/Intro";
import { AiMenu, Assistant as TourAssistant, Profit, Stock } from "./tour/owner";
import { Branches } from "./tour/team";
import { Fast } from "./tour/Fast";
import { Tour } from "./tour/Tour";

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
            features: "Order. Cook. Deliver. Ask.",
            tagline: "One app for your whole café.",
            url: "ninjapp.net",
          }}
        />
      </Folder>
      <Composition
        id="Hero"
        component={Fast}
        durationInFrames={2082}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ lang: "en" as const }}
      />
      <Composition
        id="HeroAr"
        component={Fast}
        durationInFrames={2082}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ lang: "ar" as const }}
      />
      <Composition
        id="Tour"
        component={Tour}
        durationInFrames={3511}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ lang: "en" as const }}
      />
      <Composition
        id="TourAr"
        component={Tour}
        durationInFrames={3511}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ lang: "ar" as const }}
      />
      <Folder name="Tour-Scenes">
        <Composition
          id="TourIntro"
          component={Intro}
          durationInFrames={240}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ headline: "Your whole café, in one place.", features: "Ordering · Payments · Reservations · Loyalty · Delivery · Stock · Profit" }}
        />
        <Composition
          id="TourBrand"
          component={Brand}
          durationInFrames={300}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "It looks like your place.", line: "Café, restaurant, burger kitchen or game station: your logo, your colours, your menu layout." }}
        />
        <Composition
          id="TourJourney"
          component={Journey}
          durationInFrames={JOURNEY_FRAMES}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ headline: "Follow one order through every app." }}
        />
        <Composition
          id="TourPay"
          component={Pay}
          durationInFrames={270}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Pay at the table, split any way.", line: "The bill is in the dock. Each friend opens it and pays their share from their own phone." }}
        />
        <Composition
          id="TourBook"
          component={Book}
          durationInFrames={270}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Rooms, booked ahead.", line: "Guests hold a room from their phone and watch the countdown while they walk over." }}
        />
        <Composition
          id="TourLoyalty"
          component={Loyalty}
          durationInFrames={210}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Every visit earns points.", line: "Guests watch their points and tier grow, and come back for the rewards you choose." }}
        />
        <Composition
          id="TourBranches"
          component={Branches}
          durationInFrames={210}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Every branch, one dashboard.", line: "Each branch keeps its own prices and hours. Guests are sent to the one nearest them." }}
        />
        <Composition
          id="TourAiMenu"
          component={AiMenu}
          durationInFrames={300}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Photograph your menu. It's online in minutes.", line: "Ninja reads your printed menu into categories and prices, and the photo studio makes every dish look its best." }}
        />
        <Composition
          id="TourStock"
          component={Stock}
          durationInFrames={300}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Know what every dish really costs.", line: "Snap a supplier's receipt to fill your stock. Recipes turn it into each dish's cost and margin." }}
        />
        <Composition
          id="TourProfit"
          component={Profit}
          durationInFrames={240}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Your profit, without a spreadsheet.", line: "Sales, refunds, stock, wages and expenses add up on their own, month by month." }}
        />
        <Composition
          id="TourAssistant"
          component={TourAssistant}
          durationInFrames={330}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Ask your café anything.", line: "Connect Claude or ChatGPT to Ninja, then ask about sales, profit, stock or staff, or have it make the change." }}
        />
        <Composition
          id="TourFinale"
          component={Finale}
          durationInFrames={210}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ headline: "Everything your café runs on.", tagline: "One app for your whole café.", url: "ninjapp.net" }}
        />
      </Folder>
    </>
  );
};
