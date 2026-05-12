"""
sims_core/tests/test_permissions.py
====================================
Tests des permissions et accès API pour sims_core.

Couverture :

  Classes de permission (unit tests)
  ───────────────────────────────────
  IsAdminOrReadOnly
    ✓ GET  → autorisé pour tout utilisateur authentifié
    ✓ GET  → refusé pour anonyme
    ✓ POST → refusé pour lecteur
    ✓ POST → autorisé pour superuser
    ✓ POST → autorisé pour role='admin'
    ✓ PATCH/DELETE → même règle que POST
    ✓ Opérateur → refusé en écriture
    ✓ User sans profil → refusé en écriture

  IsOwnerOrSharedReadOnly
    ✓ GET  → autorisé (méthode SAFE)
    ✓ DELETE → autorisé pour le propriétaire
    ✓ DELETE → autorisé pour superuser
    ✓ DELETE → refusé pour non-propriétaire
    ✓ Widget → vérification remonte au dashboard parent

  Endpoints API (tests d'intégration via APIClient)
  ──────────────────────────────────────────────────
  OrganisationViewSet
    ✓ GET list  → 200 pour lecteur
    ✓ GET list  → 401 pour anonyme
    ✓ POST      → 403 pour lecteur
    ✓ POST      → 201 pour admin
    ✓ DELETE    → 403 pour lecteur

  ApplicationViewSet  (régression : était IsAuthenticated → corrigé en IsAdminOrReadOnly)
    ✓ GET list  → 200 pour lecteur
    ✓ GET list  → 401 pour anonyme
    ✓ POST      → 403 pour lecteur
    ✓ POST      → 201 pour admin
    ✓ GET /config/ → 200 pour lecteur
    ✓ GET /layers/ → 200 pour lecteur

  ApplicationLayerViewSet
    ✓ GET list  → 200 pour lecteur
    ✓ GET list  → 401 pour anonyme
    ✓ POST format invalide → 400 (ApplicationLayer.clean())
    ✓ POST format valide   → 201 pour admin
    ✓ POST      → 403 pour lecteur
    ✓ DELETE    → 403 pour lecteur

  UserProfileViewSet — isolation par organisation
    ✓ admin     → voit tous les profils (toutes orgs)
    ✓ lecteur   → voit uniquement les profils de sa propre organisation
    ✓ lecteur   → ne voit pas les profils d'une autre organisation

  Scope organisation — ApplicationViewSet (4.2)
    ✓ lecteur   → voit les apps de sa propre org
    ✓ lecteur   → ne voit PAS les apps d'une autre org
    ✓ superuser → voit toutes les apps (toutes orgs)

  Scope organisation — ApplicationLayerViewSet (4.2)
    ✓ lecteur   → voit les couches de sa propre org
    ✓ lecteur   → ne voit PAS les couches d'une autre org
    ✓ superuser → voit toutes les couches (toutes orgs)

  Validation modèle
  ─────────────────
  ApplicationLayer.clean()
    ✓ format sans ':' → ValidationError
    ✓ workspace vide (":nom")  → ValidationError
    ✓ nom vide ("ws:")         → ValidationError
    ✓ format valide "ws:nom"   → pas d'erreur

  DashboardWidget.clean()
    ✓ format sans ':' → ValidationError
    ✓ format valide   → pas d'erreur
"""

import pytest
from django.contrib.auth.models import User, AnonymousUser
from django.core.exceptions import ValidationError
from rest_framework.test import APIRequestFactory, APIClient

from sims_core.views import IsAdminOrReadOnly, IsOwnerOrSharedReadOnly
from sims_core.models import (
    Organisation, Application, ApplicationLayer,
    UserProfile, Dashboard, DashboardWidget,
)


factory = APIRequestFactory()


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

def make_request(method: str, user):
    fn = getattr(factory, method.lower())
    req = fn("/fake/")
    req.user = user
    return req


class FakeView:
    pass


