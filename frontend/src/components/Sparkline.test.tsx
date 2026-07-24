import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sparkline } from './Sparkline'

describe('Sparkline', () => {
  it('shows a placeholder message when there is no history', () => {
    render(<Sparkline series={[]} tier="unknown" />)
    expect(screen.getByText('no history this window')).toBeInTheDocument()
  })

  it('renders an svg path when history is present', () => {
    const { container } = render(<Sparkline series={[98, 99, 99.5]} tier="good" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.querySelectorAll('path')).toHaveLength(2) // area fill + line
  })
})
