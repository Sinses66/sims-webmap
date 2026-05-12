/**
 * uiStore.js
 * ==========
 * État global de l'interface utilisateur.
 *
 * activePanel : panneau actuellement ouvert par-dessus la carte
 *   - null            → carte seule (mode normal)
 *   - 'incidents'     → panneau incidents
 *   - 'interventions' → panneau interventions
 */

import { create } from 'zustand'

export const useUiStore = create((set, get) => ({
  activePanel: null,

  /** Ouvre un panneau. Si déjà ouvert → le ferme (toggle). */
  togglePanel: (panel) =>
    set({ activePanel: get().activePanel === panel ? null : panel }),

  /** Ferme le panneau sans condition. */
  closePanel: () => set({ activePanel: null }),
}))
