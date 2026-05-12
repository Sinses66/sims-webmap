"""
eneo_reseau/tests/test_permissions.py
======================================
Tests de la classe RoleBasedPermission et des ViewSets incidents/interventions.

Matrice testée :
                          | admin | superviseur | operateur | lecteur | anonyme
  ──────────────────────────────────────────────────────────────────────────────
  GET  /api/incidents/       200     200           200        200       401/403
  POST /api/incidents/       201     201           201        403       401/403
  PATCH /api/incidents/{id}/ 200     200           200        403       401/403
  DELETE /api/incidents/{id}/200     403           403        403       401/403

  GET  /api/interventions/   200     200           200        200       401/403
  POST /api/interventions/   201     201           201        403       401/403
  PATCH /api/interventions/{}/200    200           200        403       401/403
  DELETE /api/interventions/{}/200   403           403        403       401/403

  POST /api/incidents/{id}/assigner/   200  200  200  403  401/403
  POST /api/interventions/{id}/cloturer/ 200 200 200 403 401/403

  Unitaire RoleBasedPermission
    ✓ _get_role : superuser → admin
    ✓ _get_role : profil admin → admin
    ✓ _get_role : sans profil → lecteur
    ✓ SAFE_METHODS autorisés pour tous les rôles
    ✓ DELETE refusé pour superviseur, operateur, lecteur
    ✓ DELETE autorisé pour admin
    ✓ POST autorisé pour operateur+
    ✓ POST refusé pour lecteur
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework.views import APIView

from eneo_reseau.permissions import RoleBasedPermission, _get_role
from eneo_reseau.models import (
    Incident, IncidentStatut, Intervention, InterventionStatut, TypeIncident,
)
from sims_core.models import Organisation, UserProfile


# ─────────────────────────────────────────────────────────────────────────────
#  Fixtures
# ─────────────────────────────────────────────────────────────────────────────

def make_user_with_role(username, role, db):
    """Crée un utilisateur Django + profil avec le rôle donné."""
    user = User.objects.create_user(username=username, password='testpass')
    org  = Organisation.objects.get_or_create(name='TestOrg', slug='testorg')[0]
    UserProfile.objects.create(user=user, organisation=org, role=role)
    return user


def make_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def user_admin(db):
    return make_user_with_role('perm_admin', 'admin', db)

@pytest.fixture
def user_superviseur(db):
    return make_user_with_role('perm_superviseur', 'superviseur', db)

@pytest.fixture
def user_operateur(db):
    return make_user_with_role('perm_operateur', 'operateur', db)

@pytest.fixture
def user_lecteur(db):
    return make_user_with_role('perm_lecteur', 'lecteur', db)

@pytest.fixture
def user_sans_profil(db):
    return User.objects.create_user(username='perm_sans_profil', password='testpass')

@pytest.fixture
def incident(db, user_admin):
    ti = TypeIncident.objects.get_or_create(nom='Test type')[0]
    return Incident.objects.create(
        titre='Incident test permissions',
        type_incident=ti,
        statut=IncidentStatut.OUVERT,
        priorite='moyenne',
        signale_par=user_admin,
    )

@pytest.fixture
def intervention(db, incident, user_admin):
    return Intervention.objects.create(
        incident=incident,
        type_travaux='reparation',
        statut=InterventionStatut.PLANIFIEE,
        created_by=user_admin,
    )

INCIDENTS_URL     = '/api/incidents/'
INTERVENTIONS_URL = '/api/interventions/'


# ─────────────────────────────────────────────────────────────────────────────
#  Tests unitaires de _get_role et RoleBasedPermission
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestGetRole:

    def test_superuser_retourne_admin(self, db):
        user = User.objects.create_superuser('super_perm', password='test')
        assert _get_role(user) == 'admin'

    def test_profil_admin_retourne_admin(self, user_admin):
        assert _get_role(user_admin) == 'admin'

    def test_profil_superviseur(self, user_superviseur):
        assert _get_role(user_superviseur) == 'superviseur'

    def test_profil_operateur(self, user_operateur):
        assert _get_role(user_operateur) == 'operateur'

    def test_profil_lecteur(self, user_lecteur):
        assert _get_role(user_lecteur) == 'lecteur'

    def test_sans_profil_retourne_lecteur(self, user_sans_profil):
        assert _get_role(user_sans_profil) == 'lecteur'


@pytest.mark.django_db
class TestRoleBasedPermissionUnitaire:
    """Tests directs de has_permission via un faux request."""

    factory = APIRequestFactory()

    def _perm(self):
        return RoleBasedPermission()

    def _request(self, method, user):
        req = getattr(self.factory, method.lower())('/')
        req.user = user
        return req

    def test_get_autorise_lecteur(self, user_lecteur):
        assert self._perm().has_permission(self._request('GET', user_lecteur), None) is True

    def test_get_autorise_operateur(self, user_operateur):
        assert self._perm().has_permission(self._request('GET', user_operateur), None) is True

    def test_post_autorise_operateur(self, user_operateur):
        assert self._perm().has_permission(self._request('POST', user_operateur), None) is True

    def test_post_autorise_superviseur(self, user_superviseur):
        assert self._perm().has_permission(self._request('POST', user_superviseur), None) is True

    def test_post_autorise_admin(self, user_admin):
        assert self._perm().has_permission(self._request('POST', user_admin), None) is True

    def test_post_refuse_lecteur(self, user_lecteur):
        assert self._perm().has_permission(self._request('POST', user_lecteur), None) is False

    def test_patch_refuse_lecteur(self, user_lecteur):
        assert self._perm().has_permission(self._request('PATCH', user_lecteur), None) is False

    def test_delete_autorise_admin(self, user_admin):
        assert self._perm().has_permission(self._request('DELETE', user_admin), None) is True

    def test_delete_refuse_superviseur(self, user_superviseur):
        assert self._perm().has_permission(self._request('DELETE', user_superviseur), None) is False

    def test_delete_refuse_operateur(self, user_operateur):
        assert self._perm().has_permission(self._request('DELETE', user_operateur), None) is False

    def test_delete_refuse_lecteur(self, user_lecteur):
        assert self._perm().has_permission(self._request('DELETE', user_lecteur), None) is False

    def test_sans_profil_post_refuse(self, user_sans_profil):
        assert self._perm().has_permission(self._request('POST', user_sans_profil), None) is False

    def test_sans_profil_get_autorise(self, user_sans_profil):
        assert self._perm().has_permission(self._request('GET', user_sans_profil), None) is True


# ─────────────────────────────────────────────────────────────────────────────
#  Tests d'intégration — Incidents
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestIncidentPermissionsLecture:
    """GET /api/incidents/ — accessible à tous les rôles."""

    def test_lecteur_peut_lister(self, user_lecteur, incident):
        r = make_client(user_lecteur).get(INCIDENTS_URL)
        assert r.status_code == 200

    def test_operateur_peut_lister(self, user_operateur, incident):
        r = make_client(user_operateur).get(INCIDENTS_URL)
        assert r.status_code == 200

    def test_superviseur_peut_lister(self, user_superviseur, incident):
        r = make_client(user_superviseur).get(INCIDENTS_URL)
        assert r.status_code == 200

    def test_admin_peut_lister(self, user_admin, incident):
        r = make_client(user_admin).get(INCIDENTS_URL)
        assert r.status_code == 200

    def test_anonyme_est_refuse(self):
        r = APIClient().get(INCIDENTS_URL)
        assert r.status_code in (401, 403)

    def test_lecteur_peut_voir_detail(self, user_lecteur, incident):
        r = make_client(user_lecteur).get(f'{INCIDENTS_URL}{incident.id}/')
        assert r.status_code == 200


@pytest.mark.django_db
class TestIncidentPermissionsEcriture:
    """POST / PATCH — refusé pour lecteur, autorisé pour operateur+."""

    PAYLOAD = {
        'titre':    'Nouveau incident',
        'priorite': 'haute',
    }

    def test_operateur_peut_creer(self, user_operateur):
        r = make_client(user_operateur).post(INCIDENTS_URL, self.PAYLOAD, format='json')
        assert r.status_code == 201

    def test_superviseur_peut_creer(self, user_superviseur):
        r = make_client(user_superviseur).post(INCIDENTS_URL, self.PAYLOAD, format='json')
        assert r.status_code == 201

    def test_admin_peut_creer(self, user_admin):
        r = make_client(user_admin).post(INCIDENTS_URL, self.PAYLOAD, format='json')
        assert r.status_code == 201

    def test_lecteur_ne_peut_pas_creer(self, user_lecteur):
        r = make_client(user_lecteur).post(INCIDENTS_URL, self.PAYLOAD, format='json')
        assert r.status_code == 403

    def test_operateur_peut_modifier(self, user_operateur, incident):
        r = make_client(user_operateur).patch(
            f'{INCIDENTS_URL}{incident.id}/', {'priorite': 'basse'}, format='json'
        )
        assert r.status_code == 200

    def test_lecteur_ne_peut_pas_modifier(self, user_lecteur, incident):
        r = make_client(user_lecteur).patch(
            f'{INCIDENTS_URL}{incident.id}/', {'priorite': 'basse'}, format='json'
        )
        assert r.status_code == 403

    def test_anonyme_ne_peut_pas_creer(self, incident):
        r = APIClient().post(INCIDENTS_URL, self.PAYLOAD, format='json')
        assert r.status_code in (401, 403)


@pytest.mark.django_db
class TestIncidentPermissionsSuppression:
    """DELETE — admin uniquement."""

    def test_admin_peut_supprimer(self, user_admin, incident):
        r = make_client(user_admin).delete(f'{INCIDENTS_URL}{incident.id}/')
        assert r.status_code == 204

    def test_superviseur_ne_peut_pas_supprimer(self, user_superviseur, incident):
        r = make_client(user_superviseur).delete(f'{INCIDENTS_URL}{incident.id}/')
        assert r.status_code == 403

    def test_operateur_ne_peut_pas_supprimer(self, user_operateur, incident):
        r = make_client(user_operateur).delete(f'{INCIDENTS_URL}{incident.id}/')
        assert r.status_code == 403

    def test_lecteur_ne_peut_pas_supprimer(self, user_lecteur, incident):
        r = make_client(user_lecteur).delete(f'{INCIDENTS_URL}{incident.id}/')
        assert r.status_code == 403

    def test_anonyme_ne_peut_pas_supprimer(self, incident):
        r = APIClient().delete(f'{INCIDENTS_URL}{incident.id}/')
        assert r.status_code in (401, 403)


@pytest.mark.django_db
class TestIncidentPermissionsActions:
    """Actions métier assigner / stats."""

    def test_operateur_peut_assigner(self, user_operateur, incident, user_lecteur):
        r = make_client(user_operateur).post(
            f'{INCIDENTS_URL}{incident.id}/assigner/',
            {'user_id': user_lecteur.id},
            format='json',
        )
        assert r.status_code == 200

    def test_lecteur_ne_peut_pas_assigner(self, user_lecteur, incident):
        r = make_client(user_lecteur).post(
            f'{INCIDENTS_URL}{incident.id}/assigner/',
            {'user_id': user_lecteur.id},
            format='json',
        )
        assert r.status_code == 403

    def test_lecteur_peut_voir_stats(self, user_lecteur):
        r = make_client(user_lecteur).get(f'{INCIDENTS_URL}stats/')
        assert r.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
#  Tests d'intégration — Interventions
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestInterventionPermissionsLecture:

    def test_lecteur_peut_lister(self, user_lecteur, intervention):
        r = make_client(user_lecteur).get(INTERVENTIONS_URL)
        assert r.status_code == 200

    def test_anonyme_est_refuse(self):
        r = APIClient().get(INTERVENTIONS_URL)
        assert r.status_code in (401, 403)


@pytest.mark.django_db
class TestInterventionPermissionsEcriture:

    def test_operateur_peut_creer(self, user_operateur, incident):
        payload = {'incident': incident.id, 'type_travaux': 'reparation'}
        r = make_client(user_operateur).post(INTERVENTIONS_URL, payload, format='json')
        assert r.status_code == 201

    def test_lecteur_ne_peut_pas_creer(self, user_lecteur, incident):
        payload = {'incident': incident.id, 'type_travaux': 'reparation'}
        r = make_client(user_lecteur).post(INTERVENTIONS_URL, payload, format='json')
        assert r.status_code == 403

    def test_lecteur_ne_peut_pas_modifier(self, user_lecteur, intervention):
        r = make_client(user_lecteur).patch(
            f'{INTERVENTIONS_URL}{intervention.id}/',
            {'type_travaux': 'inspection'},
            format='json',
        )
        assert r.status_code == 403


@pytest.mark.django_db
class TestInterventionPermissionsSuppression:

    def test_admin_peut_supprimer(self, user_admin, intervention):
        r = make_client(user_admin).delete(f'{INTERVENTIONS_URL}{intervention.id}/')
        assert r.status_code == 204

    def test_operateur_ne_peut_pas_supprimer(self, user_operateur, intervention):
        r = make_client(user_operateur).delete(f'{INTERVENTIONS_URL}{intervention.id}/')
        assert r.status_code == 403

    def test_lecteur_ne_peut_pas_supprimer(self, user_lecteur, intervention):
        r = make_client(user_lecteur).delete(f'{INTERVENTIONS_URL}{intervention.id}/')
        assert r.status_code == 403


@pytest.mark.django_db
class TestInterventionPermissionsActions:

    def test_operateur_peut_cloturer(self, user_operateur, intervention):
        # Passer en EN_COURS d'abord
        intervention.statut = InterventionStatut.EN_COURS
        intervention.save()
        r = make_client(user_operateur).post(
            f'{INTERVENTIONS_URL}{intervention.id}/cloturer/',
            {'rapport': 'Terminé'},
            format='json',
        )
        assert r.status_code == 200

    def test_lecteur_ne_peut_pas_cloturer(self, user_lecteur, intervention):
        intervention.statut = InterventionStatut.EN_COURS
        intervention.save()
        r = make_client(user_lecteur).post(
            f'{INTERVENTIONS_URL}{intervention.id}/cloturer/',
            {'rapport': 'Essai'},
            format='json',
        )
        assert r.status_code == 403

    def test_superviseur_peut_assigner_intervention(self, user_superviseur, intervention, user_operateur):
        r = make_client(user_superviseur).post(
            f'{INTERVENTIONS_URL}{intervention.id}/assigner/',
            {'user_id': user_operateur.id},
            format='json',
        )
        assert r.status_code == 200
