import { Composition, Folder } from "remotion";
import { Promo } from "./Promo";
import { Assistant } from "./scenes/Assistant";
import { Hook } from "./scenes/Hook";
import { Kitchen } from "./scenes/Kitchen";
import { Order } from "./scenes/Order";
import { Outro } from "./scenes/Outro";
import { Rider } from "./scenes/Rider";
import { Finale } from "./tour/Finale";
import { Book, Brand, Loyalty, Order as TourOrder, Pay } from "./tour/guests";
import { Intro } from "./tour/Intro";
import { AiMenu, Assistant as TourAssistant, Profit, Stock } from "./tour/owner";
import { Branches, Delivery, Kitchen as TourKitchen, Till } from "./tour/team";
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
      <Composition id="Tour" component={Tour} durationInFrames={3720} fps={30} width={1920} height={1080} />
      <Folder name="Tour-Scenes">
        <Composition
          id="TourIntro"
          component={Intro}
          durationInFrames={210}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ question: "How many apps did you open today?", answer: "One app runs your whole café." }}
        />
        <Composition
          id="TourBrand"
          component={Brand}
          durationInFrames={300}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "It looks like your café.", line: "Set your logo, colours and menu layout. The guest app changes as you choose." }}
        />
        <Composition
          id="TourOrder"
          component={TourOrder}
          durationInFrames={330}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Guests order from the table.", line: "They scan the QR on the table and order in seconds. It lands on the till and in the kitchen." }}
        />
        <Composition
          id="TourPay"
          component={Pay}
          durationInFrames={270}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Pay at the table, split any way.", line: "Each friend pays their share from their own phone. You see the bill fill up at the till." }}
        />
        <Composition
          id="TourBook"
          component={Book}
          durationInFrames={270}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Rooms and tables, booked ahead.", line: "Guests see what's free and hold it from their phone. The till keeps it for them." }}
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
          id="TourTill"
          component={Till}
          durationInFrames={240}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "A till your staff learn in a minute.", line: "Tap to sell, split rounds by who's paying, and close the shift with the drawer counted." }}
        />
        <Composition
          id="TourKitchen"
          component={TourKitchen}
          durationInFrames={210}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "The kitchen sees it instantly.", line: "Tickets change colour as they wait, so nothing is forgotten on a busy night." }}
        />
        <Composition
          id="TourDelivery"
          component={Delivery}
          durationInFrames={300}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Deliver with your own riders.", line: "No commission. Riders get their own app, and guests watch their order come to the door." }}
        />
        <Composition
          id="TourBranches"
          component={Branches}
          durationInFrames={210}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ title: "Every branch, in one place.", line: "Each branch keeps its own prices and hours. Guests are sent to the one nearest them." }}
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
          defaultProps={{ recap: "Your brand · Table ordering · Pay & split · Rooms & tables · Loyalty · Till · Kitchen · Own delivery · Branches · Menu scan · Photo studio · Stock & recipes · Food cost · Profit · Payroll · Ask your café", tagline: "Everything your café runs on.", url: "ninjapp.net" }}
        />
      </Folder>
    </>
  );
};
