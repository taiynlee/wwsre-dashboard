import { Moon, Sun } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-panel text-ink-soft transition hover:border-line-strong hover:text-ink"
    >
      {isLight ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  )
}
