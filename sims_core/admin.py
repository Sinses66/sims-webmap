import json
from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from .models import Organisation, Application, ApplicationLayer, UserProfile, MapAnnotation, MapBookmark, Dashboard, DashboardWidget


# ─────────────────────────────────────────────────────────────────
# Helpers multi-tenant
# ─────────────────────────────────────────────────────────────────
def _get_admin_org(user):
    """Retourne l'organisation de l'admin connecté, ou None pour les superusers."""
    if user.is_superuser:
        return None
    profile = getattr(user, 'profile', None)
    return profile.organisation if profile else None


def _is_scoped(user):
    """True si l'utilisateur est org-admin (is_staff mais pas superuser)."""
    return user.is_staff and not user.is_superuser


# ─────────────────────────────────────────────────────────────────
# Mixin de scoping par organisation
# ─────────────────────────────────────────────────────────────────
class OrgScopedMixin:
    """
    Mixin à ajouter aux ModelAdmin pour filtrer automatiquement les données
    par l'organisation de l'utilisateur connecté (org-admin).
    Les superusers voient toujours toutes les données.

    Attributs de classe :
      _org_filter : chemin ORM vers le champ organisation
                    ex: 'organisation', 'application__organisation'
      _org_setter : nom du champ à remplir auto à la création.
                    None = pas de remplissage auto.
    """
    _org_filter = 'organisation'
    _org_setter = 'organisation'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not _is_scoped(request.user):
            return qs
        org = _get_admin_org(request.user)
        return qs.filter(**{self._org_filter: org}) if org else qs.none()

    def save_model(self, request, obj, form, change):
        if _is_scoped(request.user) and not change and self._org_setter:
            org = _get_admin_org(request.user)
            if org:
                setattr(obj, self._org_setter, org)
        super().save_model(request, obj, form, change)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """Limite les FK organisation/application aux entités de l'org de l'admin."""
        if _is_scoped(request.user):
            org = _get_admin_org(request.user)
            if org:
                if db_field.name == 'organisation':
                    kwargs['queryset'] = Organisation.objects.filter(pk=org.pk)
                elif db_field.name == 'application':
                    kwargs['queryset'] = Application.objects.filter(organisation=org)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    # ── Permissions : les org-admins ont tous les droits sur leurs données ──
    def has_module_perms(self, request):
        if _is_scoped(request.user):
            return True
        return super().has_module_perms(request)

    def has_view_permission(self, request, obj=None):
        if _is_scoped(request.user):
            return True
        return super().has_view_permission(request, obj)

    def has_add_permission(self, request):
        if _is_scoped(request.user):
            return True
        return super().has_add_permission(request)

    def has_change_permission(self, request, obj=None):
        if _is_scoped(request.user):
            return True
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if _is_scoped(request.user):
            return True
        return super().has_delete_permission(request, obj)


# ─────────────────────────────────────────────────────────────────
# Widget dual listbox — sélection d'attributs GeoServer
# ─────────────────────────────────────────────────────────────────
WIDGET_MODES = {
    'popup': {
        'left_label':   'Attributs disponibles',
        'right_label':  'Champs affichés dans le popup',
        'hint':         "💡 Vide = tous les attributs de la couche sont affichés dans le popup.",
        'right_hint':   "Ordre = ordre d'affichage dans le popup",
    },
    'attributes': {
        'left_label':   'Attributs disponibles',
        'right_label':  'Attributs analysés par le widget',
        'hint':         "💡 Sélectionnez 1 attribut (camembert/donut/barres) ou 2 (barres groupées). Ordre = ordre d'analyse.",
        'right_hint':   "Ordre = ordre d'analyse du graphique",
    },
}


