"""
tests/test_notifications.py — Tests de l'endpoint notifications_feed
=====================================================================

Couverture :
  Authentification
    ✓ 401 pour un appel anonyme
    ✓ 200 pour un utilisateur authentifié

  Structure de la réponse
    ✓ Champs de base présents : timestamp, count, events
    ✓ count == len(events)
    ✓ timestamp est une chaîne ISO 8601

  Paramètre ?since= absent
    ✓ Retourne une réponse vide quand aucun incident récent

  Paramètre ?since= présent
    ✓ Incidents créés après `since` → type incident_nouveau
    ✓ Incidents modifiés (non créés) après `since` → type incident_modifie
    ✓ Interventions créées après `since` → type intervention_nouvelle
    ✓ Incidents antérieurs à `since` non inclus

  Paramètre ?since= invalide
    ✓ since invalide → fallback sur 5 minutes (réponse 200)

  Structure des événements
    ✓ incident_nouveau : id, titre, priorite, statut, date
    ✓ incident_modifie : id, titre, statut, date
    ✓ intervention_nouvelle : id, incident_id, incident_titre, type_travaux, statut, date

  Tri
    ✓ Les événements sont triés par date décroissante
"""

import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient

from sims_network.models import (
    Incident, IncidentStatut, TypeIncident,
    Intervention, InterventionStatut,
)

# ── Helpers ───────────────────────────────────────────────────────

FEED_URL = '/api/notifications/feed/'


def make_type_incident(nom="Défaut réseau"):
    return TypeIncident.objects.get_or_create(nom=nom)[0]


def make_incident(titre="Test incident", statut=IncidentStatut.OUVERT, **kwargs):
    defaults = dict(
        titre=titre,
        type_incident=None,
        statut=statut,
        priorite='moyenne',
    )
    defaults.update(kwargs)
    return Incident.objects.create(**defaults)


def make_intervention(incident, statut=InterventionStatut.PLANIFIEE, **kwargs):
    defaults = dict(
        type_travaux='reparation',
        statut=statut,
    )
    defaults.update(kwargs)
    return Intervention.objects.create(incident=incident, **defaults)

# ── Tests authentification ────────────────────────────────────────


@pytest.mark.django_db
class TestNotificationsFeedAuth:

    def test_anonyme_recoit_401(self):
        client = APIClient()
        response = client.get(FEED_URL)
        # DRF retourne 403 avec SessionAuthentication, 401 avec JWT
        assert response.status_code in (401, 403)

    def test_utilisateur_authentifie_recoit_200(self, auth_client_lecteur):
        response = auth_client_lecteur.get(FEED_URL)
        assert response.status_code == 200

    def test_admin_recoit_200(self, auth_client_admin):
        response = auth_client_admin.get(FEED_URL)
        assert response.status_code == 200

# ── Tests structure de la réponse ────────────────────────────────


@pytest.mark.django_db
class TestNotificationsFeedStructure:

    def test_champs_de_base_presents(self, auth_client_lecteur):
        response = auth_client_lecteur.get(FEED_URL)
        data = response.json()
        assert 'timestamp' in data
        assert 'count' in data
        assert 'events' in data

    def test_count_egal_len_events(self, auth_client_lecteur):
        response = auth_client_lecteur.get(FEED_URL)
        data = response.json()
        assert data['count'] == len(data['events'])

    def test_timestamp_est_string(self, auth_client_lecteur):
        response = auth_client_lecteur.get(FEED_URL)
        data = response.json()
        assert isinstance(data['timestamp'], str)
        # Doit contenir un 'T' (format ISO 8601)
        assert 'T' in data['timestamp']

    def test_events_est_une_liste(self, auth_client_lecteur):
        response = auth_client_lecteur.get(FEED_URL)
        data = response.json()
        assert isinstance(data['events'], list)

# ── Tests paramètre since absent ─────────────────────────────────


@pytest.mark.django_db
class TestNotificationsFeedSansParam:

    def test_reponse_vide_si_aucun_incident_recent(self, auth_client_lecteur):
        """
        Sans ?since, la fenêtre est 5 minutes.
        Un incident créé il y a 10 minutes ne doit pas apparaître.
        """
        # Créer un incident "vieux" (hors fenêtre)
        old_time = timezone.now() - timedelta(minutes=10)
        inc = make_incident(titre="Vieux incident")
        # Forcer created_at dans le passé via update (bypass auto_now_add)
        Incident.objects.filter(pk=inc.pk).update(created_at=old_time, updated_at=old_time)

        response = auth_client_lecteur.get(FEED_URL)
        data = response.json()
        ids = [e['id'] for e in data['events']]
        assert inc.id not in ids

