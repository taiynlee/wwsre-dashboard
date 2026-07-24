import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, X, Check } from 'lucide-react'
import { fetchSiteCategories, replaceSiteCategories } from '../lib/api'
import type { Site, SiteCategoryTargetInput, SiteUpdateInput } from '../lib/types'

export function SiteCard({
  site,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: {
  site: Site
  onUpdate: (code: string, input: SiteUpdateInput) => void
  onDelete: (code: string) => void
  isUpdating: boolean
  isDeleting: boolean
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [form, setForm] = useState<SiteUpdateInput>({
    display_name: site.display_name,
    country: site.country,
    latitude: site.latitude,
    longitude: site.longitude,
    cluster_prefix: site.cluster_prefix,
  })
  const [categoryForm, setCategoryForm] = useState<SiteCategoryTargetInput[] | null>(null)

  const categoriesQuery = useQuery({
    queryKey: ['site-categories', site.code],
    queryFn: () => fetchSiteCategories(site.code),
    enabled: editing,
  })

  useEffect(() => {
    if (editing && categoriesQuery.data && categoryForm === null) {
      setCategoryForm(categoriesQuery.data.map((c) => ({ category: c.category, target_pct: c.target_pct, included: c.included })))
    }
  }, [editing, categoriesQuery.data, categoryForm])

  const saveCategoriesMutation = useMutation({
    mutationFn: (items: SiteCategoryTargetInput[]) => replaceSiteCategories(site.code, items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['site-categories', site.code] }),
  })

  function startEdit() {
    setForm({
      display_name: site.display_name,
      country: site.country,
      latitude: site.latitude,
      longitude: site.longitude,
      cluster_prefix: site.cluster_prefix,
    })
    setCategoryForm(null)
    setEditing(true)
  }

  function save() {
    onUpdate(site.code, form)
    if (categoryForm) saveCategoriesMutation.mutate(categoryForm)
    setEditing(false)
  }

  function updateCategory(index: number, patch: Partial<SiteCategoryTargetInput>) {
    setCategoryForm((prev) => (prev ? prev.map((c, i) => (i === index ? { ...c, ...patch } : c)) : prev))
  }

  if (confirmingDelete) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-crit/50 bg-crit/10 p-4">
        <p className="text-sm">
          Delete <span className="font-mono font-semibold">{site.code}</span>? This removes it from the global
          dashboard immediately.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => onDelete(site.code)}
            disabled={isDeleting}
            className="rounded-lg bg-crit px-3 py-1.5 text-xs font-semibold text-neutral-950 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting…' : 'Confirm delete'}
          </button>
          <button
            onClick={() => setConfirmingDelete(false)}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-300"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2.5 rounded-xl border border-accent bg-neutral-900 p-4">
        <div className="font-mono text-[15px] font-bold tracking-wide text-accent-strong">{site.code}</div>
        <Field label="Display name" value={form.display_name ?? ''} onChange={(v) => setForm((f) => ({ ...f, display_name: v }))} />
        <Field label="Country" value={form.country ?? ''} onChange={(v) => setForm((f) => ({ ...f, country: v }))} />
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Latitude"
            type="number"
            value={String(form.latitude ?? '')}
            onChange={(v) => setForm((f) => ({ ...f, latitude: Number(v) }))}
          />
          <Field
            label="Longitude"
            type="number"
            value={String(form.longitude ?? '')}
            onChange={(v) => setForm((f) => ({ ...f, longitude: Number(v) }))}
          />
        </div>
        <Field
          label="Cluster prefix"
          value={form.cluster_prefix ?? ''}
          onChange={(v) => setForm((f) => ({ ...f, cluster_prefix: v }))}
        />

        <div className="mt-1 border-t border-dashed border-neutral-800 pt-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10.5px] font-semibold tracking-wide text-neutral-500 uppercase">SLO categories</span>
            <span className="text-[10px] text-neutral-500">this site's SLO = avg of checked</span>
          </div>
          {categoriesQuery.isPending && <p className="font-mono text-xs text-neutral-500">Loading…</p>}
          {categoriesQuery.isError && <p className="font-mono text-xs text-crit">Couldn't load categories.</p>}
          {categoryForm && (
            <div className="flex flex-col gap-1">
              {categoryForm.map((c, i) => (
                <div key={c.category} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={c.included}
                    onChange={(e) => updateCategory(i, { included: e.target.checked })}
                    className="accent-good"
                  />
                  <span className={`min-w-0 flex-1 truncate text-[11px] ${c.included ? 'text-neutral-200' : 'text-neutral-600'}`}>
                    {c.category}
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={c.target_pct}
                    onChange={(e) => updateCategory(i, { target_pct: Number(e.target.value) })}
                    className="w-16 rounded-md border border-neutral-700 bg-neutral-950 px-1.5 py-1 text-right text-[11px] text-neutral-100 focus:border-accent"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-1 flex gap-2">
          <button
            onClick={save}
            disabled={isUpdating || saveCategoriesMutation.isPending}
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-neutral-950 disabled:opacity-50"
          >
            <Check size={14} /> {isUpdating || saveCategoriesMutation.isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-300"
          >
            <X size={14} /> Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-3 rounded-xl border bg-neutral-900 p-4 ${site.enabled ? 'border-neutral-800' : 'border-neutral-800 opacity-60'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-[15px] font-bold tracking-wide text-accent-strong">{site.code}</div>
          <div className="mt-0.5 text-[15.5px] font-semibold">{site.display_name}</div>
          <div className="text-[11.5px] text-neutral-400">{site.country}</div>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-neutral-400">
          <input
            type="checkbox"
            checked={site.enabled}
            disabled={isUpdating}
            onChange={(e) => onUpdate(site.code, { enabled: e.target.checked })}
            className="accent-good"
          />
          {site.enabled ? 'Enabled' : 'Disabled'}
        </label>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-neutral-400">
        <dt className="text-neutral-600">lat/long</dt>
        <dd>
          {site.latitude.toFixed(2)}, {site.longitude.toFixed(2)}
        </dd>
        <dt className="text-neutral-600">cluster prefix</dt>
        <dd>{site.cluster_prefix}</dd>
      </dl>

      <div className="flex gap-2 border-t border-dashed border-neutral-800 pt-2.5">
        <button onClick={startEdit} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-strong hover:underline">
          <Pencil size={12} /> Edit
        </button>
        <button
          onClick={() => setConfirmingDelete(true)}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-crit hover:underline"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold tracking-wide text-neutral-500 uppercase">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 focus:border-accent"
      />
    </label>
  )
}
