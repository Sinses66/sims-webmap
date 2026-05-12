"""
sims_network/tests/test_views.py — Tests des endpoints API REST
==============================================================

Couverture :
  GET  /api/incidents/                  ✓ 200 authentifié / 401 anonyme
  GET  /api/incidents/                  ✓ réponse paginée (count + results)
  GET  /api/incidents/?statut=          ✓ filtre par statut
  GET  /api/incidents/?priorite=        ✓ filtre par priorité
  GET  /api/incidents/?search=          ✓ recherche textuelle
  POST /api/incidents/                  ✓ création (201) / anonyme (401)
  POST /api/incidents/                  ✓ signale_par auto-renseigné
  POST /api/incidents/                  ✓ statut initial = ouvert
  POST /api/incidents/                  ✓ titre manquant → 400
  GET  /api/incidents/{id}/             ✓ détail / 404 inexistant
  GET  /api/incidents/stats/            ✓ 200 / champs présents / compteurs cohérents
  POST /api/incidents/{id}/assigner/    ✓ 200 / statut EN_COURS / assigne_a affecté
  POST /api/incidents/{id}/assigner/    ✓ user inexistant → 400 / anonyme → 401

  GET  /api/interventions/              ✓ 200 / 401
  GET  /api/interventions/?incident=    ✓ filtre par incident
  POST /api/interventions/              ✓ 201 / sans incident → 400
  POST /api/interventions/{id}/assigner/ ✓ 200 / statut EN_COURS
  POST /api/interventions/{id}/cloturer/ ✓ 200 / statut TERMINEE / cascade incident RESOLU
  POST /api/interventions/{id}/cloturer/ ✓ sans rapport (optionnel) / anonyme → 401
"""

import pytest

from sims_network.models import Incident, IncidentStatut, Intervention, InterventionStatut

INCIDENTS_URL = '/api/incidents/'
INTERVENTIONS_URL = '/api/interventions/'


# ═════════════════════════════════════════════════════════════════
#  INCIDENT — LIST & ACCÈS
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestIncidentAcces:

    def test_liste_anonyme_renvoie_401(self, api_client):
        response = api_client.get(INCIDENTS_URL)
        assert response.status_code in (401, 403)

    def test_liste_authentifie_renvoie_200(self, auth_client_admin):
        response = auth_client_admin.get(INCIDENTS_URL)
        assert response.status_code == 200

    def test_reponse_est_paginee(self, auth_client_admin, incident_ouvert):
        response = auth_client_admin.get(INCIDENTS_URL)
        data = response.json()
        assert 'count' in data
        assert 'results' in data

    def test_incident_present_dans_liste(self, auth_client_admin, incident_ouvert):
        response = auth_client_admin.get(INCIDENTS_URL)
        ids = [i['id'] for i in response.json()['results']]
        assert incident_ouvert.id in ids

    def test_detail_renvoie_200(self, auth_client_admin, incident_ouvert):
        response = auth_client_admin.get(f'{INCIDENTS_URL}{incident_ouvert.id}/')
        assert response.status_code == 200

    def test_detail_inexistant_renvoie_404(self, auth_client_admin):
        response = auth_client_admin.get(f'{INCIDENTS_URL}99999/')
        assert response.status_code == 404


# ═════════════════════════════════════════════════════════════════
#  INCIDENT — FILTRES
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestIncidentFiltres:

    def test_filtre_statut_ouvert(self, auth_client_admin, incident_ouvert, incident_en_cours):
        response = auth_client_admin.get(INCIDENTS_URL, {'statut': 'ouvert'})
        for inc in response.json()['results']:
            assert inc['statut'] == 'ouvert'

    def test_filtre_statut_en_cours(self, auth_client_admin, incident_ouvert, incident_en_cours):
        response = auth_client_admin.get(INCIDENTS_URL, {'statut': 'en_cours'})
        for inc in response.json()['results']:
            assert inc['statut'] == 'en_cours'

    def test_filtre_priorite(self, auth_client_admin, incident_ouvert):
        # incident_ouvert a priorite='haute'
        response = auth_client_admin.get(INCIDENTS_URL, {'priorite': 'haute'})
        data = response.json()
        assert data['count'] >= 1
        for inc in data['results']:
            assert inc['priorite'] == 'haute'

    def test_filtre_search_localisation(self, auth_client_admin, incident_ouvert):
        # incident_ouvert a localisation='Biyem-Assi'
        response = auth_client_admin.get(INCIDENTS_URL, {'search': 'Biyem'})
        ids = [i['id'] for i in response.json()['results']]
        assert incident_ouvert.id in ids

    def test_filtre_search_sans_resultats(self, auth_client_admin, incident_ouvert):
        response = auth_client_admin.get(INCIDENTS_URL, {'search': 'xyzInexistant999'})
        assert response.json()['count'] == 0