class PopupFieldsWidget(forms.Widget):
    """
    Widget dual listbox pour les champs JSONField listant des attributs GeoServer.
    """

    def __init__(self, mode='popup', attrs=None):
        self.mode = mode if mode in WIDGET_MODES else 'popup'
        super().__init__(attrs)

    def render(self, name, value, attrs=None, renderer=None):
        if isinstance(value, list):
            current = value
        elif value and value != 'null':
            try:
                current = json.loads(value)
            except (TypeError, ValueError):
                current = []
        else:
            current = []
        if not isinstance(current, list):
            current = []
        current_json = json.dumps(current)
        widget_id = attrs.get('id', f'id_{name}') if attrs else f'id_{name}'

        labels = WIDGET_MODES[self.mode]
        left_label  = labels['left_label']
        right_label = labels['right_label']
        hint_text   = labels['hint']
        right_hint  = labels['right_hint']

        html = f"""
<div style="margin-top:8px;">
  <input type="hidden" name="{name}" id="{widget_id}" value='{current_json}'>

  <div style="display:flex;gap:20px;align-items:flex-start;">

    <!-- Colonne gauche : attributs disponibles -->
    <div style="flex:1;">
      <label style="font-size:12px;font-weight:bold;color:#666;display:block;margin-bottom:4px;">
        {left_label}
      </label>
      <select id="{widget_id}_available" multiple size="12"
              style="width:100%;min-height:220px;border:1px solid #ccc;border-radius:4px;
                     padding:4px;font-size:13px;background:#fafafa;">
        <option disabled value="">— Sauvegardez d'abord la couche —</option>
      </select>
      <p style="font-size:11px;color:#999;margin-top:4px;">
        Double-clic ou sélection + → pour ajouter
      </p>
    </div>

    <!-- Flèches de transfert -->
    <div style="display:flex;flex-direction:column;gap:8px;justify-content:center;
                padding-top:36px;">
      <button type="button" id="{widget_id}_btn_add"
              title="Ajouter au popup"
              style="padding:6px 14px;border:1px solid #007bff;background:#007bff;
                     color:#fff;border-radius:4px;cursor:pointer;font-size:16px;">
        →
      </button>
      <button type="button" id="{widget_id}_btn_remove"
              title="Retirer du popup"
              style="padding:6px 14px;border:1px solid #dc3545;background:#dc3545;
                     color:#fff;border-radius:4px;cursor:pointer;font-size:16px;">
        ←
      </button>
      <button type="button" id="{widget_id}_btn_up"
              title="Monter"
              style="padding:4px 10px;border:1px solid #6c757d;background:#6c757d;
                     color:#fff;border-radius:4px;cursor:pointer;font-size:13px;margin-top:8px;">
        ↑
      </button>
      <button type="button" id="{widget_id}_btn_down"
              title="Descendre"
              style="padding:4px 10px;border:1px solid #6c757d;background:#6c757d;
                     color:#fff;border-radius:4px;cursor:pointer;font-size:13px;">
        ↓
      </button>
    </div>

    <!-- Colonne droite : champs sélectionnés -->
    <div style="flex:1;">
      <label style="font-size:12px;font-weight:bold;color:#666;display:block;margin-bottom:4px;">
        {right_label}
        <span id="{widget_id}_count"
              style="font-weight:normal;color:#999;margin-left:6px;">(0)</span>
      </label>
      <select id="{widget_id}_selected" multiple size="12"
              style="width:100%;min-height:220px;border:1px solid #28a745;border-radius:4px;
                     padding:4px;font-size:13px;background:#f0fff4;">
      </select>
          <p style="font-size:11px;color:#999;margin-top:4px;">
        {right_hint}
      </p>
    </div>

  </div>

  <!-- Bouton de rechargement manuel -->
  <div style="margin-top:10px;">
    <button type="button" id="{widget_id}_reload"
            style="padding:5px 14px;background:#17a2b8;color:#fff;border:none;
                   border-radius:4px;cursor:pointer;font-size:12px;">
      🔄 Recharger les attributs GeoServer
    </button>
    <span id="{widget_id}_status"
          style="margin-left:10px;font-size:11px;color:#666;"></span>
  </div>

  <p style="font-size:11px;color:#888;margin-top:8px;padding:6px 10px;
            background:#fffde7;border-left:3px solid #ffc107;border-radius:2px;">
    {hint_text}
  </p>
</div>

<script>
(function() {{
  var wid      = '{widget_id}';
  var hidden   = document.getElementById(wid);
  var avail    = document.getElementById(wid + '_available');
  var selected = document.getElementById(wid + '_selected');
  var count    = document.getElementById(wid + '_count');

  // ── Initialiser les champs déjà sauvegardés ─────────────────
  var current = {current_json};
  current.forEach(function(f) {{
    selected.add(new Option(f, f));
  }});
  updateCount();

  // ── Charger les attributs GeoServer ──────────────────────────
  function loadFields(layerName) {{
    if (!layerName) return;
    var statusEl = document.getElementById(wid + '_status');
    var apiUrl   = '/api/geoserver-fields/?layer=' + encodeURIComponent(layerName);
    avail.innerHTML = '<option disabled>Chargement…</option>';
    if (statusEl) statusEl.innerHTML = '⏳ Interrogation GeoServer… '
      + '<a href="' + apiUrl + '" target="_blank" style="font-size:10px;color:#007bff;">[tester]</a>';

    var csrf = '';
    document.cookie.split(';').forEach(function(c) {{
      var kv = c.trim().split('=');
      if (kv[0].trim() === 'csrftoken') csrf = decodeURIComponent(kv[1]);
    }});

    fetch(apiUrl, {{
      credentials: 'same-origin',
      headers: {{ 'X-CSRFToken': csrf, 'Accept': 'application/json' }}
    }})
    .then(function(r) {{
      if (!r.ok) throw new Error('HTTP ' + r.status + ' — vérifiez que GeoServer tourne sur le port configuré');
      return r.json();
    }})
    .then(function(data) {{
      if (data.error) {{
        avail.innerHTML = '<option disabled>Erreur serveur</option>';
        if (statusEl) statusEl.textContent = '❌ ' + data.error;
        return;
      }}
      avail.innerHTML = '';
      var selectedVals = Array.from(selected.options).map(function(o) {{ return o.value; }});
      var fields = data.fields || [];
      fields.forEach(function(field) {{
        var fname = field.name || field;
        if (!selectedVals.includes(fname)) {{
          avail.add(new Option(fname + ' (' + (field.type || 'string') + ')', fname));
        }}
      }});
      if (fields.length === 0) {{
        avail.innerHTML = '<option disabled>Aucun attribut WFS trouvé pour « ' + layerName + ' »</option>';
        if (statusEl) statusEl.textContent = '⚠ 0 attribut — couche publiée en WFS dans GeoServer ?';
      }} else {{
        if (statusEl) statusEl.textContent = '✅ ' + fields.length + ' attribut(s) chargé(s) depuis ' + layerName;
      }}
    }})
    .catch(function(err) {{
      avail.innerHTML = '<option disabled>Erreur — voir console navigateur (F12)</option>';
      if (statusEl) statusEl.textContent = '❌ ' + err.message;
      console.error('[PopupFieldsWidget] loadFields("' + layerName + '") :', err);
    }});
  }}

  function findGeoServerField() {{
    var self = document.getElementById(wid);
    var scope = (self && self.closest('form')) || document;
    return scope.querySelector('[name="geoserver_layer"]') ||
           scope.querySelector('[name$="-geoserver_layer"]') ||
           null;
  }}

  function attachGeoServerWatcher() {{
    var gsField = findGeoServerField();
    var statusEl = document.getElementById(wid + '_status');

    if (!gsField) {{
      if (statusEl) statusEl.textContent = '⚠ Champ geoserver_layer introuvable — rechargez la page';
      console.warn('[PopupFieldsWidget] champ geoserver_layer non trouvé dans le formulaire');
      return;
    }}

    if (gsField.value) {{
      loadFields(gsField.value);
    }} else {{
      if (statusEl) statusEl.textContent = '↑ Sélectionnez ou saisissez la couche GeoServer ci-dessus';
    }}

    var lastLoaded = '';
    function onGsFieldChange() {{
      var v = (this.value || '').trim();
      if (v && v !== lastLoaded) {{
        lastLoaded = v;
        loadFields(v);
      }}
    }}
    gsField.addEventListener('change', onGsFieldChange);
    gsField.addEventListener('input',  onGsFieldChange);

    var btn = document.getElementById(wid + '_reload');
    if (btn) {{
      btn.onclick = function() {{
        var gs = findGeoServerField();
        var v  = gs ? (gs.value || '').trim() : '';
        if (v) {{
          lastLoaded = '';
          loadFields(v);
        }} else {{
          if (statusEl) statusEl.textContent = '⚠ Aucune couche GeoServer définie dans le champ ci-dessus';
        }}
      }};
    }}
  }}

  if (document.readyState === 'loading') {{
    document.addEventListener('DOMContentLoaded', attachGeoServerWatcher);
  }} else {{
    attachGeoServerWatcher();
  }}

  document.getElementById(wid + '_btn_add').addEventListener('click', function() {{
    Array.from(avail.selectedOptions).forEach(function(opt) {{
      avail.removeChild(opt);
      selected.add(new Option(opt.text.split(' (')[0], opt.value));
    }});
    syncHidden();
  }});

  avail.addEventListener('dblclick', function() {{
    Array.from(avail.selectedOptions).forEach(function(opt) {{
      avail.removeChild(opt);
      selected.add(new Option(opt.text.split(' (')[0], opt.value));
    }});
    syncHidden();
  }});

  document.getElementById(wid + '_btn_remove').addEventListener('click', function() {{
    Array.from(selected.selectedOptions).forEach(function(opt) {{
      selected.removeChild(opt);
      avail.add(new Option(opt.value, opt.value));
    }});
    syncHidden();
  }});

  selected.addEventListener('dblclick', function() {{
    Array.from(selected.selectedOptions).forEach(function(opt) {{
      selected.removeChild(opt);
      avail.add(new Option(opt.value, opt.value));
    }});
    syncHidden();
  }});

  document.getElementById(wid + '_btn_up').addEventListener('click', function() {{
    Array.from(selected.selectedOptions).forEach(function(opt) {{
      var prev = opt.previousElementSibling;
      if (prev) selected.insertBefore(opt, prev);
    }});
    syncHidden();
  }});

  document.getElementById(wid + '_btn_down').addEventListener('click', function() {{
    Array.from(selected.selectedOptions).reverse().forEach(function(opt) {{
      var next = opt.nextElementSibling;
      if (next) selected.insertBefore(next, opt);
    }});
    syncHidden();
  }});

  function syncHidden() {{
    var fields = Array.from(selected.options).map(function(o) {{ return o.value; }});
    hidden.value = JSON.stringify(fields);
    updateCount();
  }}

  function updateCount() {{
    var n = selected.options.length;
    count.textContent = '(' + n + (n > 0 ? ' champ' + (n > 1 ? 's' : '') + ' sélectionné' + (n > 1 ? 's' : '') : '') + ')';
  }}

}})();
</script>
"""
        return mark_safe(html)

    def value_from_datadict(self, data, files, name):
        return data.get(name, '[]')