# ── Tests paramètre since présent ────────────────────────────────


@pytest.mark.django_db
class TestNotificationsFeedAvecSince:

    def _since_iso(self, delta_minutes=-2):
        """Retourne un timestamp ISO `delta_minutes` dans le passé."""
        return (timezone.now() + timedelta(minutes=delta_minutes)).isoformat()

    def test_incident_nouveau_apres_since(self, auth_client_lecteur, user_lecteur):
        """Un incident créé après `since` → event type incident_nouveau."""
        since = self._since_iso(-2)
        inc = make_incident(titre="Incident récent", signale_par=user_lecteur)
        # created_at sera now() → postérieur à since

        response = auth_client_lecteur.get(FEED_URL, {'since': since})
        data = response.json()
        event_types = [e['type'] for e in data['events'] if e['id'] == inc.id]
        assert 'incident_nouveau' in event_types

    def test_incident_avant_since_non_inclus(self, auth_client_lecteur):
        """Un incident créé avant `since` ne doit pas apparaître comme incident_nouveau."""
        inc = make_incident(titre="Incident ancien")
        old_time = timezone.now() - timedelta(minutes=10)
        Incident.objects.filter(pk=inc.pk).update(created_at=old_time, updated_at=old_time)

        since = self._since_iso(-2)  # 2 minutes dans le passé, soit après old_time

        response = auth_client_lecteur.get(FEED_URL, {'since': since})
        data = response.json()
        nouveaux_ids = [e['id'] for e in data['events'] if e['type'] == 'incident_nouveau']
        assert inc.id not in nouveaux_ids

    def test_incident_modifie_apres_since(self, auth_client_lecteur, user_lecteur):
        """
        Un incident créé avant `since` mais modifié après
        → event type incident_modifie.
        """
        # Créer l'incident dans le passé (avant since)
        inc = make_incident(titre="Incident modifié", signale_par=user_lecteur)
        old_time = timezone.now() - timedelta(minutes=10)
        Incident.objects.filter(pk=inc.pk).update(created_at=old_time, updated_at=old_time)

        since = self._since_iso(-2)

        # Modifier l'incident (updated_at devient now → postérieur à since)
        inc.refresh_from_db()
        inc.statut = IncidentStatut.EN_COURS
        inc.save()

        response = auth_client_lecteur.get(FEED_URL, {'since': since})
        data = response.json()
        event_types = [e['type'] for e in data['events'] if e['id'] == inc.id]
        assert 'incident_modifie' in event_types

    def test_intervention_nouvelle_apres_since(self, auth_client_lecteur, user_lecteur):
        """Une intervention créée après `since` → event type intervention_nouvelle."""
        since = self._since_iso(-2)
        inc = make_incident(titre="Incident parent", signale_par=user_lecteur)
        _ = make_intervention(inc)

        response = auth_client_lecteur.get(FEED_URL, {'since': since})
        data = response.json()
        event_types = [e['type'] for e in data['events'] if e.get('incident_id') == inc.id]
        assert 'intervention_nouvelle' in event_types

    def test_incident_nouveau_non_doublon_en_modifie(self, auth_client_lecteur):
        """
        Un incident créé après `since` (nouveau) ne doit pas apparaître
        aussi dans les modifiés.
        """
        since = self._since_iso(-2)
        inc = make_incident(titre="Nouveau pas modifié")

        response = auth_client_lecteur.get(FEED_URL, {'since': since})
        data = response.json()
        modifies_ids = [e['id'] for e in data['events'] if e['type'] == 'incident_modifie']
        assert inc.id not in modifies_ids

# ── Tests paramètre since invalide ───────────────────────────────


@pytest.mark.django_db
class TestNotificationsFeedSinceInvalide:

    def test_since_invalide_retourne_200(self, auth_client_lecteur):
        """Un `since` non parseable → fallback 5 min, pas d'erreur 400."""
        response = auth_client_lecteur.get(FEED_URL, {'since': 'invalid-date'})
        assert response.status_code == 200

    def test_since_invalide_retourne_structure_correcte(self, auth_client_lecteur):
        response = auth_client_lecteur.get(FEED_URL, {'since': 'not-a-date'})
        data = response.json()
        assert 'timestamp' in data
        assert 'count' in data
        assert 'events' in data