# ═════════════════════════════════════════════════════════════════
#  INCIDENT — CRÉATION
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestIncidentCreate:

    PAYLOAD = {
        'titre':       'Court-circuit Bastos',
        'priorite':    'critique',
        'latitude':    3.871,
        'longitude':   11.516,
        'localisation': 'Bastos',
        'ville':       'Yaoundé',
    }

    def test_creation_renvoie_201(self, auth_client_admin):
        response = auth_client_admin.post(INCIDENTS_URL, self.PAYLOAD, format='json')
        assert response.status_code == 201

    def test_creation_anonyme_renvoie_401(self, api_client):
        response = api_client.post(INCIDENTS_URL, self.PAYLOAD, format='json')
        assert response.status_code in (401, 403)

    def test_signale_par_auto_renseigne(self, auth_client_admin, user_admin):
        response = auth_client_admin.post(INCIDENTS_URL, self.PAYLOAD, format='json')
        assert response.json()['signale_par'] == user_admin.id

    def test_statut_initial_est_ouvert(self, auth_client_admin):
        response = auth_client_admin.post(INCIDENTS_URL, self.PAYLOAD, format='json')
        assert response.json()['statut'] == 'ouvert'

    def test_titre_manquant_renvoie_400(self, auth_client_admin):
        payload = {k: v for k, v in self.PAYLOAD.items() if k != 'titre'}
        response = auth_client_admin.post(INCIDENTS_URL, payload, format='json')
        assert response.status_code == 400

    def test_incident_persiste_en_base(self, auth_client_admin):
        avant = Incident.objects.count()
        auth_client_admin.post(INCIDENTS_URL, self.PAYLOAD, format='json')
        assert Incident.objects.count() == avant + 1


# ═════════════════════════════════════════════════════════════════
#  INCIDENT — STATS
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestIncidentStats:

    def test_stats_anonyme_renvoie_401(self, api_client):
        response = api_client.get(f'{INCIDENTS_URL}stats/')
        assert response.status_code in (401, 403)

    def test_stats_renvoie_200(self, auth_client_admin):
        response = auth_client_admin.get(f'{INCIDENTS_URL}stats/')
        assert response.status_code == 200

    def test_stats_champs_obligatoires(self, auth_client_admin):
        data = auth_client_admin.get(f'{INCIDENTS_URL}stats/').json()
        for champ in ['total', 'ouverts', 'en_cours', 'resolus', 'critiques',
                      'par_statut', 'par_priorite', 'par_type']:
            assert champ in data, f"Champ manquant dans stats : '{champ}'"

    def test_stats_total_coherent(self, auth_client_admin, incident_ouvert, incident_en_cours):
        data = auth_client_admin.get(f'{INCIDENTS_URL}stats/').json()
        assert data['total'] >= 2

    def test_stats_ouverts_compte_incident_ouvert(self, auth_client_admin, incident_ouvert):
        data = auth_client_admin.get(f'{INCIDENTS_URL}stats/').json()
        assert data['ouverts'] >= 1

    def test_stats_en_cours_compte_incident_en_cours(self, auth_client_admin, incident_en_cours):
        data = auth_client_admin.get(f'{INCIDENTS_URL}stats/').json()
        assert data['en_cours'] >= 1