# ─────────────────────────────────────────────────────────────────
# Unit tests — IsAdminOrReadOnly
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestIsAdminOrReadOnly:

    perm = IsAdminOrReadOnly()
    view = FakeView()

    def test_get_autorise_utilisateur_authentifie(self, user_lecteur):
        req = make_request("GET", user_lecteur)
        assert self.perm.has_permission(req, self.view) is True

    def test_get_refuse_anonyme(self):
        req = make_request("GET", AnonymousUser())
        assert self.perm.has_permission(req, self.view) is False

    def test_post_refuse_lecteur(self, user_lecteur):
        req = make_request("POST", user_lecteur)
        assert self.perm.has_permission(req, self.view) is False

    def test_post_autorise_superuser(self, user_superuser):
        req = make_request("POST", user_superuser)
        assert self.perm.has_permission(req, self.view) is True

    def test_post_autorise_admin_role(self, user_admin):
        req = make_request("POST", user_admin)
        assert self.perm.has_permission(req, self.view) is True

    def test_patch_refuse_lecteur(self, user_lecteur):
        req = make_request("PATCH", user_lecteur)
        assert self.perm.has_permission(req, self.view) is False

    def test_patch_autorise_superuser(self, user_superuser):
        req = make_request("PATCH", user_superuser)
        assert self.perm.has_permission(req, self.view) is True

    def test_delete_refuse_lecteur(self, user_lecteur):
        req = make_request("DELETE", user_lecteur)
        assert self.perm.has_permission(req, self.view) is False

    def test_post_refuse_operateur(self, user_operateur):
        req = make_request("POST", user_operateur)
        assert self.perm.has_permission(req, self.view) is False

    def test_post_refuse_user_sans_profile(self, db):
        user_bare = User.objects.create_user(username="noProfile", password="x")
        req = make_request("POST", user_bare)
        assert self.perm.has_permission(req, self.view) is False


# ─────────────────────────────────────────────────────────────────
# Unit tests — IsOwnerOrSharedReadOnly
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestIsOwnerOrSharedReadOnly:

    perm = IsOwnerOrSharedReadOnly()
    view = FakeView()

    @pytest.fixture
    def owner(self, db):
        return User.objects.create_user(username="owner", password="x")

    @pytest.fixture
    def other_user(self, db):
        return User.objects.create_user(username="other", password="x")

    @pytest.fixture
    def dashboard(self, db, owner, organisation, application):
        return Dashboard.objects.create(
            application=application,
            created_by=owner,
            name="Mon Dashboard",
            is_shared=False,
        )

    @pytest.fixture
    def widget(self, db, dashboard):
        return DashboardWidget.objects.create(
            dashboard=dashboard,
            title="Widget test",
            geoserver_layer="eneo_gis_ws:cmrPosteSource",
            attributes=["region"],
            chart_type="bar",
        )

    def test_get_autorise_tout_utilisateur(self, other_user, dashboard):
        req = make_request("GET", other_user)
        assert self.perm.has_object_permission(req, self.view, dashboard) is True

    def test_delete_autorise_proprietaire(self, owner, dashboard):
        req = make_request("DELETE", owner)
        assert self.perm.has_object_permission(req, self.view, dashboard) is True

    def test_delete_autorise_superuser(self, user_superuser, dashboard):
        req = make_request("DELETE", user_superuser)
        assert self.perm.has_object_permission(req, self.view, dashboard) is True

    def test_delete_refuse_non_proprietaire(self, other_user, dashboard):
        req = make_request("DELETE", other_user)
        assert self.perm.has_object_permission(req, self.view, dashboard) is False

    def test_patch_refuse_non_proprietaire(self, other_user, dashboard):
        req = make_request("PATCH", other_user)
        assert self.perm.has_object_permission(req, self.view, dashboard) is False

    def test_put_autorise_proprietaire(self, owner, dashboard):
        req = make_request("PUT", owner)
        assert self.perm.has_object_permission(req, self.view, dashboard) is True

    def test_widget_get_autorise_autre_user(self, other_user, widget):
        req = make_request("GET", other_user)
        assert self.perm.has_object_permission(req, self.view, widget) is True

    def test_widget_delete_autorise_owner(self, owner, widget):
        req = make_request("DELETE", owner)
        assert self.perm.has_object_permission(req, self.view, widget) is True

    def test_widget_delete_refuse_non_proprietaire(self, other_user, widget):
        req = make_request("DELETE", other_user)
        assert self.perm.has_object_permission(req, self.view, widget) is False

    def test_widget_delete_autorise_superuser(self, user_superuser, widget):
        req = make_request("DELETE", user_superuser)
        assert self.perm.has_object_permission(req, self.view, widget) is True


