import { RouterProvider, type AnyRouter } from '@tanstack/react-router'
import { PausedScreen } from './components/paused-screen'
import { usePaused } from './lib/brand'

// A café whose stack is off shows one notice; anything else is the app
export function App({ router }: { router: AnyRouter }) {
  const paused = usePaused((s) => s.paused)
  return paused ? <PausedScreen /> : <RouterProvider router={router} />
}
