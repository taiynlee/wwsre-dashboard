import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createSite, deleteSite, fetchSites, updateSite } from './lib/api'
import type { SiteCreateInput, SiteUpdateInput } from './lib/types'
import { SiteCard } from './components/SiteCard'
import { AddSiteCard } from './components/AddSiteCard'

function isAxiosErrorWithDetail(err: unknown): err is { response: { data: { detail: string } } } {
  return typeof err === 'object' && err !== null && 'response' in err
}

function App() {
  const queryClient = useQueryClient()
  const [createError, setCreateError] = useState<string | null>(null)

  const sitesQuery = useQuery({ queryKey: ['admin-sites'], queryFn: fetchSites })

  const createMutation = useMutation({
    mutationFn: (input: SiteCreateInput) => createSite(input),
    onSuccess: () => {
      setCreateError(null)
      queryClient.invalidateQueries({ queryKey: ['admin-sites'] })
    },
    onError: (err) => {
      setCreateError(isAxiosErrorWithDetail(err) ? err.response.data.detail : 'Failed to create site.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ code, input }: { code: string; input: SiteUpdateInput }) => updateSite(code, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sites'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (code: string) => deleteSite(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sites'] }),
  })

  return (
    <main className="min-h-screen bg-neutral-950 px-7 py-6 text-neutral-100">
      <div className="mx-auto max-w-[1200px]">
        <header className="mb-5 flex items-center gap-3 border-b border-neutral-900 pb-5">
          {/* logo.* is gitignored (confidential) — drop the real file into public/, hidden if absent */}
          <img
            src="/logo.png"
            alt=""
            className="h-[28px] w-auto"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <h1 className="text-[28px] font-semibold tracking-tight text-balance">Site &amp; SLO target management</h1>
        </header>

        <h2 className="mb-3 text-[15px] font-semibold">Sites</h2>
        {sitesQuery.isPending && <p className="font-mono text-sm text-neutral-500">Loading…</p>}
        {sitesQuery.isError && <p className="font-mono text-sm text-crit">Couldn't reach the admin API.</p>}
        {sitesQuery.data && (
          <div className="mb-8 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {sitesQuery.data.map((site) => (
              <SiteCard
                key={site.code}
                site={site}
                onUpdate={(code, input) => updateMutation.mutate({ code, input })}
                onDelete={(code) => deleteMutation.mutate(code)}
                isUpdating={updateMutation.isPending}
                isDeleting={deleteMutation.isPending}
              />
            ))}
            <AddSiteCard onCreate={(input) => createMutation.mutate(input)} isCreating={createMutation.isPending} error={createError} />
          </div>
        )}
      </div>
    </main>
  )
}

export default App
