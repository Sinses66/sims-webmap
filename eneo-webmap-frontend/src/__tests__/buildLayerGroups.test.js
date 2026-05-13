/**
 * buildLayerGroups.test.js
 * ========================
 * Tests de la fonction pure buildLayerGroups() définie dans useGeoData.js.
 * Aucun rendu React n'est nécessaire — tests unitaires purs.
 *
 * Couverture :
 *   ✓ Tableau vide → tableau vide
 *   ✓ Couche unique → un groupe, une couche
 *   ✓ Alias 'group' (group_slug) correctement mappé vers id de groupe
 *   ✓ Alias 'visible' (visible_default) correctement mappé
 *   ✓ Alias 'opacity' (opacity_default) correctement mappé
 *   ✓ Fallback group_slug → 'default' si absent
 *   ✓ Fallback layer_key → String(id) si absent
 *   ✓ Plusieurs couches groupées dans le même groupe
 *   ✓ Groupes triés par group_order
 *   ✓ Fallback visible_default si visible absent
 *   ✓ Fallback opacity_default si opacity absent
 *   ✓ popupFields correctement mappé depuis popup_fields
 */

import { describe, it, expect } from 'vitest'
import { buildLayerGroups } from '../hooks/useGeoData'


// ── Helpers ───────────────────────────────────────────────────────

function makeApiLayer(overrides = {}) {
  return {
    id:             1,
    layer_key:      'cmr_reseau_htb',
    name:           'Réseau HTB',
    geoserver_layer: 'eneo_gis_ws:cmrReseauHTB',
    layer_type:     'WMS',
    group:          'htb_existant',       // alias ← group_slug
    group_slug:     'htb_existant',
    group_label:    'Réseau HTB Existant',
    group_icon:     '⚡',
    group_order:    1,
    visible:        true,                 // alias ← visible_default
    visible_default: true,
    opacity:        0.8,                  // alias ← opacity_default
    opacity_default: 0.8,
    color:          '#FF6B35',
    description:    'Lignes HTB existantes',
    popup_fields:   ['nom', 'tension'],
    ...overrides,
  }
}


// ── Tests ─────────────────────────────────────────────────────────

