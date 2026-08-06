import type { ReactNode } from 'react'
import { ScaleToFit } from './ScaleToFit'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <main className="px-7 py-[26px]">
        <ScaleToFit>{children}</ScaleToFit>
      </main>
    </div>
  )
}
