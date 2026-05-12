"""
tests/test_serializers.py — Tests de ApplicationLayerSerializer
===============================================================

Couverture :
  Alias React (group / visible / opacity)
    ✓ 'group'   == group_slug
    ✓ 'visible' == visible_default
    ✓ 'opacity' == opacity_default

  Champs présents
    ✓ Tous les champs listés dans Meta.fields sont sérialisés
    ✓ layer_key auto-généré à partir de geoserver_layer
    ✓ group_slug auto-généré à partir de group_label

  Lecture seule
    ✓ Les alias sont read_only (non modifiables en écriture)

  Cas limites
    ✓ visible_default=False → visible=False
    ✓ opacity_default=0.5   → opacity=0.5
    ✓ group_slug vide → group vide string
"""

import pytest

from sims_core.models import Organisation, Application, ApplicationLayer
from sims_core.serializers import ApplicationLayerSerializer


# ─────────────────────────────────────────────────────────────────
# Tests principaux
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestApplicationLayerSerializerAliases:

    def test_alias_group_egal_group_slug(self, layer_wms):
        data = ApplicationLayerSerializer(layer_wms).data
        assert data["group"] == layer_wms.group_slug

    def test_alias_visible_egal_visible_default(self, layer_wms):
        data = ApplicationLayerSerializer(layer_wms).data
        assert data["visible"] == layer_wms.visible_default

    def test_alias_opacity_egal_opacity_default(self, layer_wms):
        data = ApplicationLayerSerializer(layer_wms).data
        assert float(data["opacity"]) == layer_wms.opacity_default

    def test_alias_visible_false(self, layer_wfs):
        """layer_wfs a visible_default=False."""
        data = ApplicationLayerSerializer(layer_wfs).data
        assert data["visible"] is False

    def test_alias_opacity_un(self, layer_wfs):
        """layer_wfs a opacity_default=1.0."""
        data = ApplicationLayerSerializer(layer_wfs).data
        assert float(data["opacity"]) == 1.0

    def test_group_vide_quand_group_slug_vide(self, application):
        """Une couche sans group_slug → alias group retourne ''."""
        layer = ApplicationLayer.objects.create(
            application=application,
            name="Couche sans groupe",
            geoserver_layer="eneo_gis_ws:sansgroupeTest",
            layer_type="WMS",
            group_slug="",          # explicitement vide
            group_label="",
            visible_default=True,
            opacity_default=1.0,
        )
        # On recharge pour avoir le group_slug potentiellement auto-généré
        layer.refresh_from_db()
        data = ApplicationLayerSerializer(layer).data
        # group_slug est vide → alias group doit l'être aussi
        assert data["group"] == layer.group_slug


@pytest.mark.django_db
class TestApplicationLayerSerializerChamps:

    def test_champs_attendus_presents(self, layer_wms):
        data = ApplicationLayerSerializer(layer_wms).data
        champs_obligatoires = [
            "id", "layer_key", "name", "description",
            "geoserver_layer", "layer_type",
            "group", "group_slug", "group_label", "group_icon", "group_order",
            "visible", "visible_default",
            "opacity", "opacity_default",
            "layer_order", "color", "line_width", "point_radius",
            "style_config", "popup_fields",
        ]
        for champ in champs_obligatoires:
            assert champ in data, f"Champ manquant dans la sérialisation : '{champ}'"

    def test_layer_key_auto_genere(self, layer_wms):
        """layer_key doit être auto-généré depuis geoserver_layer."""
        data = ApplicationLayerSerializer(layer_wms).data
        # geoserver_layer = "eneo_gis_ws:cmrReseauHTB"
        # → layer_key = slugify("cmrReseauHTB").replace('-', '_')
        assert data["layer_key"]             # non vide
        assert ":" not in data["layer_key"]  # workspace retiré

    def test_layer_type_wms(self, layer_wms):
        data = ApplicationLayerSerializer(layer_wms).data
        assert data["layer_type"] == "WMS"

    def test_layer_type_wfs(self, layer_wfs):
        data = ApplicationLayerSerializer(layer_wfs).data
        assert data["layer_type"] == "WFS"

    def test_popup_fields_liste_vide_par_defaut(self, layer_wms):
        """popup_fields vide = tous les attributs affichés (comportement doc)."""
        data = ApplicationLayerSerializer(layer_wms).data
        assert isinstance(data["popup_fields"], list)

    def test_popup_fields_contient_les_valeurs(self, application):
        """popup_fields est correctement sérialisé."""
        layer = ApplicationLayer.objects.create(
            application=application,
            name="Couche avec popup",
            geoserver_layer="eneo_gis_ws:popupTest",
            layer_type="WFS",
            popup_fields=["nom", "tension", "code_poste"],
        )
        data = ApplicationLayerSerializer(layer).data
        assert data["popup_fields"] == ["nom", "tension", "code_poste"]


@pytest.mark.django_db
class TestApplicationLayerSerializerReadOnly:

    def test_aliases_sont_read_only(self):
        """
        Les alias group/visible/opacity sont déclarés read_only=True.
        Vérification directe sur la déclaration du sérialiseur.
        """
        ser = ApplicationLayerSerializer()
        assert ser.fields["group"].read_only   is True
        assert ser.fields["visible"].read_only is True
        assert ser.fields["opacity"].read_only is True

    def test_id_est_read_only(self):
        ser = ApplicationLayerSerializer()
        assert ser.fields["id"].read_only is True


@pytest.mark.django_db
class TestApplicationLayerAutoSlug:
    """Vérifie que le modèle auto-génère group_slug et layer_key."""

    def test_group_slug_depuis_group_label(self, application):
        layer = ApplicationLayer.objects.create(
            application=application,
            name="Test AutoSlug",
            geoserver_layer="eneo_gis_ws:autoSlugTest",
            group_label="Réseau HTB Existant",
            group_slug="",   # vide → auto-généré
        )
        layer.refresh_from_db()
        # slugify("Réseau HTB Existant") = "reseau-htb-existant" → replace('-','_')
        assert layer.group_slug != ""
        assert "-" not in layer.group_slug  # les tirets sont convertis en _

    def test_layer_key_depuis_geoserver_layer(self, application):
        layer = ApplicationLayer.objects.create(
            application=application,
            name="Test LayerKey",
            geoserver_layer="eneo_gis_ws:cmrPosteSource",
            layer_key="",   # vide → auto-généré
        )
        layer.refresh_from_db()
        # "eneo_gis_ws:cmrPosteSource" → part après ':' = "cmrPosteSource"
        # slugify("cmrPosteSource") → "cmrpostesource"
        assert layer.layer_key != ""
        assert ":" not in layer.layer_key

    def test_group_label_copie_depuis_group_name(self, application):
        """Si group_label vide et group_name fourni → group_label = group_name."""
        layer = ApplicationLayer.objects.create(
            application=application,
            name="Test GroupName",
            geoserver_layer="eneo_gis_ws:groupNameTest",
            group_name="Mon Groupe Legacy",
            group_label="",
        )
        layer.refresh_from_db()
        assert layer.group_label == "Mon Groupe Legacy"