# ── Tests structure des événements ────────────────────────────────


@pytest.mark.django_db
class TestNotificationsFeedStructureEvenements:

    def _since_iso(self, delta_minutes=-2):
        return (timezone.now() + timedelta(minutes=delta_minutes)).isoformat()

    def test_incident_nouveau_champs(self, auth_client_lecteur, user_lecteur):
        """L'événement incident_nouveau contient les bons champs."""
        since = self._since_iso(-2)
        inc = make_incident(titre="Test champs nouveau", signale_par=user_lecteur)

        response = auth_client_lecteur.get(FEED_URL, {'since': since})
        data = response.json()
        event = next((e for e in data['events'] if e.get('type') == 'incident_nouveau' and e['id'] == inc.id), None)

        assert event is not None
        assert 'id' in event
        assert 'titre' in event
        assert 'priorite' in event
        assert 'statut' in event
        assert 'date' in event
        assert event['type'] == 'incident_nouveau'

    def test_incident_modifie_champs(self, auth_client_lecteur, user_lecteur):
        """L'événement incident_modifie contient les bons champs."""
        inc = make_incident(titre="Test champs modifié", signale_par=user_lecteur)
        old_time = timezone.now() - timedelta(minutes=10)
        Incident.objects.filter(pk=inc.pk).update(created_at=old_time, updated_at=old_time)

        since = self._since_iso(-2)
        inc.refresh_from_db()
        inc.statut = IncidentStatut.EN_COURS
        inc.save()

        response = auth_client_lecteur.get(FEED_URL, {'since': since})
        data = response.json()
        event = next((e for e in data['events'] if e.get('type') == 'incident_modifie' and e['id'] == inc.id), None)

        assert event is not None
        assert 'id' in event
        assert 'titre' in event
        assert 'statut' in event
        assert 'date' in event

    def test_intervention_nouvelle_champs(self, auth_client_lecteur, user_lecteur):
        """L'événement intervention_nouvelle contient les bons champs."""
        since = self._since_iso(-2)
        inc = make_incident(titre="Incident pour intervention", signale_par=user_lecteur)
        _ = make_intervention(inc)

        response = auth_client_lecteur.get(FEED_URL, {'since': since})
        data = response.json()
        event = next(
            (e for e in data['events']
             if e.get('type') == 'intervention_nouvelle' and e.get('incident_id') == inc.id),
            None,
        )

        assert event is not None
        assert 'id' in event
        assert 'incident_id' in event
        assert 'incident_titre' in event
        assert 'type_travaux' in event
        assert 'statut' in event
        assert 'date' in event

    def test_incident_titre_depuis_type_incident_si_titre_vide(self, auth_client_lecteur, user_lecteur):
        """
        Si titre est vide, le libellé doit tomber sur type_incident.nom.
        """
        since = self._since_iso(-2)
        ti = make_type_incident(nom="Coupure HTA")
        # Créer un incident avec titre vide et type_incident renseigné
        inc = Incident.objects.create(
            titre='',
            type_incident=ti,
            statut=IncidentStatut.OUVERT,
            priorite='haute',
            signale_par=user_lecteur,
        )

        response = auth_client_lecteur.get(FEED_URL, {'since': since})
        data = response.json()
        event = next((e for e in data['events'] if e.get('type') == 'incident_nouveau' and e['id'] == inc.id), None)

        assert event is not None
        assert event['titre'] == 'Coupure HTA'

# ── Tests tri ────────────────────────────────────────────────────


@pytest.mark.django_db
class TestNotificationsFeedTri:

    def test_evenements_tries_par_date_decroissante(self, auth_client_lecteur):
        """Les événements doivent être triés de plus récent à plus ancien."""
        since = (timezone.now() - timedelta(minutes=2)).isoformat()

        # Créer 3 incidents dans l'ordre (created_at sera now() pour chacun,
        # les dates seront proches mais différentes → l'ordre devrait être maintenu)
        _ = make_incident(titre="Premier")
        _ = make_incident(titre="Deuxième")
        _ = make_incident(titre="Troisième")

        response = auth_client_lecteur.get(FEED_URL, {'since': since})
        data = response.json()

        events = data['events']
        # Vérifier que les dates sont décroissantes
        dates = [e['date'] for e in events]
        assert dates == sorted(dates, reverse=True), "Les événements ne sont pas triés par date décroissante"
