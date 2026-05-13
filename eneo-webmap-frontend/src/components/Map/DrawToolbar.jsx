import { useState } from 'react'
import { FeatureGroup } from 'react-leaflet'
import { EditControl } from 'react-leaflet-draw'
import { Ruler, Square, Trash2 } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import * as turf from '@turf/turf'
import toast from 'react-hot-toast'

/**
 * Barre d'outils dessin et mesure (distance / aire).
 * Affiché en overlay sur la carte (position absolue).
 */
export default function DrawToolbar() {
  const { drawMode, setDrawMode } = useMapStore()
  const [drawnLayer, setDrawnLayer] = useState(null)

  const handleCreated = (e) => {
    const layer = e.layer
    const geojson = layer.toGeoJSON()

    if (geojson.geometry.type === 'LineString' || geojson.geometry.type === 'Polyline') {
      const distance = turf.length(geojson, { units: 'kilometers' })
      toast(`📏 Distance : ${distance.toFixed(3)} km`, { duration: 6000 })
    } else if (geojson.geometry.type === 'Polygon') {
      const area = turf.area(geojson)
      const ha   = (area / 10000).toFixed(2)
      toast(`📐 Superficie : ${ha} ha (${(area / 1e6).toFixed(4)} km²)`, { duration: 6000 })
    }

    setDrawnLayer(layer)
    setDrawMode(null)
  }

  const handleDeleted = () => {
    setDrawnLayer(null)
    setDrawMode(null)
  }

  return (
    <>
      {/* Boutons flottants */}
      <div
        className="absolute top-4 right-4 z-[1000] flex flex-col gap-2"
        style={{ pointerEvents: 'auto' }}
      >
        <button
          title="Mesurer une distance"
          onClick={() => setDrawMode(drawMode === 'measure_distance' ? null : 'measure_distance')}
          className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-lg transition-colors
            ${drawMode === 'measure_distance'
              ? 'bg-eneo-500 text-brand-dark'
              : 'bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          <Ruler className="w-5 h-5" />
        </button>

        <button
          title="Mesurer une surface"
          onClick={() => setDrawMode(drawMode === 'measure_area' ? null : 'measure_area')}
          className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-lg transition-colors
            ${drawMode === 'measure_area'
              ? 'bg-eneo-500 text-brand-dark'
              : 'bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          <Square className="w-5 h-5" />
        </button>

        {drawnLayer && (
          <button
            title="Effacer la mesure"
            onClick={() => { setDrawnLayer(null); setDrawMode(null) }}
            className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg
                       bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Plugin leaflet-draw (caché sauf si mode actif) */}
      {drawMode && (
        <FeatureGroup>
          <EditControl
            position="topright"
            onCreated={handleCreated}
            onDeleted={handleDeleted}
            draw={{
              polyline: drawMode === 'measure_distance' ? { shapeOptions: { color: '#ffc107', weight: 3 } } : false,
              polygon:  drawMode === 'measure_area'     ? { shapeOptions: { color: '#ffc107', weight: 2, fillOpacity: 0.2 } } : false,
              rectangle:  false,
              circle:     false,
              circlemarker: false,
              marker:     false,
            }}
            edit={{ edit: false }}
          />
        </FeatureGroup>
      )}
    </>
  )
}
