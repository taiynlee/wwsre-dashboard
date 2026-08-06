export type Theme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'wwsre-theme'

// Dark is the default for anyone who hasn't chosen — matches what the
// dashboard always looked like before theming existed, and index.html's
// inline script only ever sets data-theme="light" (never "dark"), so a
// missing attribute already means dark without this function needing to
// touch the DOM.
export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme): void {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // localStorage unavailable (e.g. private mode) — theme still applies
    // for this page load, just won't persist across visits.
  }
}
