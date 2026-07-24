import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiRow } from './KpiRow'
import type { SiteStatus } from '../lib/types'

function site(overrides: Partial<SiteStatus>): SiteStatus {
  return {
    code: 'AAA',
    display_name: 'Test City',
    country: 'Test Country',
    latitude: 0,
    longitude: 0,
    target_pct: 99,
    history: [],
    current_pct: null,
    tier: 'unknown',
    cluster_count: 0,
    ...overrides,
  }
}

describe('KpiRow', () => {
  it('counts sites meeting target and breaching SLO', () => {
    const sites = [
      site({ code: 'AAA', current_pct: 99.8, tier: 'good' }),
      site({ code: 'BBB', display_name: 'Low City', current_pct: 54.3, tier: 'crit' }),
      site({ code: 'CCC', current_pct: null, tier: 'unknown' }),
      site({ code: 'DDD', current_pct: 99.5, tier: 'good' }),
    ]

    render(<KpiRow sites={sites} />)

    expect(screen.getByText('4')).toBeInTheDocument() // sites monitored
    expect(screen.getByText('2 / 4')).toBeInTheDocument() // meeting target
    expect(screen.getByText('1 / 4')).toBeInTheDocument() // breaching SLO
  })

  it('shows a dash when clusterCount is not supplied', () => {
    render(<KpiRow sites={[site({ code: 'AAA' })]} />)
    expect(screen.getByText('—')).toBeInTheDocument() // clusters monitored
  })
})
