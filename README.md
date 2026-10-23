# Carte des prix des carburants

Carte des ~9 800 stations-service de France avec leurs prix, à intégrer en iframe.

Démo : https://vexenn-tests.github.io/carte-carburants-demo/

## Fichiers

- `carburants.html` : la carte
- `fetch_carburants.js` : script de mise à jour des données (Node.js 18+, aucune dépendance)
- `carburants-data.json` : données générées par le script

## Installation

1. Déposer `carburants.html` et `carburants-data.json` dans le même dossier du CDN.
2. Lancer le script toutes les heures :

```cron
0 * * * * node /opt/carburants/fetch_carburants.js /var/www/carburants/carburants-data.json
```

3. Intégrer (le script ajuste la hauteur de l'iframe à son contenu) :

```html
<iframe id="carte-carburants" src="https://<hébergement>/carburants.html" width="100%" height="1100" style="border:0" loading="lazy" title="Carte des prix des carburants"></iframe>
<script>addEventListener('message', e => { if (e.data && e.data.type === 'carte-carburants:height') document.getElementById('carte-carburants').style.height = e.data.height + 'px'; });</script>
```

## Bon à savoir

- **Appels API :** 2 par passage (`/exports/json` renvoie toutes les stations en un seul appel), soit 48 par jour. Quota : 50 000 par jour.
- **Fréquence :** toutes les heures suffit. Pour plus frais, `*/15 * * * *` (192 appels par jour).
- **En cas d'erreur API,** le script s'arrête sans écraser le fichier existant.
- **Secours :** si le JSON est absent ou a plus de 3 h, la carte lit directement l'API du ministère.
- **JSON :** à servir en gzip (~570 Ko) avec `Cache-Control: public, max-age=300`.
- **CSP :** autoriser `cdnjs.cloudflare.com`, `data.geopf.fr` et `data.economie.gouv.fr`.

## Sources

Données : DGCCRF – data.economie.gouv.fr, Licence Ouverte v2.0. Fond de carte : © IGN. Les sources sont affichées sous la carte.
