// A screen's code is fetched the first time it is opened. After a release
// the files a page already open asks for are gone: the fetch fails and the
// screen never comes up, on a phone most of all, where the till stays open
// in the background for days. The answer is the new release, one reload away.

const RELOADED_KEY = 'ninja-pos-reloaded-for-build'
/** One reload per failure: a second one this soon means the reload did not help */
const RELOAD_GAP_MS = 30_000

/** Whether the error is a screen's code that could not be fetched (each browser words it its own way). */
export function isStaleBuildError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return /dynamically imported module|Importing a module script failed|module script|Unable to preload CSS|ChunkLoadError/i.test(
    message
  )
}

/** Whether a reload may be tried now, given when the last one was (null: never). */
export function mayReload(lastReloadAt: number | null, now: number): boolean {
  return lastReloadAt == null || now < lastReloadAt || now - lastReloadAt > RELOAD_GAP_MS
}

/** Reloads onto the new release, once. False when it was just tried: the error is shown instead. */
export function reloadForNewBuild(): boolean {
  try {
    const raw = sessionStorage.getItem(RELOADED_KEY)
    const last = raw == null ? null : Number(raw)
    if (!mayReload(Number.isFinite(last) ? last : null, Date.now())) return false
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()))
  } catch {
    // No storage to remember the try in: reloading could go round for ever
    return false
  }
  window.location.reload()
  return true
}