# ─────────────────────────────────────────────────────────────────
# Endpoint tests — OrganisationViewSet
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestOrganisationViewSetPermissions:

    URL = '/api/organisations/'

    def test_get_autorise_lecteur(self, auth_client_lecteur):
        resp = auth_client_lecteur.get(self.URL)
        assert resp.status_code == 200

    def test_get_refuse_anonyme(self, api_client):
        resp = api_client.get(self.URL)
        assert resp.status_code in (401, 403)  # DRF retourne 403 sans BasicAuthentication

    def test_post_refuse_lecteur(self, auth_client_lecteur):
        resp = auth_client_lecteur.post(self.URL, {'name': 'NouvelleOrg', 'slug': 'nouvelleorg'})
        assert resp.status_code == 403

    def test_post_autorise_admin(self, auth_client_admin):
        resp = auth_client_admin.post(self.URL, {'name': 'NouvelleOrg', 'slug': 'nouvelleorg'})
        assert resp.status_code == 201

    def test_delete_refuse_lecteur(self, auth_client_lecteur, organisation):
        resp = auth_client_lecteur.delete(f'{self.URL}{organisation.slug}/')
        assert resp.status_code == 403


# ─────────────────────────────────────────────────────────────────
# Endpoint tests — ApplicationViewSet
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestApplicationViewSetPermissions:

    URL = '/api/applications/'

    def test_get_autorise_lecteur(self, auth_client_lecteur, application):
        resp = auth_client_lecteur.get(self.URL)
        assert resp.status_code == 200

    def test_get_refuse_anonyme(self, api_client, application):
        resp = api_client.get(self.URL)
        assert resp.status_code in (401, 403)  # DRF retourne 403 sans BasicAuthentication

    def test_post_refuse_lecteur(self, auth_client_lecteur, organisation):
        """Régression : ApplicationViewSet était IsAuthenticated — corrigé en IsAdminOrReadOnly."""
        resp = auth_client_lecteur.post(self.URL, {
            'organisation': organisation.id,
            'name': 'App Lecteur',
            'slug': 'app-lecteur',
        })
        assert resp.status_code == 403

    def test_post_autorise_admin(self, auth_client_admin, organisation):
        resp = auth_client_admin.post(self.URL, {
            'organisation': organisation.id,
            'name': 'App Admin',
            'slug': 'app-admin',
        })
        assert resp.status_code == 201

    def test_get_config_autorise_lecteur(self, auth_client_lecteur, application):
        resp = auth_client_lecteur.get(f'{self.URL}{application.slug}/config/')
        assert resp.status_code == 200

    def test_get_layers_autorise_lecteur(self, auth_client_lecteur, application):
        resp = auth_client_lecteur.get(f'{self.URL}{application.slug}/layers/')
        assert resp.status_code == 200

    def test_delete_refuse_lecteur(self, auth_client_lecteur, application):
        resp = auth_client_lecteur.delete(f'{self.URL}{application.slug}/')
        assert resp.status_code == 403


# ─────────────────────────────────────────────────────────────────
# Endpoint tests — ApplicationLayerViewSet
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestApplicationLayerViewSetPermissions:

    URL = '/api/app-layers/'

    def test_get_autorise_lecteur(self, auth_client_lecteur, layer_wms):
        resp = auth_client_lecteur.get(self.URL)
        assert resp.status_code == 200

    def test_get_refuse_anonyme(self, api_client, layer_wms):
        resp = api_client.get(self.URL)
        assert resp.status_code in (401, 403)  # DRF retourne 403 sans BasicAuthentication

    def test_post_refuse_lecteur(self, auth_client_lecteur, application):
        resp = auth_client_lecteur.post(self.URL, {
            'application': application.pk,
            'name': 'Ma Couche',
            'geoserver_layer': 'ws:couche',
            'layer_type': 'WMS',
        }, format='json')
        assert resp.status_code == 403

    def test_post_format_invalide_renvoie_400(self, auth_client_admin, application):
        """validate_geoserver_layer() doit rejeter un format sans ':'."""
        resp = auth_client_admin.post(self.URL, {
            'application': application.pk,
            'name': 'Couche fantôme',
            'geoserver_layer': 'couchesunsworkspace',   # format invalide
            'layer_type': 'WMS',
        }, format='json')
        assert resp.status_code == 400
        assert 'geoserver_layer' in resp.data

    def test_post_format_valide_cree_couche(self, auth_client_admin, application):
        resp = auth_client_admin.post(self.URL, {
            'application': application.pk,
            'name': 'Couche valide',
            'geoserver_layer': 'ws:couchevalide',
            'layer_type': 'WMS',
        }, format='json')
        assert resp.status_code == 201

    def test_delete_refuse_lecteur(self, auth_client_lecteur, layer_wms):
        resp = auth_client_lecteur.delete(f'{self.URL}{layer_wms.id}/')
        assert resp.status_code == 403


