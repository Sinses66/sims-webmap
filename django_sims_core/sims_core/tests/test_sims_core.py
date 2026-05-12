"""Tests de fumée — sims_core"""
import pytest

@pytest.mark.django_db
def test_apps_load():
    """Vérifie que les apps Django se chargent correctement."""
    from django.apps import apps
    assert apps.get_app_config('sims_core') is not None
