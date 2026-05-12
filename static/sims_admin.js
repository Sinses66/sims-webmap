/**
 * sims_admin.js — Customisations JS pour l'admin SIMS
 * =====================================================
 * • Override du texte "Jazzmin X.X.X" dans le footer (fallback JS si CSS insuffisant)
 * • Ajout d'un badge version SIMS dans le brand
 */

(function () {
  'use strict';

  function applyFooter() {
    const footer = document.querySelector('.main-footer');
    if (!footer) return;

    // Réécriture complète du footer — supprime tout contenu Jazzmin
    footer.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;' +
      'padding:0.5rem 1rem;font-size:.75rem;font-family:Inter,sans-serif;">' +
        '<span style="color:#6b7f96;">' +
          '© 2026 Powered by ' +
          '<span style="color:#00AADD;font-weight:600;">GeoEco Systems</span>' +
          '. All rights reserved.' +
        '</span>' +
        '<span style="color:#6b7f96;font-family:Poppins,sans-serif;font-weight:600;letter-spacing:.3px;">' +
          'SIMS Administration' +
        '</span>' +
      '</div>';
  }

  // Exécuter après chargement DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyFooter);
  } else {
    applyFooter();
  }
})();
