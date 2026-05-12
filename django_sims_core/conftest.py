"""
conftest.py — Fixtures pytest partagées pour django_sims_core
=============================================================
Couvre : User, UserProfile, Organisation, Application,
         ApplicationLayer, Incident, Intervention.

Toutes les fixtures sont marquées @pytest.mark.django_db via
le scope 'function' (isolement maximal par test).
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from sims_core.models import Organisation, Application, ApplicationLayer, UserProfile
from sims_network.models import Incident, Intervention, IncidentStatut, InterventionStatut, TypeIncident


# ── Utilisateurs ─────────────────────────────────────────────────


@pytest.fixture
def user_superuser(db):
    """Superuser Django (accès total)."""
    return User.objects.create_superuser(
        username="superadmin",
        email="superadmin@test.com",
        password="testpass123",
    )


@pytest.fixture
def user_admin(db, organisation):
    """Utilisateur avec profil rôle='admin' (non superuser), dans la même org que les fixtures."""
    user = User.objects.create_user(
        username="admin_user",
        email="admin@test.com",
        password="testpass123",
    )
    UserProfile.objects.create(user=user, organisation=organisation, role="admin")
    return user


@pytest.fixture
def user_lecteur(db, organisation):
    """Utilisateur avec profil rôle='lecteur' (lecture seule), dans la même org que les fixtures."""
    user = User.objects.create_user(
        username="lecteur_user",
        email="lecteur@test.com",
        password="testpass123",
    )
    UserProfile.objects.create(user=user, organisation=organisation, role="lecteur")
    return user


@pytest.fixture
def user_operateur(db):
    """Utilisateur opérateur terrain."""
    user = User.objects.create_user(
        username="operateur_user",
        email="operateur@test.com",
        password="testpass123",
    )
    org = Organisation.objects.create(name="OpOrg", slug="oporg")
    UserProfile.objects.create(user=user, organisation=org, role="operateur")
    return user


# ── Infrastructure SIMS ──────────────────────────────────────────


@pytest.fixture
def organisation(db):
    return Organisation.objects.create(
        name="ENEO Cameroun",
        slug="eneo-cm",
        # Tous les modules activés pour les tests — l'org de test est une org complète.
        module_incidents=True,
        module_interventions=True,
        module_analytics=True,
        module_export=True,
        module_editor=True,
    )


@pytest.fixture
def application(db, organisation, user_admin):
    return Application.objects.create(
        organisation=organisation,
        name="Carte Réseau",
        slug="eneo-cm-carte-reseau",
        created_by=user_admin,
    )


@pytest.fixture
def layer_wms(db, application):
    """Couche WMS avec group_slug pour tester les alias sérialiseur."""
    return ApplicationLayer.objects.create(
        application=application,
        name="Réseau HTB",
        geoserver_layer="eneo_gis_ws:cmrReseauHTB",
        layer_type="WMS",
        group_slug="htb_existant",
        group_label="Réseau HTB Existant",
        group_icon="⚡",
        group_order=1,
        visible_default=True,
        opacity_default=0.8,
        color="#FF6B35",
    )


@pytest.fixture
def layer_wfs(db, application):
    """Couche WFS."""
    return ApplicationLayer.objects.create(
        application=application,
        name="Postes Sources",
        geoserver_layer="eneo_gis_ws:cmrPosteSource",
        layer_type="WFS",
        group_slug="postes",
        group_label="Postes Sources",
        group_order=2,
        visible_default=False,
        opacity_default=1.0,
    )


# ── Incidents & Interventions ────────────────────────────────────


@pytest.fixture
def incident_ouvert(db, organisation):
    """Incident de base en statut OUVERT, rattaché à l'organisation de test."""
    ti = TypeIncident.objects.get_or_create(nom='Panne transformateur')[0]
    return Incident.objects.create(
        titre="Panne transformateur Biyem-Assi",
        type_incident=ti,
        statut=IncidentStatut.OUVERT,
        priorite="haute",
        latitude=3.848,
        longitude=11.502,
        localisation="Biyem-Assi",
        ville="Yaoundé",
        organisation=organisation,
    )


@pytest.fixture
def incident_en_cours(db, user_operateur, organisation):
    """Incident déjà en cours de traitement, rattaché à l'organisation de test."""
    ti = TypeIncident.objects.get_or_create(nom='Coupure ligne')[0]
    inc = Incident.objects.create(
        titre="Coupure ligne BT Cité Verte",
        type_incident=ti,
        statut=IncidentStatut.EN_COURS,
        priorite="moyenne",
        organisation=organisation,
    )
    return inc


@pytest.fixture
def intervention_planifiee(db, incident_ouvert):
    """Intervention PLANIFIÉE sur un incident ouvert."""
    return Intervention.objects.create(
        incident=incident_ouvert,
        type_travaux="reparation",
        statut=InterventionStatut.PLANIFIEE,
        description="Remplacement fusibles MT",
    )


# ── API Client ───────────────────────────────────────────────────


@pytest.fixture
def api_client():
    """Client DRF non authentifié."""
    return APIClient()


@pytest.fixture
def auth_client_admin(user_admin):
    """Client DRF authentifié en tant qu'admin."""
    client = APIClient()
    client.force_authenticate(user=user_admin)
    return client


@pytest.fixture
def auth_client_lecteur(user_lecteur):
    """Client DRF authentifié en tant que lecteur."""
    client = APIClient()
    client.force_authenticate(user=user_lecteur)
    return client


@pytest.fixture
def auth_client_superuser(user_superuser):
    """Client DRF authentifié en tant que superuser."""
    client = APIClient()
    client.force_authenticate(user=user_superuser)
    return client
