"""
tests/test_models.py — Tests des modèles Incident & Intervention
================================================================

Couverture :
  Incident
    ✓ marquer_en_cours() → statut EN_COURS, date_prise_charge renseignée
    ✓ marquer_en_cours(utilisateur) → assigne_a affecté si vide
    ✓ marquer_en_cours() idempotent sur date_prise_charge
    ✓ marquer_en_cours() n'écrase pas un assigne_a existant
    ✓ marquer_resolu() → statut RESOLU, date_resolution renseignée
    ✓ marquer_resolu() idempotent sur date_resolution
    ✓ coords property (lat/lng renseignés et non renseignés)
    ✓ nb_interventions property

  Intervention
    ✓ demarrer() → statut EN_COURS, date_debut renseignée
    ✓ demarrer(utilisateur) → responsable affecté si vide
    ✓ demarrer() appelle incident.marquer_en_cours()
    ✓ demarrer() n'écrase pas un responsable existant
    ✓ cloturer() → statut TERMINEE, date_fin renseignée
    ✓ cloturer(rapport) → rapport sauvegardé
    ✓ cloturer() cascade → incident.marquer_resolu() si toutes interventions terminées
    ✓ cloturer() ne résout PAS l'incident si d'autres interventions actives
    ✓ duree_reelle_minutes property (avec et sans date_fin)
"""

import pytest
from django.utils import timezone

from sims_network.models import (
    Incident,
    IncidentStatut,
    Intervention,
    InterventionStatut,
)


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

def make_incident(**kwargs):
    defaults = dict(
        titre="Test incident",
        type_incident=None,
        statut=IncidentStatut.OUVERT,
        priorite="moyenne",
    )
    defaults.update(kwargs)
    return Incident.objects.create(**defaults)


def make_intervention(incident, **kwargs):
    defaults = dict(
        type_travaux="reparation",
        statut=InterventionStatut.PLANIFIEE,
    )
    defaults.update(kwargs)
    return Intervention.objects.create(incident=incident, **defaults)


# ─────────────────────────────────────────────────────────────────
# Tests Incident.marquer_en_cours()
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestIncidentMarquerEnCours:

    def test_statut_passe_a_en_cours(self):
        inc = make_incident()
        inc.marquer_en_cours()
        inc.refresh_from_db()
        assert inc.statut == IncidentStatut.EN_COURS

    def test_date_prise_charge_renseignee(self):
        inc = make_incident()
        assert inc.date_prise_charge is None
        inc.marquer_en_cours()
        inc.refresh_from_db()
        assert inc.date_prise_charge is not None

    def test_idempotent_date_prise_charge(self):
        """Appeler deux fois ne doit pas changer la date_prise_charge."""
        inc = make_incident()
        inc.marquer_en_cours()
        inc.refresh_from_db()
        date_premiere_prise = inc.date_prise_charge

        inc.marquer_en_cours()
        inc.refresh_from_db()
        assert inc.date_prise_charge == date_premiere_prise

    def test_assigne_a_affecte_si_vide(self, user_operateur):
        inc = make_incident()
        assert inc.assigne_a is None
        inc.marquer_en_cours(utilisateur=user_operateur)
        inc.refresh_from_db()
        assert inc.assigne_a == user_operateur

    def test_assigne_a_non_ecrase_si_deja_renseigne(self, user_operateur, user_lecteur):
        inc = make_incident(assigne_a=user_lecteur)
        inc.marquer_en_cours(utilisateur=user_operateur)
        inc.refresh_from_db()
        # Le responsable original ne doit pas être remplacé
        assert inc.assigne_a == user_lecteur

    def test_sans_utilisateur_assigne_reste_vide(self):
        inc = make_incident()
        inc.marquer_en_cours()
        inc.refresh_from_db()
        assert inc.assigne_a is None