# ─────────────────────────────────────────────────────────────────
# Widget autocomplete — sélection d'une couche GeoServer
# ─────────────────────────────────────────────────────────────────
class GeoServerLayerWidget(forms.TextInput):
    """
    Input texte avec autocomplete via <datalist> HTML5.
    """

    def __init__(self, attrs=None):
        default_attrs = {
            'placeholder': 'ex: eneo_gis_ws:cmrReseauHTB  — tapez une partie du nom pour filtrer',
            'autocomplete': 'off',
            'style': 'width: 100%; max-width: 640px; font-family: monospace;',
        }
        if attrs:
            default_attrs.update(attrs)
        super().__init__(attrs=default_attrs)

    def render(self, name, value, attrs=None, renderer=None):
        widget_id    = (attrs or {}).get('id', f'id_{name}')
        datalist_id  = f'{widget_id}_dl'

        merged_attrs = {**(attrs or {}), 'list': datalist_id}
        input_html = super().render(name, value, merged_attrs, renderer)

        script = f"""
<datalist id="{datalist_id}"></datalist>
<div id="{widget_id}_status" style="font-size:11px;color:#888;margin-top:4px;"></div>
<script>
(function() {{
  var dl     = document.getElementById('{datalist_id}');
  var status = document.getElementById('{widget_id}_status');
  if (!dl) return;

  if (!window.__simsGeoServerLayers) {{
    window.__simsGeoServerLayers = fetch('/api/geoserver-layers/', {{
      credentials: 'same-origin',
      headers: {{ 'Accept': 'application/json' }}
    }})
    .then(function(r) {{ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }})
    .then(function(data) {{
      if (data.error && (!data.layers || data.layers.length === 0)) {{
        throw new Error(data.error);
      }}
      return data.layers || [];
    }});
  }}

  window.__simsGeoServerLayers
    .then(function(layers) {{
      dl.innerHTML = '';
      layers.forEach(function(l) {{
        var opt = document.createElement('option');
        opt.value = l.name;
        if (l.title && l.title !== l.name) opt.label = l.title;
        dl.appendChild(opt);
      }});
      if (status) status.textContent = '✅ ' + layers.length + ' couche(s) GeoServer disponibles — saisissez une partie du nom pour filtrer';
    }})
    .catch(function(err) {{
      if (status) status.textContent = '⚠ Liste GeoServer indisponible : ' + err.message + ' — saisie libre.';
      console.error('[GeoServerLayerWidget] fetch /api/geoserver-layers/ error:', err);
    }});
}})();
</script>
"""
        return mark_safe(input_html + script)


