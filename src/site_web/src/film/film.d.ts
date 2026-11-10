// The film's clips are compiled by Vite from marketing/video/src (alias @film); TypeScript
// only needs to know their shape here, so that project's own settings stay its own.
declare module '@film/web-clips' {
  import type { FC, ReactNode } from 'react'
  type Lang = 'en' | 'ar'
  export const CROP: number
  export const FPS: number
  export const JOURNEY_FRAMES: number
  export const CLIPS: { id: string; frames: number; hero: unknown; scene: ReactNode }[]
  export const Cropped: FC<{ lang: Lang; id: string }>
  export const OneOrder: FC<{ lang: Lang }>
}
