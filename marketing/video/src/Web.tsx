// The website's clips as compositions, to preview in Studio or render (scripts/render-web.sh).
import type React from "react";
import { Composition, Folder } from "remotion";
import { CLIPS, CROP, Cropped, FPS, JOURNEY_FRAMES, OneOrder } from "./web-clips";

export const WebClips: React.FC = () => (
  <Folder name="Web">
    {(["en", "ar"] as const).map((lang) => {
      const tail = lang === "ar" ? "Ar" : "";
      return (
        <Folder key={lang} name={`Web-${lang}`}>
          <Composition id={`WebJourney${tail}`} component={OneOrder} durationInFrames={JOURNEY_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ lang }} />
          {CLIPS.map((clip) => (
            <Composition key={clip.id} id={`Web${clip.id}${tail}`} component={Cropped} durationInFrames={clip.frames} fps={FPS} width={CROP} height={1080} defaultProps={{ lang, id: clip.id }} />
          ))}
        </Folder>
      );
    })}
  </Folder>
);
