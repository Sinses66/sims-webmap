import { Popup } from 'react-leaflet'
import { X, Zap, MapPin, AlertTriangle, ExternalLink } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useAppLayers, useTypeOuvrages } from '../../hooks/useGeoData'
import { useAppContext } from '../../context/AppContext'


// Champs techniques à toujours masquer
const HIDDEN_FIELDS = new Set(['geom', 'geometry', 'wkb_geometry', 'the_geom', 'shape'])

/**
 * Popup riche affichée lors du clic sur une entité de la carte.
 * Les attributs affichés sont filtrés selon popup_fields configuré
 * dans Django Admin pour chaque couche.
 *
 * Quand l'utilisateur clique "Incident", on pré-remplit le formulaire avec :
 *  - les coordonnées du clic
 *  - le code de l'ouvrage (champ champ_cle du TypeOuvrage correspondant)
 *  - le nom de l'ouvrage (champ champ_nom)
 *  - l'id du TypeOuvrage (pour pré-sélectionner le type dans le formulaire)
 */
export default function FeaturePopup() {
  const { appSlug } = useAppContext()
  const { selectedFeature, clearSelectedFeature, setSidebarPanel, setIncidentPrefill } = useMapStore()
  const { layerGroups } = useAppLayers(appSlug)
  const { data: typesOuvrage = [] } = useTypeOuvrages()

  if (!selectedFeature) return null

  const { properties, layerName, layerId, latlng } = selectedFeature

  // Récupérer la config de la couche
  const allLayers = layerGroups.flatMap(g => g.layers)
  const layerConfig = allLayers.find(l => l.id === layerId)
  const popupFields = layerConfig?.popupFields || []  // [] = tout afficher

  // Chercher si cette couche correspond à un TypeOuvrage connu
  // (comparaison sur layer_key, ex: 'postes_hta', 'transformateurs', etc.)
  const typeOuvrage = typesOuvrage.find(t => t.layer_key === layerId)

  const openDetail = () => {
    setSidebarPanel('layers')
  }

  const declareIncident = () => {
    // Construire le prefill : coordonnées + ouvrage si la couche est référencée
    const prefill = {
      latitude:  latlng?.lat ?? null,
      longitude: latlng?.lng ?? null,
      couche_id:  layerId   || '',
      couche_nom: layerName || '',
      feature_id: properties?.id ?? properties?.gid ?? '',
      localisation: '',
    }

    if (typeOuvrage && properties) {
      const champCle = typeOuvrage.champ_cle   // ex: 'code', 'id_poste'
      const champNom = typeOuvrage.champ_nom   // ex: 'nom', 'libelle'
      prefill.code_ouvrage    = champCle ? (properties[champCle] ?? '') : ''
      prefill.nom_ouvrage     = champNom ? (properties[champNom] ?? '') : ''
      prefill.type_ouvrage_id = typeOuvrage.id
    }

    setIncidentPrefill(prefill)
    setSidebarPanel('incidents')
    clearSelectedFeature()
  }

  return (
    <Popup
      position={latlng}
      eventHandlers={{ remove: clearSelectedFeature }}
      className="eneo-popup"
      maxWidth={340}
      closeButton={false}
    >
      <div className="bg-brand-dark text-white rounded-lg overflow-hidden min-w-[280px]">
        {/* En-tête */}
        <div className="flex items-center justify-between px-4 py-3 bg-eneo-500/20 border-b border-eneo-500/30">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-eneo-400" />
            <span className="font-semibold text-sm text-eneo-300">{layerName}</span>
          </div>
          <button
            onClick={clearSelectedFeature}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Attributs */}
        <div className="px-4 py-3 space-y-1.5 max-h-64 overflow-y-auto text-xs">
          {(popupFields.length > 0
            // popup_fields configurés → afficher uniquement ces champs dans l'ordre
            ? popupFields
                .filter(f => f in (properties || {}))
                .map(f => [f, properties[f]])
            // Pas de config → tous les attributs (sauf techniques)
            : Object.entries(properties || {})
                .filter(([k]) => !k.startsWith('_') && !HIDDEN_FIELDS.has(k))
                .slice(0, 15)
          ).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <span className="text-white/50 capitalize shrink-0">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="text-white font-medium text-right break-all">
                  {value !== null && value !== undefined ? String(value) : '—'}
                </span>
              </div>
            ))}
        </div>

        {/* Coordonnées */}
        <div className="px-4 py-2 bg-white/5 flex items-center gap-1.5 text-xs text-white/50">
          <MapPin className="w-3 h-3" />
          <span>
            {latlng.lat.toFixed(5)}, {latlng.lng.toFixed(5)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-3 border-t border-white/10">
          <button
            onClick={declareIncident}
            className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-700
                       text-white px-3 py-1.5 rounded transition-colors"
          >
            <AlertTriangle className="w-3 h-3" />
            Incident
          </button>
          <button
            onClick={openDetail}
            className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20
                       text-white px-3 py-1.5 rounded transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Détails
          </button>
        </div>
      </div>
    </Popup>
  )
}
