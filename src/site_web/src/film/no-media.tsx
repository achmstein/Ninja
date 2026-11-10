// The film's scenes place sounds with <Audio> (@remotion/media). The page plays them
// silent, so that whole package is swapped for this at build (vite.config.ts): no sound,
// and none of its weight.
export const Audio = () => null
