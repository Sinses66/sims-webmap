import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Loader2, Eye, EyeOff, MapPin, ArrowLeft } from 'lucide-react'
import { authAPI } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

export default function LoginForm() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { login } = useAuthStore()

  // Redirection post-login :
  //   - Si l'utilisateur venait d'une URL protégée → on l'y renvoie
  //   - Sinon → page d'accueil (PlatformHome) pour choisir son application
  const from = location.state?.from || '/'

  const [form, setForm]       = useState({ username: '', password: '' })
  const [remember, setRemember] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleChange = (e) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // 1. Obtenir le token JWT
      const { data } = await authAPI.login(form)

      // 2. Stocker access + refresh AVANT d'appeler me()
      localStorage.setItem('sims_token',   data.access)
      localStorage.setItem('sims_refresh', data.refresh)

      // 3. Récupérer le profil complet
      let user = { username: form.username, role: 'operateur' }
      try {
        const { data: profile } = await authAPI.me()
        user = profile
      } catch {
        // me/ indisponible — continuer avec profil minimal
      }

      // 4. Mettre à jour le store (access + refresh)
      login(user, data.access, data.refresh)
      toast.success(`Bienvenue${user.first_name ? ', ' + user.first_name : ''} !`, {
        style: { background: '#132337', color: '#E2E8F0', border: '1px solid rgba(0,170,221,0.2)' },
      })

      // 5. Redirection
      navigate(from, { replace: true })

    } catch (err) {
      localStorage.removeItem('sims_token')
      const msg = err.response?.data?.detail || 'Identifiants invalides'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
         style={{ background: 'linear-gradient(160deg, #070e17 0%, #0D1B2A 45%, #0f1e30 100%)' }}>

      {/* Grille de fond décorative */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: [
          'linear-gradient(rgba(0,170,221,0.04) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(0,170,221,0.04) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: '48px 48px',
      }} />

      {/* Glow arrière */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96
                      rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(0,170,221,0.06) 0%, transparent 65%)' }} />

      {/* Bouton retour */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 flex items-center gap-2 text-white/30 hover:text-white/60
                   text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        SIMS Online
      </button>

      <div className="relative w-full max-w-sm animate-fade-in">

        {/* Logo + identité */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <img
              src="/logo_sims.png"
              alt="SIMS"
              className="w-full h-full object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'flex'
              }}
            />
            <div className="w-16 h-16 rounded-2xl border border-cyan-500/30 bg-cyan-500/10
                            hidden items-center justify-center"
                 style={{ boxShadow: '0 0 30px rgba(0,170,221,0.15)' }}>
              <MapPin className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">SIMS Online</h1>
          <p className="text-white/35 text-sm mt-1">Connexion sécurisée</p>
          {from !== '/' && (
            <p className="text-cyan-500/60 text-xs mt-2">
              Connectez-vous pour accéder à l'application
            </p>
          )}
        </div>

        {/* Carte formulaire */}
        <div className="rounded-2xl border border-cyan-500/12 p-8"
             style={{ background: '#132337', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>

          <h2 className="text-base font-semibold text-white mb-5">
            Plateforme de Gestion du réseau électrique
          </h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg border border-red-500/25 text-sm text-red-400"
                 style={{ background: 'rgba(239,68,68,0.08)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identifiant */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Identifiant / Login LDAP
              </label>
              <input
                name="username"
                type="text"
                value={form.username}
                onChange={handleChange}
                required
                autoComplete="username"
                autoFocus
                placeholder="votre.identifiant"
                className="input-dark"
              />
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="input-dark pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Se souvenir de moi */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div
                onClick={() => setRemember(v => !v)}
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  remember
                    ? 'bg-cyan-500 border-cyan-500'
                    : 'border-white/20 hover:border-white/40'
                }`}
              >
                {remember && (
                  <svg className="w-3 h-3 text-sims-900" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="text-white/40 text-xs group-hover:text-white/60 transition-colors select-none">
                Se souvenir de moi
              </span>
            </label>

            {/* Bouton connexion */}
            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-2.5 px-4 rounded-lg transition-all duration-200
                         flex items-center justify-center gap-2 disabled:opacity-50
                         disabled:cursor-not-allowed mt-2"
              style={{ background: '#00AADD', color: '#0D1B2A' }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = '#0095C4')}
              onMouseLeave={e => !loading && (e.currentTarget.style.background = '#00AADD')}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Connexion en cours…</>
                : 'Se connecter'
              }
            </button>
          </form>
        </div>

        <p className="text-center text-white/15 text-xs mt-6">
          © {new Date().getFullYear()} GeoEco Systems — SIMS Online
        </p>
      </div>
    </div>
  )
}
