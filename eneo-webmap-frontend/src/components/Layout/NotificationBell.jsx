/**
 * NotificationBell
 * ================
 * Cloche de notifications dans la Navbar.
 *
 * - Badge rouge avec le nombre d'événements non lus.
 * - Dropdown listant les 50 derniers événements.
 * - Clic sur une notification → navigation vers le panneau incidents ou interventions.
 * - Les types gérés : incident_nouveau | incident_modifie | intervention_nouvelle
 */

import { useState } from 'react'
import { Bell, X, AlertTriangle, RefreshCw, Wrench } from 'lucide-react'
import { useNotificationStore } from '../../store/notificationStore'
import { useMapStore } from '../../store/mapStore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Config par type d'événement ───────────────────────────────
const EVENT_CFG = {
  incident_nouveau:      { Icon: AlertTriangle, color: '#FF4757', label: 'Nouvel incident'       },
  incident_modifie:      { Icon: RefreshCw,     color: '#f59e0b', label: 'Incident modifié'      },
  intervention_nouvelle: { Icon: Wrench,        color: '#00AADD', label: 'Nouvelle intervention' },
}

// ── Formatage date relative ───────────────────────────────────
function formatDate(iso) {
  try {
    return format(new Date(iso), "dd MMM 'à' HH:mm", { locale: fr })
  } catch {
    return ''
  }
}

// ── Badge priorité critique ───────────────────────────────────
function CritiqueBadge() {
  return (
    <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded"
          style={{ background: 'rgba(255,71,87,0.2)', color: '#FF4757' }}>
      CRITIQUE
    </span>
  )
}

// ── Item notification ─────────────────────────────────────────
function NotifItem({ notif, onClick }) {
  const cfg  = EVENT_CFG[notif.type] || EVENT_CFG.incident_nouveau
  const Icon = cfg.Icon
  const titre = notif.titre || notif.incident_titre || '—'

  return (
    <button
      onClick={() => onClick(notif)}
      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Icône */}
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
           style={{ background: `${cfg.color}20` }}>
        <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
      </div>

      {/* Contenu */}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {titre}
        </p>
        <p className="text-[10px] mt-0.5 flex items-center flex-wrap gap-1" style={{ color: cfg.color }}>
          {cfg.label}
          {notif.priorite === 'critique' && <CritiqueBadge />}
        </p>
        <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {formatDate(notif.date)}
        </p>
      </div>
    </button>
  )
}

// ── Composant principal ───────────────────────────────────────
export default function NotificationBell() {
  const [open, setOpen] = useState(false)

  const notifications = useNotificationStore(s => s.notifications)
  const unreadCount   = useNotificationStore(s => s.unreadCount)
  const markAllRead   = useNotificationStore(s => s.markAllRead)
  const clearAll      = useNotificationStore(s => s.clearAll)

  const setSidebarPanel = useMapStore(s => s.setSidebarPanel)

  const handleToggle = () => {
    setOpen(v => !v)
    // Marquer comme lus dès l'ouverture
    if (!open) markAllRead()
  }

  const handleClickNotif = (notif) => {
    setSidebarPanel(
      notif.type === 'intervention_nouvelle' ? 'interventions' : 'incidents'
    )
    setOpen(false)
  }

  return (
    <div className="relative">

      {/* ── Bouton cloche ── */}
      <button
        onClick={handleToggle}
        title="Notifications"
        className="relative p-2 rounded-lg transition-colors"
        style={{
          color:      open ? '#00AADD' : 'rgba(255,255,255,0.5)',
          background: open ? 'rgba(0,170,221,0.1)' : 'transparent',
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.color      = 'rgba(255,255,255,0.9)'
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.color      = 'rgba(255,255,255,0.5)'
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        <Bell className="w-4 h-4" />

        {/* Badge non-lus */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4
                       flex items-center justify-center text-[9px] font-bold
                       rounded-full px-1 pointer-events-none"
            style={{ background: '#FF4757', color: '#fff' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <>
          {/* Overlay transparent pour fermer en cliquant ailleurs */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div
            className="absolute right-0 top-full mt-2 w-80 rounded-xl overflow-hidden z-50 shadow-2xl"
            style={{ background: '#0F1E2E', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {/* En-tête */}
            <div className="flex items-center justify-between px-4 py-3"
                 style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" style={{ color: '#00AADD' }} />
                <span className="text-sm font-semibold text-white">Notifications</span>
                {notifications.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)' }}>
                    {notifications.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-[10px] px-2 py-1 rounded transition-colors"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
                  >
                    Effacer
                  </button>
                )}
                <button onClick={() => setOpen(false)} style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Liste */}
            <div
              className="max-h-[360px] overflow-y-auto"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
            >
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Bell className="w-8 h-8" style={{ color: 'rgba(255,255,255,0.08)' }} />
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Aucune notification récente
                  </p>
                </div>
              ) : (
                notifications.map((notif, i) => (
                  <NotifItem key={i} notif={notif} onClick={handleClickNotif} />
                ))
              )}
            </div>

            {/* Pied de page */}
            <div
              className="px-4 py-2 flex items-center justify-center"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}
            >
              <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Actualisation automatique toutes les 30 s
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