# ─────────────────────────────────────────────────────────────────
# Tests Incident.marquer_resolu()
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestIncidentMarquerResolu:

    def test_statut_passe_a_resolu(self):
        inc = make_incident(statut=IncidentStatut.EN_COURS)
        inc.marquer_resolu()
        inc.refresh_from_db()
        assert inc.statut == IncidentStatut.RESOLU

    def test_date_resolution_renseignee(self):
        inc = make_incident(statut=IncidentStatut.EN_COURS)
        assert inc.date_resolution is None
        inc.marquer_resolu()
        inc.refresh_from_db()
        assert inc.date_resolution is not None

    def test_idempotent_date_resolution(self):
        """Appeler deux fois ne doit pas changer la date_resolution."""
        inc = make_incident(statut=IncidentStatut.EN_COURS)
        inc.marquer_resolu()
        inc.refresh_from_db()
        date_premiere_resolution = inc.date_resolution

        inc.marquer_resolu()
        inc.refresh_from_db()
        assert inc.date_resolution == date_premiere_resolution

    def test_depuis_statut_ouvert(self):
        """On peut résoudre directement depuis OUVERT."""
        inc = make_incident(statut=IncidentStatut.OUVERT)
        inc.marquer_resolu()
        inc.refresh_from_db()
        assert inc.statut == IncidentStatut.RESOLU


# ─────────────────────────────────────────────────────────────────
# Tests Incident properties
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestIncidentProperties:

    def test_coords_avec_lat_lng(self):
        inc = make_incident(latitude=3.848, longitude=11.502)
        assert inc.coords == (3.848, 11.502)

    def test_coords_sans_coordonnees(self):
        inc = make_incident()
        assert inc.coords is None

    def test_coords_lat_seulement(self):
        inc = make_incident(latitude=3.848, longitude=None)
        assert inc.coords is None

    def test_nb_interventions_zero(self):
        inc = make_incident()
        assert inc.nb_interventions == 0

    def test_nb_interventions_compte(self):
        inc = make_incident()
        make_intervention(inc)
        make_intervention(inc)
        assert inc.nb_interventions == 2


# ─────────────────────────────────────────────────────────────────
# Tests Intervention.demarrer()
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestInterventionDemarrer:

    def test_statut_passe_a_en_cours(self):
        inc = make_incident()
        itv = make_intervention(inc)
        itv.demarrer()
        itv.refresh_from_db()
        assert itv.statut == InterventionStatut.EN_COURS

    def test_date_debut_renseignee(self):
        inc = make_incident()
        itv = make_intervention(inc)
        assert itv.date_debut is None
        itv.demarrer()
        itv.refresh_from_db()
        assert itv.date_debut is not None

    def test_responsable_affecte_si_vide(self, user_operateur):
        inc = make_incident()
        itv = make_intervention(inc)
        assert itv.responsable is None
        itv.demarrer(utilisateur=user_operateur)
        itv.refresh_from_db()
        assert itv.responsable == user_operateur

    def test_responsable_non_ecrase(self, user_operateur, user_lecteur):
        inc = make_incident()
        itv = make_intervention(inc, responsable=user_lecteur)
        itv.demarrer(utilisateur=user_operateur)
        itv.refresh_from_db()
        assert itv.responsable == user_lecteur

    def test_demarrer_cascade_incident_en_cours(self):
        """demarrer() doit mettre l'incident en EN_COURS via cascade."""
        inc = make_incident(statut=IncidentStatut.OUVERT)
        itv = make_intervention(inc)
        itv.demarrer()
        inc.refresh_from_db()
        assert inc.statut == IncidentStatut.EN_COURS

    def test_demarrer_incident_deja_en_cours(self):
        """demarrer() sur un incident déjà EN_COURS ne casse pas."""
        inc = make_incident(statut=IncidentStatut.EN_COURS)
        itv = make_intervention(inc)
        itv.demarrer()   # ne doit pas lever d'exception
        inc.refresh_from_db()
        assert inc.statut == IncidentStatut.EN_COURS