# ═════════════════════════════════════════════════════════════════
#  INCIDENT — ACTION ASSIGNER
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestIncidentAssigner:

    def test_assigner_renvoie_200(self, auth_client_admin, incident_ouvert, user_operateur):
        url = f'{INCIDENTS_URL}{incident_ouvert.id}/assigner/'
        response = auth_client_admin.post(url, {'user_id': user_operateur.id}, format='json')
        assert response.status_code == 200

    def test_assigner_passe_statut_en_cours(self, auth_client_admin, incident_ouvert, user_operateur):
        url = f'{INCIDENTS_URL}{incident_ouvert.id}/assigner/'
        auth_client_admin.post(url, {'user_id': user_operateur.id}, format='json')
        incident_ouvert.refresh_from_db()
        assert incident_ouvert.statut == IncidentStatut.EN_COURS

    def test_assigner_affecte_utilisateur(self, auth_client_admin, incident_ouvert, user_operateur):
        url = f'{INCIDENTS_URL}{incident_ouvert.id}/assigner/'
        auth_client_admin.post(url, {'user_id': user_operateur.id}, format='json')
        incident_ouvert.refresh_from_db()
        assert incident_ouvert.assigne_a == user_operateur

    def test_assigner_user_inexistant_renvoie_400(self, auth_client_admin, incident_ouvert):
        url = f'{INCIDENTS_URL}{incident_ouvert.id}/assigner/'
        response = auth_client_admin.post(url, {'user_id': 99999}, format='json')
        assert response.status_code == 400

    def test_assigner_anonyme_renvoie_401(self, api_client, incident_ouvert, user_operateur):
        url = f'{INCIDENTS_URL}{incident_ouvert.id}/assigner/'
        response = api_client.post(url, {'user_id': user_operateur.id}, format='json')
        assert response.status_code in (401, 403)

    def test_assigner_renvoi_incident_serialise(self, auth_client_admin, incident_ouvert, user_operateur):
        url = f'{INCIDENTS_URL}{incident_ouvert.id}/assigner/'
        response = auth_client_admin.post(url, {'user_id': user_operateur.id}, format='json')
        data = response.json()
        assert data['id'] == incident_ouvert.id
        assert data['statut'] == 'en_cours'


# ═════════════════════════════════════════════════════════════════
#  INTERVENTION — LIST & CRÉATION
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestInterventionAcces:

    def test_liste_anonyme_renvoie_401(self, api_client):
        response = api_client.get(INTERVENTIONS_URL)
        assert response.status_code in (401, 403)

    def test_liste_authentifie_renvoie_200(self, auth_client_admin):
        response = auth_client_admin.get(INTERVENTIONS_URL)
        assert response.status_code == 200

    def test_filtre_par_incident(self, auth_client_admin, intervention_planifiee, incident_ouvert):
        response = auth_client_admin.get(INTERVENTIONS_URL, {'incident': incident_ouvert.id})
        data = response.json()
        assert data['count'] >= 1
        for itv in data['results']:
            assert itv['incident'] == incident_ouvert.id

    def test_filtre_par_statut(self, auth_client_admin, intervention_planifiee):
        response = auth_client_admin.get(INTERVENTIONS_URL, {'statut': 'planifiee'})
        for itv in response.json()['results']:
            assert itv['statut'] == 'planifiee'


@pytest.mark.django_db
class TestInterventionCreate:

    def test_creation_renvoie_201(self, auth_client_admin, incident_ouvert):
        payload = {
            'incident':    incident_ouvert.id,
            'type_travaux': 'reparation',
            'description': 'Remplacement câble MT section Bastos',
        }
        response = auth_client_admin.post(INTERVENTIONS_URL, payload, format='json')
        assert response.status_code == 201

    def test_creation_statut_initial_planifiee(self, auth_client_admin, incident_ouvert):
        payload = {'incident': incident_ouvert.id, 'type_travaux': 'reparation'}
        response = auth_client_admin.post(INTERVENTIONS_URL, payload, format='json')
        assert response.json()['statut'] == 'planifiee'

    def test_creation_sans_incident_renvoie_400(self, auth_client_admin):
        payload = {'type_travaux': 'reparation'}
        response = auth_client_admin.post(INTERVENTIONS_URL, payload, format='json')
        assert response.status_code == 400

    def test_creation_anonyme_renvoie_401(self, api_client, incident_ouvert):
        payload = {'incident': incident_ouvert.id, 'type_travaux': 'reparation'}
        response = api_client.post(INTERVENTIONS_URL, payload, format='json')
        assert response.status_code in (401, 403)

    def test_intervention_persiste_en_base(self, auth_client_admin, incident_ouvert):
        avant = Intervention.objects.count()
        payload = {'incident': incident_ouvert.id, 'type_travaux': 'inspection'}
        auth_client_admin.post(INTERVENTIONS_URL, payload, format='json')
        assert Intervention.objects.count() == avant + 1


