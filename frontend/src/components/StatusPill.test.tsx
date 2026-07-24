import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusPill } from './StatusPill'

describe('StatusPill', () => {
  it('renders the label for a good tier', () => {
    render(<StatusPill tier="good" />)
    expect(screen.getByText('Normal')).toBeInTheDocument()
  })

  it('renders the label for a crit tier', () => {
    render(<StatusPill tier="crit" />)
    expect(screen.getByText('Abnormal · impact')).toBeInTheDocument()
  })

  it('renders the label for an unknown tier', () => {
    render(<StatusPill tier="unknown" />)
    expect(screen.getByText('No data')).toBeInTheDocument()
  })
})