# ─────────────────────────────────────────────────────────────────
# Helper : applique les widgets DashboardWidget (admin + inline)
# ─────────────────────────────────────────────────────────────────
def apply_dashboard_widget_formfields(db_field, kwargs):
    if db_field.name == 'geoserver_layer':
        kwargs['widget'] = GeoServerLayerWidget()
    return kwargs


# ─────────────────────────────────────────────────────────────────
# Organisation
# ─────────────────────────────────────────────────────────────────
@admin.register(Organisation)
class OrganisationAdmin(admin.ModelAdmin):
    list_display  = ['name', 'slug', 'is_active', 'modules_summary', 'created_at']
    list_filter   = ['is_active']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}

    @staticmethod
    def _module_fields():
        """
        Auto-découverte des champs module_* sur Organisation.
        Ajouter un nouveau module = ajouter le BooleanField préfixé 'module_'
        sur Organisation (+ Application) et lancer une migration.
        Aucune liste à maintenir ici.
        """
        return [
            f.name for f in Organisation._meta.get_fields()
            if f.name.startswith('module_') and hasattr(f, 'default')
        ]

    def get_fieldsets(self, request, obj=None):
        base = [
            ('Identité', {'fields': ['name', 'slug', 'description', 'logo', 'website', 'is_active']}),
        ]
        # Modules : auto-découverts — aucune liste à maintenir
        base.append((
            'Modules autorisés',
            {
                'fields': self._module_fields(),
                'description': (
                    "Définit quels modules sont disponibles pour cette organisation. "
                    "L'org-admin ne pourra activer dans ses applications que ces modules."
                ),
            }
        ))
        return base

    def get_readonly_fields(self, request, obj=None):
        ro = list(super().get_readonly_fields(request, obj))
        # Les org-admins voient les modules mais ne peuvent pas les modifier
        if _is_scoped(request.user):
            ro += self._module_fields()
        return ro

    @admin.display(description='Modules')
    def modules_summary(self, obj):
        """
        Affiche les modules actifs — auto-découvert depuis les champs module_*
        du modèle Organisation. Le verbose_name du champ sert de libellé.
        """
        parts = []
        for f in Organisation._meta.get_fields():
            if f.name.startswith('module_') and hasattr(f, 'default'):
                if getattr(obj, f.name, False):
                    label = str(getattr(f, 'verbose_name', f.name.replace('module_', '').replace('_', ' ').title()))
                    parts.append(label)
        return ' · '.join(parts) if parts else '—'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not _is_scoped(request.user):
            return qs
        org = _get_admin_org(request.user)
        return qs.filter(pk=org.pk) if org else qs.none()

    def has_module_perms(self, request):
        if _is_scoped(request.user):
            return True
        return super().has_module_perms(request)

    def has_view_permission(self, request, obj=None):
        if _is_scoped(request.user):
            return True
        return super().has_view_permission(request, obj)

    def has_change_permission(self, request, obj=None):
        if _is_scoped(request.user):
            return True
        return super().has_change_permission(request, obj)

    def has_add_permission(self, request):
        # Les org-admins ne peuvent pas créer de nouvelles organisations
        if _is_scoped(request.user):
            return False
        return super().has_add_permission(request)

    def has_delete_permission(self, request, obj=None):
        # Les org-admins ne peuvent pas supprimer leur organisation
        if _is_scoped(request.user):
            return False
        return super().has_delete_permission(request, obj)


# ─────────────────────────────────────────────────────────────────
# Application
# ─────────────────────────────────────────────────────────────────
class ApplicationLayerInline(admin.TabularInline):
    model   = ApplicationLayer
    extra   = 0
    fields  = [
        'name', 'layer_key', 'geoserver_layer', 'layer_type',
        'group_slug', 'group_icon', 'group_order',
        'visible_default', 'color', 'layer_order',
    ]
    ordering = ['group_order', 'layer_order', 'name']


