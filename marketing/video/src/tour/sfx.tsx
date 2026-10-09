// Sound design: every effect is placed on the frame its motion happens, inside the
// component that moves, so retiming a scene retimes its sound with it.
// UI sounds are Kenney's Interface Sounds (CC0, public/sfx/KENNEY-LICENSE.txt);
// whoosh, swish, impact and riser are synthesized for this video (ffmpeg noise/sine).
import { Audio } from "@remotion/media";
import type React from "react";
import { Sequence, staticFile, useVideoConfig } from "remotion";

export type SfxName =
  | "tap"
  | "select"
  | "success"
  | "land"
  | "pop"
  | "tick"
  | "ding"
  | "open"
  | "switch"
  | "whoosh"
  | "swish"
  | "impact"
  | "riser";

// A level per sound, so the mix sits under the music.
const LEVEL: Record<SfxName, number> = {
  tap: 0.55,
  select: 0.45,
  success: 0.5,
  land: 0.5,
  pop: 0.22,
  tick: 0.3,
  ding: 0.45,
  open: 0.35,
  switch: 0.4,
  whoosh: 0.5,
  swish: 0.35,
  impact: 0.7,
  riser: 0.45,
};

export const Sfx: React.FC<{ name: SfxName; at: number; volume?: number }> = ({ name, at, volume = 1 }) => {
  const { fps } = useVideoConfig();
  if (at < 0) return null;
  return (
    <Sequence from={Math.round(at)} durationInFrames={2 * fps} layout="none" name={`sfx: ${name}`}>
      <Audio src={staticFile(`sfx/${name}.mp3`)} volume={LEVEL[name] * volume} />
    </Sequence>
  );
};