# ─────────────────────────────────────────────────────────────────
# Endpoint tests — UserProfileViewSet (isolation par organisation)
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUserProfileOrgIsolation:

    URL = '/api/user-profiles/'

    @pytest.fixture
    def autre_org(self, db):
        return Organisation.objects.create(name="Autre Org", slug="autre-org")

    @pytest.fixture
    def user_autre_org(self, db, autre_org):
        """Utilisateur dans une organisation différente."""
        user = User.objects.create_user(username="user_autre", password="x")
        UserProfile.objects.create(user=user, organisation=autre_org, role="lecteur")
        return user

    def _usernames(self, resp):
        """Extrait les usernames depuis une réponse paginée ou non."""
        data = resp.data.get('results', resp.data) if isinstance(resp.data, dict) else resp.data
        return [p['username'] for p in data]

    def test_admin_voit_tous_les_profils(self, auth_client_admin, user_lecteur, user_autre_org):
        resp = auth_client_admin.get(self.URL)
        assert resp.status_code == 200
        usernames = self._usernames(resp)
        assert user_lecteur.username in usernames
        assert user_autre_org.username in usernames

    def test_lecteur_voit_uniquement_sa_propre_org(
        self, auth_client_lecteur, user_lecteur, user_autre_org
    ):
        resp = auth_client_lecteur.get(self.URL)
        assert resp.status_code == 200
        usernames = self._usernames(resp)
        # Son propre profil doit apparaître
        assert user_lecteur.username in usernames
        # L'utilisateur de l'autre org ne doit PAS apparaître
        assert user_autre_org.username not in usernames


# ─────────────────────────────────────────────────────────────────
# Validation modèle — ApplicationLayer.clean()
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestApplicationLayerClean:

    def _make_layer(self, application, geoserver_layer):
        return ApplicationLayer(
            application=application,
            name="Test",
            geoserver_layer=geoserver_layer,
            layer_type="WMS",
        )

    def test_format_sans_deux_points_leve_erreur(self, application):
        layer = self._make_layer(application, "couche_sans_workspace")
        with pytest.raises(ValidationError) as exc_info:
            layer.clean()
        assert 'geoserver_layer' in exc_info.value.message_dict

    def test_workspace_vide_leve_erreur(self, application):
        layer = self._make_layer(application, ":nom_couche")
        with pytest.raises(ValidationError) as exc_info:
            layer.clean()
        assert 'geoserver_layer' in exc_info.value.message_dict

    def test_nom_vide_leve_erreur(self, application):
        layer = self._make_layer(application, "workspace:")
        with pytest.raises(ValidationError) as exc_info:
            layer.clean()
        assert 'geoserver_layer' in exc_info.value.message_dict

    def test_format_valide_ne_leve_pas_erreur(self, application, settings):
        # Désactiver la vérification GeoServer pour ce test unitaire de format :
        # on teste uniquement le parsing workspace:nom, pas l'existence sur GeoServer.
        settings.GEOSERVER_URL = None
        layer = self._make_layer(application, "eneo_gis_ws:cmrReseauHTB")
        layer.clean()   # aucune exception attendue

    def test_champ_vide_accepte(self, application):
        """Un champ vide est accepté par clean() (blank=True sur le modèle)."""
        layer = self._make_layer(application, "")
        layer.clean()   # aucune exception attendue


# ─────────────────────────────────────────────────────────────────
# Validation modèle — DashboardWidget.clean()
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDashboardWidgetClean:

    @pytest.fixture
    def dashboard(self, db, application, user_admin):
        return Dashboard.objects.create(
            application=application,
            created_by=user_admin,
            name="Dashboard test",
        )

    def _make_widget(self, dashboard, geoserver_layer):
        return DashboardWidget(
            dashboard=dashboard,
            title="Widget",
            geoserver_layer=geoserver_layer,
            chart_type="bar",
        )

    def test_format_invalide_leve_erreur(self, dashboard):
        widget = self._make_widget(dashboard, "couche_sans_workspace")
        with pytest.raises(ValidationError) as exc_info:
            widget.clean()
        assert 'geoserver_layer' in exc_info.value.message_dict

    def test_format_valide_ne_leve_pas_erreur(self, dashboard):
        widget = self._make_widget(dashboard, "eneo_gis_ws:cmrPosteSource")
        widget.clean()   # aucune exception attendue


