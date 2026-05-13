/**
 * setup.js — Configuration globale Vitest / Testing Library
 * ==========================================================
 * Exécuté avant chaque fichier de test via vite.config.js → test.setupFiles
 */

import '@testing-library/jest-dom'

// ── Mocks globaux des API navigateur absentes dans jsdom ─────────

// URL.createObjectURL (utilisé par exportCSV dans IncidentPanelMini)
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// ResizeObserver (utilisé par certains composants Leaflet/Chart)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe:   vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// ── Suppression des warnings React attendus en tests ─────────────
// (ex: act() warnings sur les mutations async)
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: An update to') ||
       args[0].includes('Warning: ReactDOM.render'))
    ) return
    originalError(...args)
  }
})
afterAll(() => {
  console.error = originalError
})