@admin.register(Application)
class ApplicationAdmin(OrgScopedMixin, admin.ModelAdmin):
    list_display  = ['name', 'subtitle', 'organisation', 'is_active', 'is_public', 'layers_count', 'updated_at']
    list_filter   = ['is_active', 'is_public', 'organisation']
    search_fields = ['name', 'slug', 'organisation__name']
    prepopulated_fields = {'slug': ('name',)}
    inlines       = [ApplicationLayerInline]

    def _org_for_request(self, request):
        """Retourne l'organisation de l'org-admin connecté, ou None pour le superuser."""
        if _is_scoped(request.user):
            return _get_admin_org(request.user)
        return None

    @staticmethod
    def _all_module_fields():
        """
        Retourne tous les champs module_* de l'Organisation, déduits dynamiquement.
        Auto-découvrant : ajouter un module = ajouter le champ BooleanField
        préfixé 'module_' sur Organisation + Application + une migration.
        """
        return [
            f.name for f in Organisation._meta.get_fields()
            if f.name.startswith('module_') and hasattr(f, 'default')
        ]

    def _authorized_module_fields(self, org):
        """
        Retourne la liste des champs module_* que l'org a le droit d'utiliser.
        Si org est None (superuser), retourne tous les modules.
        """
        all_fields = self._all_module_fields()
        if org is None:
            return all_fields
        return [f for f in all_fields if getattr(org, f, False)]

    def get_fieldsets(self, request, obj=None):
        """
        Pour un org-admin : n'affiche dans la section Modules que les modules
        que l'admin Django a autorisés pour son organisation.
        Pour un superuser : affiche tous les modules.
        """
        org = self._org_for_request(request)
        module_fields = self._authorized_module_fields(org)

        base = [
            ('Identité', {'fields': ['organisation', 'name', 'slug', 'subtitle', 'description', 'thumbnail']}),
            ('Carte',    {'fields': ['center_lat', 'center_lon', 'zoom_default', 'zoom_min', 'zoom_max']}),
            ('Accès',    {'fields': ['is_public', 'is_active']}),
            ('Config JSON', {'fields': ['config'], 'classes': ['collapse']}),
        ]

        if module_fields:
            description = None if org is None else (
                "Seuls les modules accordés par l'administrateur Django à votre organisation sont disponibles."
            )
            modules_fieldset = ('Modules', {
                'fields': module_fields,
                **(({'description': description}) if description else {}),
            })
            # Insérer après 'Carte'
            base.insert(2, modules_fieldset)
        else:
            # Aucun module autorisé : section en lecture seule pour informer l'org-admin
            base.insert(2, ('Modules', {
                'fields': [],
                'description': (
                    "⚠ Aucun module n'a encore été accordé à votre organisation. "
                    "Contactez l'administrateur Django pour en activer."
                ),
            }))

        return base

    def get_readonly_fields(self, request, obj=None):
        ro = list(super().get_readonly_fields(request, obj) or [])
        # Les org-admins ne peuvent pas modifier les champs hors de leur scope
        if _is_scoped(request.user):
            ro += ['organisation', 'slug']
        return ro

    def layers_count(self, obj):
        n = obj.layers.count()
        return format_html('<b>{}</b> couche{}'.format(n, 's' if n > 1 else ''))
    layers_count.short_description = 'Couches'

    def get_list_filter(self, request):
        # Inutile de montrer le filtre organisation si l'org-admin ne voit que la sienne
        if _is_scoped(request.user):
            return ['is_active', 'is_public']
        return self.list_filter


# ─────────────────────────────────────────────────────────────────
# ApplicationLayer
# ─────────────────────────────────────────────────────────────────
@admin.action(description='🔍 Vérifier les couches sur GeoServer')
def verifier_couches_geoserver(modeladmin, request, queryset):
    from django.conf import settings
    from django.contrib import messages
    try:
        import requests as _req
    except ImportError:
        messages.error(request, "⚠ Le module 'requests' n'est pas installé dans l'environnement Django.")
        return

    geoserver_url = getattr(settings, 'GEOSERVER_URL', None)
    if not geoserver_url:
        messages.warning(
            request,
            "⚠ GEOSERVER_URL n'est pas défini dans settings.py — impossible de contacter GeoServer. "
            "Ajoutez GEOSERVER_URL = 'http://localhost:8080/geoserver' dans votre configuration."
        )
        return

    gs_user = getattr(settings, 'GEOSERVER_USER', 'admin')
    gs_pwd  = getattr(settings, 'GEOSERVER_PASSWORD', 'geoserver')
    ok, missing, errors = [], [], []

    for layer in queryset:
        gs = (layer.geoserver_layer or '').strip()
        if not gs or ':' not in gs:
            errors.append(f"« {layer.name} » — format invalide ({gs!r})")
            continue
        workspace, lname = gs.split(':', 1)
        url = f"{geoserver_url.rstrip('/')}/rest/layers/{workspace}:{lname}.json"
        try:
            resp = _req.get(url, auth=(gs_user, gs_pwd), timeout=5)
            if resp.status_code == 200:
                ok.append(f"{layer.name} ({gs})")
            elif resp.status_code == 404:
                missing.append(f"{layer.name} ({gs})")
            else:
                errors.append(f"« {layer.name} » — HTTP {resp.status_code}")
        except Exception as exc:
            errors.append(f"« {layer.name} » — {exc}")

    if ok:
        messages.success(request, f"✅ {len(ok)} couche(s) trouvée(s) : " + " · ".join(ok))
    if missing:
        messages.error(request, f"❌ {len(missing)} couche(s) INTROUVABLE(S) sur GeoServer : " + " · ".join(missing))
    if errors:
        messages.warning(request, f"⚠ {len(errors)} erreur(s) : " + " · ".join(errors))
    if not ok and not missing and not errors:
        messages.info(request, "Aucune couche sélectionnée.")


