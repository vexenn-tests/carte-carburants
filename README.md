# Carte des prix des carburants

Démo : https://vexenn-tests.github.io/carte-carburants-demo/

1. Déposer `carburants.html` sur S3 (une seule fois).
2. Toutes les heures, générer le JSON et le déposer à côté :

```sh
node fetch_carburants.js /tmp/carburants-data.json && \
aws s3 cp /tmp/carburants-data.json s3://<bucket>/carburants/carburants-data.json --content-type application/json
```

3. Intégrer dans l'article :

```html
<iframe id="carte-carburants" src="https://<cdn>/carburants/carburants.html" width="100%" height="1100" style="border:0" loading="lazy" title="Carte des prix des carburants"></iframe>
<script>addEventListener('message', e => { if (e.data && e.data.type === 'carte-carburants:height') document.getElementById('carte-carburants').style.height = e.data.height + 'px'; });</script>
```

Node.js 18+, aucune dépendance. 2 appels API par passage.