# ─────────────────────────────────────────────────────────────────
# Endpoint tests — scope organisation (4.2)
# Vérifie que chaque user ne voit que les ressources de sa propre org.
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestOrgScopingApplications:
    """
    Un utilisateur non-superuser ne doit voir que les applications
    de son organisation — même s'il existe des applications dans d'autres orgs.
    """

    URL = '/api/applications/'

    @pytest.fixture
    def autre_org(self, db):
        return Organisation.objects.create(
            name="Autre Org", slug="autre-org-apps",
            module_incidents=True, module_interventions=True,
            module_analytics=True, module_export=True, module_editor=True,
        )

    @pytest.fixture
    def app_autre_org(self, db, autre_org, user_admin):
        """Application appartenant à une org différente de celle du lecteur."""
        return Application.objects.create(
            organisation=autre_org,
            name="App Autre Org",
            slug="app-autre-org",
            created_by=user_admin,
        )

    def _slugs(self, resp):
        data = resp.data.get('results', resp.data) if isinstance(resp.data, dict) else resp.data
        return [a['slug'] for a in data]

    def test_lecteur_voit_app_de_sa_propre_org(
        self, auth_client_lecteur, application, app_autre_org
    ):
        """L'application de sa propre org doit être visible."""
        resp = auth_client_lecteur.get(self.URL)
        assert resp.status_code == 200
        assert application.slug in self._slugs(resp)

    def test_lecteur_ne_voit_pas_app_autre_org(
        self, auth_client_lecteur, application, app_autre_org
    ):
        """L'application d'une autre org ne doit PAS être visible."""
        resp = auth_client_lecteur.get(self.URL)
        assert resp.status_code == 200
        assert app_autre_org.slug not in self._slugs(resp)

    def test_superuser_voit_toutes_les_apps(
        self, auth_client_superuser, application, app_autre_org
    ):
        """Le superuser doit voir les applications de toutes les organisations."""
        resp = auth_client_superuser.get(self.URL)
        assert resp.status_code == 200
        slugs = self._slugs(resp)
        assert application.slug in slugs
        assert app_autre_org.slug in slugs


@pytest.mark.django_db
class TestOrgScopingLayers:
    """
    Les couches cartographiques sont scoppées par organisation
    via leur application parente.
    """

    URL = '/api/app-layers/'

    @pytest.fixture
    def autre_org(self, db):
        return Organisation.objects.create(
            name="Autre Org Layers", slug="autre-org-layers",
            module_incidents=True, module_interventions=True,
            module_analytics=True, module_export=True, module_editor=True,
        )

    @pytest.fixture
    def app_autre_org(self, db, autre_org, user_admin):
        return Application.objects.create(
            organisation=autre_org,
            name="App Autre Org",
            slug="app-autre-org-layers",
            created_by=user_admin,
        )

    @pytest.fixture
    def layer_autre_org(self, db, app_autre_org):
        return ApplicationLayer.objects.create(
            application=app_autre_org,
            name="Couche Autre Org",
            geoserver_layer="autre_ws:couche",
            layer_type="WMS",
        )

    def _ids(self, resp):
        data = resp.data.get('results', resp.data) if isinstance(resp.data, dict) else resp.data
        return [l['id'] for l in data]

    def test_lecteur_voit_couches_sa_propre_org(
        self, auth_client_lecteur, layer_wms, layer_autre_org
    ):
        resp = auth_client_lecteur.get(self.URL)
        assert resp.status_code == 200
        assert layer_wms.id in self._ids(resp)

    def test_lecteur_ne_voit_pas_couches_autre_org(
        self, auth_client_lecteur, layer_wms, layer_autre_org
    ):
        resp = auth_client_lecteur.get(self.URL)
        assert resp.status_code == 200
        assert layer_autre_org.id not in self._ids(resp)

    def test_superuser_voit_toutes_les_couches(
        self, auth_client_superuser, layer_wms, layer_autre_org
    ):
        resp = auth_client_superuser.get(self.URL)
        assert resp.status_code == 200
        ids = self._ids(resp)
        assert layer_wms.id in ids
        assert layer_autre_org.id in ids