@admin.register(ApplicationLayer)
class ApplicationLayerAdmin(OrgScopedMixin, admin.ModelAdmin):
    _org_filter = 'application__organisation'
    _org_setter = None   # l'organisation est portée par l'application FK

    list_display  = [
        'name', 'geoserver_format_badge', 'layer_key', 'application', 'layer_type',
        'group_icon_display', 'group_label', 'group_order',
        'visible_default', 'color_swatch', 'layer_order',
    ]
    list_filter   = ['layer_type', 'visible_default', 'application', 'group_slug']
    search_fields = ['name', 'layer_key', 'geoserver_layer', 'application__name', 'group_label']
    ordering      = ['application', 'group_order', 'layer_order']
    readonly_fields = ['layer_key', 'group_slug']
    actions       = [verifier_couches_geoserver]

    fieldsets = [
        ('Identité', {
            'fields': [
                'application', 'name', 'layer_key',
                'geoserver_layer', 'layer_type', 'description',
            ]
        }),
        ('Groupe cartographique', {
            'fields': ['group_slug', 'group_label', 'group_icon', 'group_order', 'group_name'],
            'description': (
                'group_slug et group_label définissent le groupe affiché dans la sidebar. '
                'Toutes les couches du même groupe_slug sont regroupées ensemble.'
            ),
        }),
        ('Affichage', {
            'fields': ['visible_default', 'opacity_default', 'layer_order'],
        }),
        ('Champs popup', {
            'fields': ['popup_fields'],
            'description': (
                'Sélectionnez les attributs à afficher dans le popup au clic sur la carte. '
                'Les attributs disponibles sont chargés automatiquement depuis GeoServer. '
                'Laisser vide = tous les attributs sont affichés.'
            ),
        }),
        ('Style avancé', {
            'fields': ['color', 'line_width', 'point_radius', 'style_config'],
            'classes': ['collapse'],
        }),
    ]

    def get_list_filter(self, request):
        if _is_scoped(request.user):
            return ['layer_type', 'visible_default', 'group_slug']
        return self.list_filter

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        if db_field.name == 'popup_fields':
            kwargs['widget']   = PopupFieldsWidget(mode='popup')
            kwargs['required'] = False
        elif db_field.name == 'geoserver_layer':
            kwargs['widget'] = GeoServerLayerWidget()
        return super().formfield_for_dbfield(db_field, request, **kwargs)

    @admin.display(description='Couche GeoServer')
    def geoserver_format_badge(self, obj):
        gs = (obj.geoserver_layer or '').strip()
        parts = gs.split(':') if gs else []
        if len(parts) == 2 and parts[0] and parts[1]:
            return format_html(
                '<code style="font-size:11px;color:#10b981;background:rgba(16,185,129,.08);'
                'padding:2px 6px;border-radius:4px;border:1px solid rgba(16,185,129,.25);">{}</code>',
                gs
            )
        if not gs:
            return format_html(
                '<span style="color:#9ca3af;font-style:italic;font-size:11px;">— non défini —</span>'
            )
        return format_html(
            '<span style="color:#ef4444;font-weight:600;" '
            'title="Format invalide — attendu : workspace:nom_couche">⚠ {}</span>',
            gs
        )

    def group_icon_display(self, obj):
        return obj.group_icon or '—'
    group_icon_display.short_description = 'Icône'

    def color_swatch(self, obj):
        return format_html(
            '<span style="display:inline-block;width:16px;height:16px;'
            'background:{};border-radius:3px;border:1px solid #ccc"></span> {}',
            obj.color, obj.color
        )
    color_swatch.short_description = 'Couleur'


# ─────────────────────────────────────────────────────────────────
# UserProfile
# ─────────────────────────────────────────────────────────────────
@admin.register(UserProfile)
class UserProfileAdmin(OrgScopedMixin, admin.ModelAdmin):
    list_display      = ['avatar_thumb', 'user', 'organisation', 'role', 'phone', 'created_at']
    list_filter       = ['role', 'organisation']
    search_fields     = ['user__username', 'user__email', 'user__first_name', 'user__last_name']
    autocomplete_fields = ['user', 'organisation']
    readonly_fields   = ['avatar_preview']

    fieldsets = [
        ('Compte',        {'fields': ['user', 'role', 'organisation']}),
        ('Photo',         {'fields': ['avatar', 'avatar_preview'],
                           'description': 'Photo optionnelle — affichée dans le menu utilisateur de SIMS Online.'}),
        ('Contact',       {'fields': ['phone']}),
        ('SSO / LDAP',    {'fields': ['ldap_dn'], 'classes': ['collapse']}),
    ]

    def get_list_filter(self, request):
        if _is_scoped(request.user):
            return ['role']
        return self.list_filter

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """Pour les org-admins : limite user aux users de leur org, organisation à la leur."""
        if _is_scoped(request.user):
            org = _get_admin_org(request.user)
            if org:
                if db_field.name == 'user':
                    # Uniquement les users sans profil ou déjà rattachés à cette org
                    kwargs['queryset'] = User.objects.filter(
                        profile__organisation=org
                    ) | User.objects.filter(profile__isnull=True)
                elif db_field.name == 'organisation':
                    kwargs['queryset'] = Organisation.objects.filter(pk=org.pk)
        return super(OrgScopedMixin, self).formfield_for_foreignkey(db_field, request, **kwargs)

    def save_model(self, request, obj, form, change):
        # OrgScopedMixin.save_model gère l'auto-set de l'organisation
        super().save_model(request, obj, form, change)
        # ── Auto-sync is_staff ↔ role='admin' ──────────────────────
        user = obj.user
        if not user.is_superuser:
            should_be_staff = (obj.role == 'admin')
            if user.is_staff != should_be_staff:
                user.is_staff = should_be_staff
                user.save(update_fields=['is_staff'])

    @admin.display(description='Photo')
    def avatar_thumb(self, obj):
        if obj.avatar:
            return format_html(
                '<img src="{}" style="width:32px;height:32px;border-radius:50%;'
                'object-fit:cover;border:2px solid #00AADD;" />',
                obj.avatar.url
            )
        return format_html(
            '<span style="display:inline-flex;align-items:center;justify-content:center;'
            'width:32px;height:32px;border-radius:50%;background:#1a3a5c;'
            'color:#00AADD;font-size:13px;font-weight:700;">{}</span>',
            (obj.user.first_name[:1] or obj.user.username[:1]).upper()
        )

    @admin.display(description='Aperçu photo')
    def avatar_preview(self, obj):
        if obj.avatar:
            return format_html(
                '<img src="{}" style="width:96px;height:96px;border-radius:12px;'
                'object-fit:cover;border:2px solid #00AADD;box-shadow:0 4px 12px rgba(0,0,0,.3);" />',
                obj.avatar.url
            )
        return format_html(
            '<span style="color:#999;font-style:italic;">Aucune photo — '
            'utilisez le champ ci-dessus pour en ajouter une.</span>'
        )


