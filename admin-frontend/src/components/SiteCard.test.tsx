import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SiteCard } from './SiteCard'
import type { Site } from '../lib/types'

vi.mock('../lib/api', () => ({
  fetchSiteCategories: vi.fn().mockResolvedValue([]),
  replaceSiteCategories: vi.fn().mockResolvedValue([]),
}))

const site: Site = {
  code: 'AAA',
  display_name: 'Test City',
  country: 'Test Country',
  latitude: 1.5,
  longitude: 2.5,
  cluster_prefix: 'aaa',
  enabled: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('SiteCard', () => {
  it('shows the site info in view mode', () => {
    renderWithClient(<SiteCard site={site} onUpdate={vi.fn()} onDelete={vi.fn()} isUpdating={false} isDeleting={false} />)

    expect(screen.getByText('Test City')).toBeInTheDocument()
    expect(screen.getByText('AAA')).toBeInTheDocument()
    expect(screen.getByText('Enabled')).toBeInTheDocument()
  })

  it('toggling the enabled checkbox calls onUpdate immediately', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    renderWithClient(<SiteCard site={site} onUpdate={onUpdate} onDelete={vi.fn()} isUpdating={false} isDeleting={false} />)

    await user.click(screen.getByRole('checkbox'))

    expect(onUpdate).toHaveBeenCalledWith('AAA', { enabled: false })
  })

  it('entering edit mode and saving calls onUpdate with the edited fields', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    renderWithClient(<SiteCard site={site} onUpdate={onUpdate} onDelete={vi.fn()} isUpdating={false} isDeleting={false} />)

    await user.click(screen.getByRole('button', { name: /edit/i }))
    const nameInput = screen.getByDisplayValue('Test City')
    await user.clear(nameInput)
    await user.type(nameInput, 'Renamed City')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(onUpdate).toHaveBeenCalledWith('AAA', expect.objectContaining({ display_name: 'Renamed City' }))
  })

  it('delete requires confirmation before calling onDelete', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    renderWithClient(<SiteCard site={site} onUpdate={vi.fn()} onDelete={onDelete} isUpdating={false} isDeleting={false} />)

    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByText(/removes it from the global dashboard/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /confirm delete/i }))
    expect(onDelete).toHaveBeenCalledWith('AAA')
  })
})
