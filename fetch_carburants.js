#!/usr/bin/env node
/*
 * Met à jour le fichier de données de la carte des carburants.
 *
 * Récupère toutes les stations-service (positions, prix, ruptures, services) depuis
 * l'API data.economie.gouv.fr et écrit un fichier JSON compact lu par carburants.html.
 *
 * Un seul appel à /exports/json renvoie tout le jeu de données (pas de pagination par 100,
 * qui ne concerne que /records), plus un appel pour la date de mise à jour : 2 appels par passage.
 *
 * À lancer toutes les heures (cron, tâche planifiée…). Node.js 18+, aucune dépendance.
 *
 * Usage :
 *     node fetch_carburants.js /chemin/vers/carburants-data.json
 *
 * Si l'API est indisponible ou renvoie des données incomplètes, le fichier existant
 * n'est pas modifié : la carte continue d'afficher les dernières données connues.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const API = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2';
const FUELS = [['gazole', 'Gazole'], ['sp95', 'SP95'], ['e10', 'E10'],
  ['sp98', 'SP98'], ['e85', 'E85'], ['gplc', 'GPLc']];
const FIELDS = ['id', 'geom', 'ville', 'cp', 'adresse', 'region', 'departement',
  'carburants_disponibles', 'carburants_indisponibles',
  'horaires_automate_24_24', 'services_service',
  ...FUELS.flatMap(([f]) => [`${f}_prix`, `${f}_maj`])];
// Garde-fou : en dessous, on considère que l'export est incomplet.
const MIN_STATIONS = 5000;
const TIMEOUT_MS = 180000;

async function getJson(url) {
  // fetch décompresse le gzip de l'API automatiquement.
  const res = await fetch(url, {
    headers: { 'User-Agent': 'carte-carburants/1.0' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return res.json();
}

/** Date ISO -> minutes depuis 1970 (plus compact qu'une date en texte). */
function epochMinutes(iso) {
  return iso ? Math.floor(Date.parse(iso) / 60000) : null;
}

/** Liste de carburants -> masque de bits dans l'ordre de FUELS. */
function fuelMask(labels) {
  const set = new Set(labels || []);
  return FUELS.reduce((mask, [, label], i) => mask | (set.has(label) ? 1 << i : 0), 0);
}

/** Remplace les textes répétés (régions, services…) par un numéro. */
function makeIndex() {
  const values = [], pos = new Map();
  const index = value => {
    if (value == null) return null;
    if (!pos.has(value)) {
      pos.set(value, values.length);
      values.push(value);
    }
    return pos.get(value);
  };
  index.values = values;
  return index;
}

function build(rows, meta) {
  const regions = makeIndex(), departements = makeIndex(), services = makeIndex();
  const stations = [];
  for (const r of rows) {
    if (!r.geom) continue;
    stations.push([
      r.id,
      Number(r.geom.lat.toFixed(5)),
      Number(r.geom.lon.toFixed(5)),
      r.ville || '',
      r.cp || '',
      r.adresse || '',
      regions(r.region),
      departements(r.departement),
      fuelMask(r.carburants_disponibles),
      fuelMask(r.carburants_indisponibles),
      FUELS.map(([f]) => r[`${f}_prix`] ?? null),
      FUELS.map(([f]) => epochMinutes(r[`${f}_maj`])),
      r.horaires_automate_24_24 === 'Oui' ? 1 : 0,
      (r.services_service || []).map(s => services(s)),
    ]);
  }
  return {
    version: 1,
    source_maj: meta.metas.default.data_processed ?? null,
    genere_le: new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00'),
    carburants: FUELS.map(([, label]) => label),
    regions: regions.values,
    departements: departements.values,
    services: services.values,
    // id, lat, lon, ville, cp, adresse, region, departement, dispo, indispo,
    // prix[6], maj[6] (minutes epoch), automate 24/24, services
    stations,
  };
}

/** Écrit dans un fichier temporaire puis le renomme : jamais de fichier à moitié écrit. */
function writeAtomic(file, data) {
  const tmp = path.join(path.dirname(path.resolve(file)), `.${path.basename(file)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(data), { encoding: 'utf8', mode: 0o644 });
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

async function main() {
  const out = process.argv[2];
  if (!out || process.argv.length !== 3) {
    console.error('Usage : node fetch_carburants.js /chemin/vers/carburants-data.json');
    process.exit(2);
  }

  const [meta, rows] = await Promise.all([
    getJson(API),
    getJson(`${API}/exports/json?select=${FIELDS.join(',')}`),
  ]);
  const data = build(rows, meta);

  if (data.stations.length < MIN_STATIONS) {
    console.error(`Export incomplet (${data.stations.length} stations) : fichier non modifié.`);
    process.exit(1);
  }

  writeAtomic(out, data);
  console.log(`${data.stations.length} stations écrites dans ${out} (données du ${data.source_maj})`);
}

main().catch(e => {
  console.error(`Échec : ${e.message} — fichier non modifié.`);
  process.exit(1);
});
