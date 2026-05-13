import { create } from 'zustand'

const TOKEN_KEY   = 'sims_token'
const REFRESH_KEY = 'sims_refresh'

export const useAuthStore = create((set) => ({
  user:            null,
  token:           localStorage.getItem(TOKEN_KEY)   || null,
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),

  // login reçoit maintenant access + refresh
  login: (user, access, refresh = null) => {
    localStorage.setItem(TOKEN_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
    set({ user, token: access, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    set({ user: null, token: null, isAuthenticated: false })
  },

  setUser: (user) => set({ user }),
}))

export { TOKEN_KEY, REFRESH_KEY }
