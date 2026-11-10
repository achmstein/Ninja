import { useEffect, useRef } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { CLIPS, CROP, Cropped, FPS, JOURNEY_FRAMES, OneOrder } from '@film/web-clips'
import type { Lang } from '@/lib/lang'

/**
 * One of the film's scenes, played live: the same components the films are
 * rendered from (marketing/video), drawn here as HTML at whatever size the
 * page gives them. It has no controls and takes no input; the page starts and
 * stops it as it comes on and off the screen. Loaded apart from the page, on
 * the first clip that nears the screen.
 */
export default function FilmPlayer({ name, lang, playing }: { name: string; lang: Lang; playing: boolean }) {
  const ref = useRef<PlayerRef>(null)
  useEffect(() => {
    if (playing) ref.current?.play()
    else ref.current?.pause()
  }, [playing])

  const clip = CLIPS.find((c) => c.id.toLowerCase() === name)
  const shared = {
    ref,
    fps: FPS,
    compositionHeight: 1080,
    loop: true,
    controls: false,
    clickToPlay: false,
    doubleClickToFullscreen: false,
    spaceKeyToPlayOrPause: false,
    initiallyMuted: true,
    acknowledgeRemotionLicense: true,
    style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } as const,
  }
  if (!clip) return <Player {...shared} component={OneOrder} inputProps={{ lang }} durationInFrames={JOURNEY_FRAMES} compositionWidth={1920} />
  return <Player {...shared} component={Cropped} inputProps={{ lang, id: clip.id }} durationInFrames={clip.frames} compositionWidth={CROP} />
}