# ─────────────────────────────────────────────────────────────────
# Intégration UserProfile dans la fiche User Django native
# ─────────────────────────────────────────────────────────────────
class UserProfileInline(admin.StackedInline):
    """
    Permet de créer/modifier le profil SIMS directement depuis
    Auth > Users > <user> — sans popup, sans navigation supplémentaire.
    """
    model               = UserProfile
    can_delete          = False
    verbose_name_plural = 'Profil SIMS'
    fk_name             = 'user'
    fields              = ['role', 'organisation', 'phone', 'avatar']
    extra               = 0
    autocomplete_fields = ['organisation']

    def get_formset(self, request, obj=None, **kwargs):
        formset = super().get_formset(request, obj, **kwargs)
        if _is_scoped(request.user):
            org = _get_admin_org(request.user)
            if org:
                # Pré-remplir et verrouiller l'organisation sur l'org de l'admin
                formset.form.base_fields['organisation'].initial = org
                formset.form.base_fields['organisation'].queryset = Organisation.objects.filter(pk=org.pk)
        return formset


class CustomUserAdmin(BaseUserAdmin):
    inlines = [UserProfileInline]

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not _is_scoped(request.user):
            return qs
        org = _get_admin_org(request.user)
        return qs.filter(profile__organisation=org) if org else qs.none()

    # ── Permissions pour les org-admins ──
    def has_module_perms(self, request):
        if _is_scoped(request.user):
            return True
        return super().has_module_perms(request)

    def has_view_permission(self, request, obj=None):
        if _is_scoped(request.user):
            return True
        return super().has_view_permission(request, obj)

    def has_change_permission(self, request, obj=None):
        if _is_scoped(request.user):
            return True
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if _is_scoped(request.user):
            return True
        return super().has_delete_permission(request, obj)

    def get_fieldsets(self, request, obj=None):
        """Fieldsets simplifiés pour les org-admins (pas de is_superuser, pas de permissions)."""
        if _is_scoped(request.user):
            if not obj:
                # Création
                return [
                    ('Identité', {'fields': ['username', 'password1', 'password2']}),
                    ('Informations personnelles', {'fields': ['first_name', 'last_name', 'email']}),
                ]
            else:
                # Édition
                return [
                    ('Identité', {'fields': ['username']}),
                    ('Informations personnelles', {'fields': ['first_name', 'last_name', 'email']}),
                    ('Statut', {
                        'fields': ['is_active', 'is_staff'],
                        'description': (
                            "⚠ Activer « Statut équipe » donne accès à cette interface d'administration. "
                            "N'activer que pour les collègues qui doivent gérer les profils et applications."
                        ),
                    }),
                ]
        return super().get_fieldsets(request, obj)

    def get_readonly_fields(self, request, obj=None):
        ro = list(super().get_readonly_fields(request, obj))
        if _is_scoped(request.user):
            ro += ['is_superuser', 'last_login', 'date_joined', 'groups', 'user_permissions']
            # Un org-admin ne peut pas se retirer lui-même son is_staff
            if obj and obj == request.user:
                ro += ['is_staff']
        return ro

    def has_add_permission(self, request):
        # Les org-admins peuvent créer des users dans leur org
        return True

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        # Sync is_staff si le profil inline a déjà un rôle
        try:
            profile = obj.profile
            if not obj.is_superuser:
                should_be_staff = (profile.role == 'admin')
                if obj.is_staff != should_be_staff:
                    obj.is_staff = should_be_staff
                    obj.save(update_fields=['is_staff'])
        except UserProfile.DoesNotExist:
            pass


admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)


# ─────────────────────────────────────────────────────────────────
# Annotations & Bookmarks
# ─────────────────────────────────────────────────────────────────
@admin.register(MapAnnotation)
class MapAnnotationAdmin(OrgScopedMixin, admin.ModelAdmin):
    _org_filter = 'application__organisation'
    _org_setter = None

    list_display  = ['title', 'geom_type', 'application', 'created_by', 'is_shared', 'created_at']
    list_filter   = ['geom_type', 'is_shared', 'application']

    def get_list_filter(self, request):
        if _is_scoped(request.user):
            return ['geom_type', 'is_shared']
        return self.list_filter


@admin.register(MapBookmark)
class MapBookmarkAdmin(OrgScopedMixin, admin.ModelAdmin):
    _org_filter = 'application__organisation'
    _org_setter = None

    list_display  = ['name', 'user', 'application', 'zoom', 'created_at']
    list_filter   = ['application']

    def get_list_filter(self, request):
        if _is_scoped(request.user):
            return []
        return self.list_filter


# ─────────────────────────────────────────────────────────────────
# DASHBOARD ADMIN
# ─────────────────────────────────────────────────────────────────
class DashboardWidgetInline(admin.StackedInline):
    model  = DashboardWidget
    extra  = 0
    fields = [
        'title', 'position',
        'geoserver_layer', 'layer_name',
        'attributes', 'chart_type', 'color_scheme',
    ]
    ordering = ['position']
    show_change_link = True
    classes = ['collapse']

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        kwargs = apply_dashboard_widget_formfields(db_field, kwargs)
        return super().formfield_for_dbfield(db_field, request, **kwargs)