# ═════════════════════════════════════════════════════════════════
#  INTERVENTION — ACTION ASSIGNER
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestInterventionAssigner:

    def test_assigner_renvoie_200(self, auth_client_admin, intervention_planifiee, user_operateur):
        url = f'{INTERVENTIONS_URL}{intervention_planifiee.id}/assigner/'
        response = auth_client_admin.post(url, {'user_id': user_operateur.id}, format='json')
        assert response.status_code == 200

    def test_assigner_passe_statut_en_cours(self, auth_client_admin, intervention_planifiee, user_operateur):
        url = f'{INTERVENTIONS_URL}{intervention_planifiee.id}/assigner/'
        auth_client_admin.post(url, {'user_id': user_operateur.id}, format='json')
        intervention_planifiee.refresh_from_db()
        assert intervention_planifiee.statut == InterventionStatut.EN_COURS

    def test_assigner_affecte_responsable(self, auth_client_admin, intervention_planifiee, user_operateur):
        url = f'{INTERVENTIONS_URL}{intervention_planifiee.id}/assigner/'
        auth_client_admin.post(url, {'user_id': user_operateur.id}, format='json')
        intervention_planifiee.refresh_from_db()
        assert intervention_planifiee.responsable == user_operateur

    def test_assigner_cascade_incident_en_cours(self, auth_client_admin, intervention_planifiee,
                                                incident_ouvert, user_operateur):
        url = f'{INTERVENTIONS_URL}{intervention_planifiee.id}/assigner/'
        auth_client_admin.post(url, {'user_id': user_operateur.id}, format='json')
        incident_ouvert.refresh_from_db()
        assert incident_ouvert.statut == IncidentStatut.EN_COURS

    def test_assigner_anonyme_renvoie_401(self, api_client, intervention_planifiee, user_operateur):
        url = f'{INTERVENTIONS_URL}{intervention_planifiee.id}/assigner/'
        response = api_client.post(url, {'user_id': user_operateur.id}, format='json')
        assert response.status_code in (401, 403)


# ═════════════════════════════════════════════════════════════════
#  INTERVENTION — ACTION CLÔTURER
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
class TestInterventionCloturer:

    @pytest.fixture(autouse=True)
    def passer_en_cours(self, intervention_planifiee, incident_ouvert):
        """Passe l'intervention et l'incident en EN_COURS avant chaque test."""
        incident_ouvert.statut = IncidentStatut.EN_COURS
        incident_ouvert.save()
        intervention_planifiee.statut = InterventionStatut.EN_COURS
        intervention_planifiee.save()

    def test_cloturer_renvoie_200(self, auth_client_admin, intervention_planifiee):
        url = f'{INTERVENTIONS_URL}{intervention_planifiee.id}/cloturer/'
        response = auth_client_admin.post(url, {'rapport': 'Travaux terminés.'}, format='json')
        assert response.status_code == 200

    def test_cloturer_statut_passe_a_terminee(self, auth_client_admin, intervention_planifiee):
        url = f'{INTERVENTIONS_URL}{intervention_planifiee.id}/cloturer/'
        auth_client_admin.post(url, {'rapport': 'OK'}, format='json')
        intervention_planifiee.refresh_from_db()
        assert intervention_planifiee.statut == InterventionStatut.TERMINEE

    def test_cloturer_rapport_sauvegarde(self, auth_client_admin, intervention_planifiee):
        url = f'{INTERVENTIONS_URL}{intervention_planifiee.id}/cloturer/'
        auth_client_admin.post(url, {'rapport': 'Fusibles remplacés.'}, format='json')
        intervention_planifiee.refresh_from_db()
        assert intervention_planifiee.rapport == 'Fusibles remplacés.'

    def test_cloturer_sans_rapport_renvoie_200(self, auth_client_admin, intervention_planifiee):
        url = f'{INTERVENTIONS_URL}{intervention_planifiee.id}/cloturer/'
        response = auth_client_admin.post(url, {}, format='json')
        assert response.status_code == 200

    def test_cloturer_cascade_incident_resolu(self, auth_client_admin,
                                              intervention_planifiee, incident_ouvert):
        url = f'{INTERVENTIONS_URL}{intervention_planifiee.id}/cloturer/'
        auth_client_admin.post(url, {'rapport': 'Terminé'}, format='json')
        incident_ouvert.refresh_from_db()
        assert incident_ouvert.statut == IncidentStatut.RESOLU

    def test_cloturer_anonyme_renvoie_401(self, api_client, intervention_planifiee):
        url = f'{INTERVENTIONS_URL}{intervention_planifiee.id}/cloturer/'
        response = api_client.post(url, {'rapport': 'test'}, format='json')
        assert response.status_code in (401, 403)

    def test_cloturer_renvoi_intervention_serialisee(self, auth_client_admin, intervention_planifiee):
        url = f'{INTERVENTIONS_URL}{intervention_planifiee.id}/cloturer/'
        response = auth_client_admin.post(url, {'rapport': 'Fait'}, format='json')
        data = response.json()
        assert data['id'] == intervention_planifiee.id
        assert data['statut'] == 'terminee'
