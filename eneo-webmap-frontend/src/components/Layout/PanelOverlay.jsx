/**
 * PanelOverlay.jsx
 * ================
 * Panneau slide-in qui s'affiche par-dessus la carte.
 *
 * - S'ouvre depuis la droite en slide horizontal
 * - Prend 60% de la largeur sur desktop, 100% sur mobile
 * - Fond semi-transparent derrière (cliquable pour fermer)
 * - Contenu : IncidentsPage ou InterventionsPage selon activePanel
 */

import { useUiStore } from '../../store/uiStore'
import IncidentsPage      from '../../pages/IncidentsPage'
import InterventionsPage  from '../../pages/InterventionsPage'

export default function PanelOverlay() {
  const activePanel = useUiStore(s => s.activePanel)
  const closePanel  = useUiStore(s => s.closePanel)

  if (!activePanel) return null

  return (
    <>
      {/* ── Backdrop semi-transparent ── */}
      <div
        className="absolute inset-0 z-30"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={closePanel}
      />

      {/* ── Panneau slide-in ── */}
      <div
        className="absolute top-0 right-0 h-full z-40 flex flex-col
                   w-full sm:w-[65%] lg:w-[55%] xl:w-[50%]
                   animate-slide-in-right"
        style={{
          background:  '#0F1E2E',
          borderLeft:  '1px solid rgba(255,255,255,0.07)',
          boxShadow:   '-8px 0 32px rgba(0,0,0,0.5)',
        }}
      >
        {activePanel === 'incidents'     && <IncidentsPage     />}
        {activePanel === 'interventions' && <InterventionsPage />}
      </div>
    </>
  )
}
