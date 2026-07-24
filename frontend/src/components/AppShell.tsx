import type { ReactNode } from 'react'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <main className="px-7 py-[26px]">
        <div className="mx-auto max-w-[1360px]">{children}</div>
      </main>
    </div>
  )
}
