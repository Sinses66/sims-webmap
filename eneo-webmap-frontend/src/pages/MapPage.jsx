import MapView from '../components/Map/MapView'
import Sidebar from '../components/Sidebar/Sidebar'
import AttributeTable from '../components/Sidebar/AttributeTable'
import { useMapStore } from '../store/mapStore'

/**
 * Page principale — vue cartographique complète.
 * Structure :
 *   [ Sidebar | Carte ]
 *   [    AttributeTable (si feature sélectionnée)    ]
 */
export default function MapPage() {
  const { selectedFeature } = useMapStore()

  return (
    <div className="flex h-full overflow-hidden">
      {/* Panneau latéral */}
      <Sidebar />

      {/* Zone carte + tableau attributaire */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Carte — prend tout l'espace disponible */}
        <div className="flex-1 relative overflow-hidden">
          <MapView />
        </div>

        {/* Tableau attributaire (affiché quand une entité est sélectionnée) */}
        {selectedFeature && (
          <AttributeTable feature={selectedFeature} />
        )}
      </div>
    </div>
  )
}
