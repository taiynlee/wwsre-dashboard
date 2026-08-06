import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { applyTheme, getStoredTheme, type Theme } from '../lib/theme'

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads localStorage once on mount rather than always
  // starting from "dark" and correcting in an effect — that would still
  // flash dark for a frame even with index.html's inline script having
  // already set the DOM attribute correctly.
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