@admin.register(Dashboard)
class DashboardAdmin(OrgScopedMixin, admin.ModelAdmin):
    _org_filter = 'application__organisation'
    _org_setter = None

    list_display       = [
        'id', 'name', 'application', 'created_by',
        'is_shared', 'widgets_count_display', 'created_at', 'updated_at',
    ]
    list_display_links = ['name']
    list_filter        = ['is_shared', 'application', 'created_at']
    search_fields = ['name', 'description', 'created_by__username', 'application__name']
    readonly_fields = ['created_at', 'updated_at']
    ordering      = ['-created_at']
    date_hierarchy = 'created_at'
    inlines       = [DashboardWidgetInline]

    fieldsets = (
        ('Identification', {
            'fields': ('application', 'name', 'description'),
        }),
        ('Accès', {
            'fields': ('created_by', 'is_shared'),
        }),
        ('Métadonnées', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def get_list_filter(self, request):
        if _is_scoped(request.user):
            return ['is_shared']
        return self.list_filter

    @admin.display(description='Widgets')
    def widgets_count_display(self, obj):
        n = obj.widgets.count()
        return format_html(
            '<b style="color:#4f46e5">{}</b> widget{}',
            n, 's' if n > 1 else ''
        )


@admin.register(DashboardWidget)
class DashboardWidgetAdmin(OrgScopedMixin, admin.ModelAdmin):
    _org_filter = 'dashboard__application__organisation'
    _org_setter = None

    list_display       = [
        'id', 'title', 'dashboard', 'chart_type_display',
        'geoserver_layer', 'color_scheme', 'position', 'created_at',
    ]
    list_display_links = ['title']
    list_filter        = ['chart_type', 'color_scheme', 'dashboard__application']
    search_fields = ['title', 'geoserver_layer', 'layer_name', 'dashboard__name']
    readonly_fields = ['created_at', 'updated_at']
    ordering      = ['dashboard', 'position']

    fieldsets = (
        ('Widget', {
            'fields': ('dashboard', 'title', 'position'),
        }),
        ('Source de données', {
            'fields': ('geoserver_layer', 'layer_name', 'attributes', 'filters'),
            'description': (
                'Couche GeoServer : tapez une partie du nom pour filtrer la liste auto-complétée. '
                'Attributs : saisissez en JSON, ex: ["nom_attr", "tension"] '
                '(1 attribut pour camembert/donut/barres, 2 pour barres groupées).'
            ),
        }),
        ('Visualisation', {
            'fields': ('chart_type', 'color_scheme'),
        }),
        ('Config avancée', {
            'fields': ('config',),
            'classes': ('collapse',),
        }),
        ('Métadonnées', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def get_list_filter(self, request):
        if _is_scoped(request.user):
            return ['chart_type', 'color_scheme']
        return self.list_filter

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        kwargs = apply_dashboard_widget_formfields(db_field, kwargs)
        return super().formfield_for_dbfield(db_field, request, **kwargs)

    CHART_ICONS = {
        'pie':            '🥧',
        'donut':          '🍩',
        'bar':            '📊',
        'bar_horizontal': '📉',
        'histogram':      '📶',
        'line':           '📈',
        'treemap':        '🗂️',
        'grouped_bar':    '📊',
    }

    @admin.display(description='Type graphique')
    def chart_type_display(self, obj):
        icon = self.CHART_ICONS.get(obj.chart_type, '📊')
        return format_html('{} {}', icon, obj.get_chart_type_display())


# ─────────────────────────────────────────────────────────────────
# Accès et menu filtrés pour les org-admins
# ─────────────────────────────────────────────────────────────────
# Django's _build_app_dict appelle request.user.has_module_perms(app_label)
# directement sur l'objet User — un staff sans permissions explicites retourne
# False et rien ne s'affiche. On patche _build_app_dict pour court-circuiter
# cette vérification au niveau utilisateur pour les org-admins.
# get_app_list est ensuite filtré pour masquer les sections non pertinentes.
# ─────────────────────────────────────────────────────────────────

_orig_build_app_dict = admin.AdminSite._build_app_dict


def _scoped_build_app_dict(self, request, label=None):
    """Pour les org-admins : accorde temporairement has_module_perms = True."""
    if not _is_scoped(request.user):
        return _orig_build_app_dict(self, request, label)

    # Surcharge temporaire de has_module_perms sur l'objet user pour cet appel
    _original = request.user.has_module_perms
    request.user.has_module_perms = lambda app_label: True
    try:
        return _orig_build_app_dict(self, request, label)
    finally:
        request.user.has_module_perms = _original


admin.AdminSite._build_app_dict = _scoped_build_app_dict


_orig_get_app_list = admin.AdminSite.get_app_list


def _build_module_flag_map():
    """
    Construit dynamiquement la map { 'app_label.modelname' -> 'module_xxx' }
    en introspectant tous les ModelAdmin enregistres qui declarent org_module_flag.

    Convention : tout ModelAdmin qui veut etre controle par un module org
    doit declarer `org_module_flag = 'module_xxx'` comme attribut de classe.
    Ajouter un nouveau module = creer son ModelAdmin avec cet attribut,
    aucune liste a maintenir ici.
    """
    mapping = {}
    for model, model_admin in admin.site._registry.items():
        flag = getattr(model_admin, 'org_module_flag', None)
        if flag:
            key = f"{model._meta.app_label}.{model.__name__.lower()}"
            mapping[key] = flag
    return mapping


def _scoped_get_app_list(self, request, app_label=None):
    app_list = _orig_get_app_list(self, request, app_label)
    if not _is_scoped(request.user):
        return app_list

    org = _get_admin_org(request.user)

    # Modeles toujours masques pour les org-admins (quel que soit l'app)
    HIDDEN_MODELS = {'auth.group'}

    # Map auto-decouverte : { 'app.model' -> 'module_flag' }
    # Construite a partir des ModelAdmin qui declarent org_module_flag.
    # Aucune liste hardcodee — chaque nouveau module s'enregistre lui-meme.
    module_flag_map = _build_module_flag_map()

    filtered = []
    for app in app_list:
        allowed_models = []
        for m in app['models']:
            key = f"{app['app_label']}.{m['object_name'].lower()}"

            # Modele toujours cache
            if key in HIDDEN_MODELS:
                continue

            # Modele soumis a un flag de module -> verifier l'org
            if key in module_flag_map:
                flag = module_flag_map[key]
                if org and getattr(org, flag, False):
                    allowed_models.append(m)
                # sinon : module non accorde, on n'affiche pas
                continue

            # Modele sans contrainte de module -> toujours visible
            allowed_models.append(m)

        if allowed_models:
            filtered.append({**app, 'models': allowed_models})
    return filtered


admin.AdminSite.get_app_list = _scoped_get_app_list