# ─────────────────────────────────────────────────────────────────
# Tests Intervention.cloturer()
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestInterventionCloturer:

    def test_statut_passe_a_terminee(self):
        inc = make_incident(statut=IncidentStatut.EN_COURS)
        itv = make_intervention(inc, statut=InterventionStatut.EN_COURS)
        itv.cloturer()
        itv.refresh_from_db()
        assert itv.statut == InterventionStatut.TERMINEE

    def test_date_fin_renseignee(self):
        inc = make_incident(statut=IncidentStatut.EN_COURS)
        itv = make_intervention(inc, statut=InterventionStatut.EN_COURS)
        assert itv.date_fin is None
        itv.cloturer()
        itv.refresh_from_db()
        assert itv.date_fin is not None

    def test_rapport_sauvegarde(self):
        inc = make_incident(statut=IncidentStatut.EN_COURS)
        itv = make_intervention(inc, statut=InterventionStatut.EN_COURS)
        itv.cloturer(rapport="Fusibles remplacés, réseau rétabli.")
        itv.refresh_from_db()
        assert itv.rapport == "Fusibles remplacés, réseau rétabli."

    def test_rapport_vide_par_defaut(self):
        inc = make_incident(statut=IncidentStatut.EN_COURS)
        itv = make_intervention(inc, statut=InterventionStatut.EN_COURS)
        itv.cloturer()
        itv.refresh_from_db()
        assert itv.rapport == ""

    def test_cascade_resoudre_incident_si_toutes_terminees(self):
        """
        Quand toutes les interventions d'un incident sont TERMINÉE ou ANNULÉE,
        l'incident doit passer à RESOLU.
        """
        inc = make_incident(statut=IncidentStatut.EN_COURS)
        itv1 = make_intervention(inc, statut=InterventionStatut.EN_COURS)
        # Clôture l'unique intervention → incident résolu
        itv1.cloturer()
        inc.refresh_from_db()
        assert inc.statut == IncidentStatut.RESOLU

    def test_cascade_ne_resout_pas_si_autre_intervention_active(self):
        """
        Si une autre intervention est encore EN_COURS,
        l'incident ne doit pas être résolu.
        """
        inc = make_incident(statut=IncidentStatut.EN_COURS)
        itv1 = make_intervention(inc, statut=InterventionStatut.EN_COURS)
        _ = make_intervention(inc, statut=InterventionStatut.EN_COURS)

        itv1.cloturer()
        inc.refresh_from_db()
        # itv2 est encore EN_COURS, donc l'incident reste EN_COURS
        assert inc.statut == IncidentStatut.EN_COURS

    def test_cascade_resout_avec_une_annulee_et_une_terminee(self):
        """
        ANNULEE est comptée comme 'non active', donc si on a
        une TERMINEE + une ANNULEE → incident résolu.
        """
        inc = make_incident(statut=IncidentStatut.EN_COURS)
        make_intervention(inc, statut=InterventionStatut.ANNULEE)
        itv_active = make_intervention(inc, statut=InterventionStatut.EN_COURS)
        itv_active.cloturer()
        inc.refresh_from_db()
        assert inc.statut == IncidentStatut.RESOLU


# ─────────────────────────────────────────────────────────────────
# Tests Intervention.duree_reelle_minutes
# ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestInterventionDureeReelle:

    def test_sans_date_debut_et_fin(self):
        inc = make_incident()
        itv = make_intervention(inc)
        assert itv.duree_reelle_minutes is None

    def test_sans_date_fin(self):
        inc = make_incident()
        itv = make_intervention(inc)
        itv.date_debut = timezone.now()
        itv.save()
        assert itv.duree_reelle_minutes is None

    def test_duree_calculee(self):
        from datetime import timedelta
        inc = make_incident()
        itv = make_intervention(inc)
        now = timezone.now()
        itv.date_debut = now
        itv.date_fin = now + timedelta(minutes=45)
        itv.save()
        assert itv.duree_reelle_minutes == 45

    def test_duree_arrondie_en_minutes(self):
        from datetime import timedelta
        inc = make_incident()
        itv = make_intervention(inc)
        now = timezone.now()
        itv.date_debut = now
        itv.date_fin = now + timedelta(hours=2, minutes=30)
        itv.save()
        assert itv.duree_reelle_minutes == 150
