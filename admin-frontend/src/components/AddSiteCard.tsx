import { useState, type FormEvent } from 'react'
import { Plus, X, Check } from 'lucide-react'
import type { SiteCreateInput } from '../lib/types'

const EMPTY: SiteCreateInput = {
  code: '',
  display_name: '',
  country: '',
  latitude: 0,
  longitude: 0,
  cluster_prefix: '',
  enabled: true,
}

export function AddSiteCard({
  onCreate,
  isCreating,
  error,
}: {
  onCreate: (input: SiteCreateInput) => void
  isCreating: boolean
  error: string | null
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<SiteCreateInput>(EMPTY)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-700 text-neutral-500 hover:border-accent hover:text-accent-strong"
      >
        <Plus size={20} />
        <span className="text-sm font-semibold">Add site</span>
      </button>
    )
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    onCreate(form)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 rounded-xl border border-accent bg-neutral-900 p-4">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Code" value={form.code} onChange={(v) => setForm((f) => ({ ...f, code: v.toUpperCase() }))} required />
        <Field
          label="Cluster prefix"
          value={form.cluster_prefix}
          onChange={(v) => setForm((f) => ({ ...f, cluster_prefix: v.toLowerCase() }))}
          required
        />
      </div>
      <Field label="Display name" value={form.display_name} onChange={(v) => setForm((f) => ({ ...f, display_name: v }))} required />
      <Field label="Country" value={form.country} onChange={(v) => setForm((f) => ({ ...f, country: v }))} required />
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Latitude"
          type="number"
          value={String(form.latitude)}
          onChange={(v) => setForm((f) => ({ ...f, latitude: Number(v) }))}
        />
        <Field
          label="Longitude"
          type="number"
          value={String(form.longitude)}
          onChange={(v) => setForm((f) => ({ ...f, longitude: Number(v) }))}
        />
      </div>

      {error && <p className="text-[11.5px] text-crit">{error}</p>}

      <div className="mt-1 flex gap-2">
        <button
          type="submit"
          disabled={isCreating}
          className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-neutral-950 disabled:opacity-50"
        >
          <Check size={14} /> {isCreating ? 'Creating…' : 'Create site'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setForm(EMPTY)
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-300"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold tracking-wide text-neutral-500 uppercase">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 focus:border-accent"
      />
    </label>
  )
}
