/**
 * usePermissions.test.js
 * ======================
 * Tests unitaires du hook usePermissions.
 *
 * Couverture :
 *   Cas sans session (user=null, token=null)
 *     ✓ role = 'lecteur'
 *     ✓ loading = false
 *     ✓ isLecteur = true, isAdmin = false, isOperateur = false
 *     ✓ canWrite = false, canDelete = false, canExport = true
 *
 *   Cas chargement (user=null, token présent)
 *     ✓ loading = true
 *     ✓ role = 'operateur' (fallback pendant le chargement)
 *     ✓ isLecteur = false (bloqué par loading)
 *     ✓ canWrite = true (on ne bloque pas l'UI pendant le chargement)
 *     ✓ canDelete = false
 *
 *   Cas user admin
 *     ✓ role = 'admin'
 *     ✓ isAdmin = true, isOperateur = false, isLecteur = false
 *     ✓ canWrite = true, canDelete = true, canExport = true
 *     ✓ loading = false
 *
 *   Cas user opérateur
 *     ✓ role = 'operateur'
 *     ✓ isOperateur = true, isAdmin = false, isLecteur = false
 *     ✓ canWrite = true, canDelete = false, canExport = true
 *
 *   Cas user lecteur
 *     ✓ role = 'lecteur'
 *     ✓ isLecteur = true, isAdmin = false, isOperateur = false
 *     ✓ canWrite = false, canDelete = false, canExport = true
 *
 *   canExport
 *     ✓ toujours true quel que soit le rôle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePermissions } from '../hooks/usePermissions'

// ── Mock de useAuthStore ──────────────────────────────────────────

const mockAuthState = {
  user:  null,
  token: null,
}

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector) => selector(mockAuthState),
}))


// ── Helper ───────────────────────────────────────────────────────

function getPerms(user, token) {
  mockAuthState.user  = user
  mockAuthState.token = token
  const { result } = renderHook(() => usePermissions())
  return result.current
}


// ── Tests ─────────────────────────────────────────────────────────

describe('usePermissions — sans session (user=null, token=null)', () => {

  beforeEach(() => {
    mockAuthState.user  = null
    mockAuthState.token = null
  })

  it('role est "lecteur"', () => {
    const p = getPerms(null, null)
    expect(p.role).toBe('lecteur')
  })

  it('loading est false', () => {
    const p = getPerms(null, null)
    expect(p.loading).toBe(false)
  })

  it('isLecteur=true, isAdmin=false, isOperateur=false', () => {
    const p = getPerms(null, null)
    expect(p.isLecteur).toBe(true)
    expect(p.isAdmin).toBe(false)
    expect(p.isOperateur).toBe(false)
  })

  it('canWrite=false, canDelete=false', () => {
    const p = getPerms(null, null)
    expect(p.canWrite).toBe(false)
    expect(p.canDelete).toBe(false)
  })

  it('canExport=true', () => {
    const p = getPerms(null, null)
    expect(p.canExport).toBe(true)
  })
})


describe('usePermissions — chargement (user=null, token présent)', () => {

  it('loading est true', () => {
    const p = getPerms(null, 'jwt-token-abc')
    expect(p.loading).toBe(true)
  })

  it('role est "operateur" (fallback pendant chargement)', () => {
    const p = getPerms(null, 'jwt-token-abc')
    expect(p.role).toBe('operateur')
  })

  it('isLecteur=false pendant le chargement', () => {
    const p = getPerms(null, 'jwt-token-abc')
    expect(p.isLecteur).toBe(false)
  })

  it('canWrite=true (UI non bloquée pendant chargement)', () => {
    const p = getPerms(null, 'jwt-token-abc')
    expect(p.canWrite).toBe(true)
  })

  it('canDelete=false pendant le chargement', () => {
    const p = getPerms(null, 'jwt-token-abc')
    expect(p.canDelete).toBe(false)
  })

  it('isAdmin=false, isOperateur=true pendant le chargement', () => {
    const p = getPerms(null, 'jwt-token-abc')
    expect(p.isAdmin).toBe(false)
    expect(p.isOperateur).toBe(true)
  })
})


describe('usePermissions — user admin', () => {

  const adminUser = { id: 1, username: 'admin', role: 'admin' }

  it('role est "admin"', () => {
    const p = getPerms(adminUser, 'token')
    expect(p.role).toBe('admin')
  })

  it('isAdmin=true, isOperateur=false, isLecteur=false', () => {
    const p = getPerms(adminUser, 'token')
    expect(p.isAdmin).toBe(true)
    expect(p.isOperateur).toBe(false)
    expect(p.isLecteur).toBe(false)
  })

  it('canWrite=true, canDelete=true, canExport=true', () => {
    const p = getPerms(adminUser, 'token')
    expect(p.canWrite).toBe(true)
    expect(p.canDelete).toBe(true)
    expect(p.canExport).toBe(true)
  })

  it('loading=false quand user est défini', () => {
    const p = getPerms(adminUser, 'token')
    expect(p.loading).toBe(false)
  })
})


describe('usePermissions — user opérateur', () => {

  const opUser = { id: 2, username: 'operateur1', role: 'operateur' }

  it('role est "operateur"', () => {
    const p = getPerms(opUser, 'token')
    expect(p.role).toBe('operateur')
  })

  it('isOperateur=true, isAdmin=false, isLecteur=false', () => {
    const p = getPerms(opUser, 'token')
    expect(p.isOperateur).toBe(true)
    expect(p.isAdmin).toBe(false)
    expect(p.isLecteur).toBe(false)
  })

  it('canWrite=true, canDelete=false', () => {
    const p = getPerms(opUser, 'token')
    expect(p.canWrite).toBe(true)
    expect(p.canDelete).toBe(false)
  })

  it('canExport=true', () => {
    const p = getPerms(opUser, 'token')
    expect(p.canExport).toBe(true)
  })

  it('loading=false', () => {
    const p = getPerms(opUser, 'token')
    expect(p.loading).toBe(false)
  })
})


describe('usePermissions — user lecteur', () => {

  const lecteurUser = { id: 3, username: 'lecteur1', role: 'lecteur' }

  it('role est "lecteur"', () => {
    const p = getPerms(lecteurUser, 'token')
    expect(p.role).toBe('lecteur')
  })

  it('isLecteur=true, isAdmin=false, isOperateur=false', () => {
    const p = getPerms(lecteurUser, 'token')
    expect(p.isLecteur).toBe(true)
    expect(p.isAdmin).toBe(false)
    expect(p.isOperateur).toBe(false)
  })

  it('canWrite=false, canDelete=false', () => {
    const p = getPerms(lecteurUser, 'token')
    expect(p.canWrite).toBe(false)
    expect(p.canDelete).toBe(false)
  })

  it('canExport=true', () => {
    const p = getPerms(lecteurUser, 'token')
    expect(p.canExport).toBe(true)
  })
})


describe('usePermissions — canExport toujours true', () => {

  it('canExport=true pour lecteur sans session', () => {
    expect(getPerms(null, null).canExport).toBe(true)
  })

  it('canExport=true pendant le chargement', () => {
    expect(getPerms(null, 'token').canExport).toBe(true)
  })

  it('canExport=true pour admin', () => {
    expect(getPerms({ role: 'admin' }, 'token').canExport).toBe(true)
  })

  it('canExport=true pour operateur', () => {
    expect(getPerms({ role: 'operateur' }, 'token').canExport).toBe(true)
  })

  it('canExport=true pour lecteur authentifié', () => {
    expect(getPerms({ role: 'lecteur' }, 'token').canExport).toBe(true)
  })
})
