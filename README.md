# Carte des prix des carburants

Carte des ~9 800 stations-service de France avec leurs prix, à intégrer en iframe.

Démo : https://vexenn-tests.github.io/carte-carburants-demo/

## Fichiers

- `carburants.html` : la carte (page statique)
- `fetch_carburants.js` : script qui récupère les données de l'API, les traite et écrit `carburants-data.json` (Node.js 18+, aucune dépendance)
- `carburants-data.json` : exemple du fichier produit par le script

## Ce qu'il faut faire

**1. Une seule fois : déposer `carburants.html` sur S3.** Ce fichier ne change jamais.

**2. Toutes les heures : lancer le script et déposer le JSON sur S3, dans le même dossier que la page.**

```sh
node fetch_carburants.js /tmp/carburants-data.json && \
aws s3 cp /tmp/carburants-data.json s3://<bucket>/carburants/carburants-data.json \
  --content-type application/json --cache-control "public, max-age=300"
```

Le `&&` évite d'envoyer un fichier si le script a échoué : la carte garde alors les dernières données.

**3. Dans l'article : intégrer l'iframe.** Le script ajuste la hauteur de l'iframe à son contenu.

```html
<iframe id="carte-carburants" src="https://<cdn>/carburants/carburants.html" width="100%" height="1100" style="border:0" loading="lazy" title="Carte des prix des carburants"></iframe>
<script>addEventListener('message', e => { if (e.data && e.data.type === 'carte-carburants:height') document.getElementById('carte-carburants').style.height = e.data.height + 'px'; });</script>
```

À chaque visite, la page lit `carburants-data.json` sur S3. Il n'y a rien d'autre à mettre à jour.

## Bon à savoir

- **Appels API :** 2 par passage (`/exports/json` renvoie toutes les stations en un seul appel), soit 48 par jour. Quota : 50 000 par jour.
- **Fréquence :** toutes les heures suffit. Pour plus frais, toutes les 15 minutes (192 appels par jour).
- **Compression :** activer la compression gzip du CDN pour le JSON (1,7 Mo, ~570 Ko compressé).
- **Secours :** si le JSON est absent ou a plus de 3 h, la carte lit directement l'API du ministère.
- **CSP :** autoriser `cdnjs.cloudflare.com`, `data.geopf.fr` et `data.economie.gouv.fr`.

## Sources

Données : DGCCRF – data.economie.gouv.fr, Licence Ouverte v2.0. Fond de carte : © IGN. Les sources sont affichées sous la carte.