describe('buildLayerGroups()', () => {

  it('retourne un tableau vide pour une entrée vide', () => {
    expect(buildLayerGroups([])).toEqual([])
  })

  it('crée un groupe pour une couche unique', () => {
    const groups = buildLayerGroups([makeApiLayer()])
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe('htb_existant')
    expect(groups[0].layers).toHaveLength(1)
  })

  it("utilise 'group' (alias group_slug) comme identifiant de groupe", () => {
    const layer = makeApiLayer({ group: 'postes_sources', group_slug: 'postes_sources' })
    const groups = buildLayerGroups([layer])
    expect(groups[0].id).toBe('postes_sources')
  })

  it("utilise group_slug en fallback si 'group' absent", () => {
    const layer = makeApiLayer({ group: undefined, group_slug: 'fallback_slug' })
    const groups = buildLayerGroups([layer])
    expect(groups[0].id).toBe('fallback_slug')
  })

  it("utilise 'default' comme id si group et group_slug absents", () => {
    const layer = makeApiLayer({ group: undefined, group_slug: undefined })
    const groups = buildLayerGroups([layer])
    expect(groups[0].id).toBe('default')
  })

  it('mappe correctement le label du groupe', () => {
    const groups = buildLayerGroups([makeApiLayer()])
    expect(groups[0].label).toBe('Réseau HTB Existant')
  })

  it("utilise group_name comme fallback pour le label si group_label absent", () => {
    const layer = makeApiLayer({ group_label: undefined, group_name: 'Legacy Group' })
    const groups = buildLayerGroups([layer])
    expect(groups[0].label).toBe('Legacy Group')
  })

  it('mappe correctement visible depuis alias visible', () => {
    const layer = makeApiLayer({ visible: false })
    const groups = buildLayerGroups([layer])
    expect(groups[0].layers[0].visible).toBe(false)
  })

  it('mappe correctement visible depuis visible_default si visible absent', () => {
    const layer = makeApiLayer({ visible: undefined, visible_default: false })
    const groups = buildLayerGroups([layer])
    expect(groups[0].layers[0].visible).toBe(false)
  })

  it('visible vaut true par défaut si les deux sont absents', () => {
    const layer = makeApiLayer({ visible: undefined, visible_default: undefined })
    const groups = buildLayerGroups([layer])
    expect(groups[0].layers[0].visible).toBe(true)
  })

  it('mappe correctement opacity depuis alias opacity', () => {
    const layer = makeApiLayer({ opacity: 0.5 })
    const groups = buildLayerGroups([layer])
    expect(groups[0].layers[0].opacity).toBe(0.5)
  })

  it('mappe correctement opacity depuis opacity_default si opacity absent', () => {
    const layer = makeApiLayer({ opacity: undefined, opacity_default: 0.3 })
    const groups = buildLayerGroups([layer])
    expect(groups[0].layers[0].opacity).toBe(0.3)
  })

  it('opacity vaut 1 par défaut si les deux sont absents', () => {
    const layer = makeApiLayer({ opacity: undefined, opacity_default: undefined })
    const groups = buildLayerGroups([layer])
    expect(groups[0].layers[0].opacity).toBe(1)
  })

  it('utilise layer_key comme id de couche', () => {
    const layer = makeApiLayer({ layer_key: 'ma_cle_stable' })
    const groups = buildLayerGroups([layer])
    expect(groups[0].layers[0].id).toBe('ma_cle_stable')
  })

  it("utilise String(id) comme fallback si layer_key absent", () => {
    const layer = makeApiLayer({ id: 42, layer_key: undefined })
    const groups = buildLayerGroups([layer])
    expect(groups[0].layers[0].id).toBe('42')
  })

  it('mappe popup_fields vers popupFields', () => {
    const layer = makeApiLayer({ popup_fields: ['nom', 'tension', 'region'] })
    const groups = buildLayerGroups([layer])
    expect(groups[0].layers[0].popupFields).toEqual(['nom', 'tension', 'region'])
  })

  it('popupFields est [] si popup_fields absent', () => {
    const layer = makeApiLayer({ popup_fields: undefined })
    const groups = buildLayerGroups([layer])
    expect(groups[0].layers[0].popupFields).toEqual([])
  })

  it('regroupe plusieurs couches dans le même groupe', () => {
    const layers = [
      makeApiLayer({ id: 1, layer_key: 'htb_1', group: 'htb', group_slug: 'htb', name: 'HTB 1' }),
      makeApiLayer({ id: 2, layer_key: 'htb_2', group: 'htb', group_slug: 'htb', name: 'HTB 2' }),
    ]
    const groups = buildLayerGroups(layers)
    expect(groups).toHaveLength(1)
    expect(groups[0].layers).toHaveLength(2)
  })

  it('crée deux groupes pour des couches de groupes différents', () => {
    const layers = [
      makeApiLayer({ id: 1, layer_key: 'htb_1', group: 'htb',    group_slug: 'htb',    group_order: 1 }),
      makeApiLayer({ id: 2, layer_key: 'bt_1',  group: 'bt',     group_slug: 'bt',     group_order: 2 }),
    ]
    const groups = buildLayerGroups(layers)
    expect(groups).toHaveLength(2)
    expect(groups.map(g => g.id)).toEqual(['htb', 'bt'])
  })

  it('trie les groupes par group_order croissant', () => {
    const layers = [
      makeApiLayer({ id: 1, layer_key: 'g3', group: 'g3', group_slug: 'g3', group_order: 30 }),
      makeApiLayer({ id: 2, layer_key: 'g1', group: 'g1', group_slug: 'g1', group_order: 10 }),
      makeApiLayer({ id: 3, layer_key: 'g2', group: 'g2', group_slug: 'g2', group_order: 20 }),
    ]
    const groups = buildLayerGroups(layers)
    expect(groups.map(g => g.id)).toEqual(['g1', 'g2', 'g3'])
  })

  it("utilise group_order=99 si absent", () => {
    const layer = makeApiLayer({ group_order: undefined })
    const groups = buildLayerGroups([layer])
    expect(groups[0].order).toBe(99)
  })

  it('préserve le type de couche WMS ou WFS', () => {
    const wfs = makeApiLayer({ layer_type: 'WFS', layer_key: 'wfs_test' })
    const groups = buildLayerGroups([wfs])
    expect(groups[0].layers[0].type).toBe('WFS')
  })

  it('couleur par défaut si color absent', () => {
    const layer = makeApiLayer({ color: undefined })
    const groups = buildLayerGroups([layer])
    expect(groups[0].layers[0].color).toBe('#6366f1')
  })
})
