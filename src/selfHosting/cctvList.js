/**
 * CCTV camera list for the self-hosting fork: the dropdown reads
 * "NL | Amsterdam | Dam Square", sorted by country, then city, then name.
 *
 * Cameras carry no country, so it is looked up from their position in the
 * bundled Natural Earth countries pack (the same pack adminBoundaries.js
 * uses). The pack loads once, on first use; until then the labels show "??".
 *
 * On only with GEV_SELF_HOSTING=1 (server/wharkema/hosting.js), so upstream's
 * "City · Name" list — and its tests — stay as they are everywhere else.
 */
import { loadBundledJson } from '../data/bundledJson.js';
import { createRetryableLoader } from '../data/retryableLoad.js';
import { decodeRing, polygonsContain } from '../data/adminBoundaries.js';

export const CCTV_GROUPED = import.meta.env?.GEV_SELF_HOSTING === '1';

const COUNTRIES_URL = new URL(
  '../data/local_data/natural_earth/countries.json',
  import.meta.url,
);

/** Country code shown when the position matches no country. */
export const UNKNOWN_COUNTRY = '??';

/** Margin (degrees) for points just off a simplified coastline. */
const COAST_MARGIN_DEG = 0.25;

/** Bounding box of one ring of [lon, lat]. */
function ringBox(ring) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of ring || []) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return { west, south, east, north };
}

/**
 * Build a lookup index from a countries pack: one entry per polygon part
 * (mainland, island, overseas territory) with its ISO2 code, its decoded
 * rings and its bounding box. Per part, so a country spread over the globe
 * (France, Kiribati) does not claim the ocean in between.
 */
export function buildCountryIndex(pack) {
  const decimals = pack?.meta?.decimals ?? 3;
  const parts = [];
  for (const feature of pack?.features || []) {
    const code = String(feature.iso2 || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) continue;
    for (const poly of feature.polygons || []) {
      const rings = poly.map((ring) => decodeRing(ring, feature.d ?? decimals));
      const box = ringBox(rings[0]);
      if (box.west > box.east) continue;
      parts.push({ code, polygons: [rings], ...box });
    }
  }
  // 1° grid: each cell lists the parts whose (widened) box touches it, so a
  // lookup tests a handful of parts instead of all of them.
  const grid = new Map();
  for (const p of parts) {
    const m = COAST_MARGIN_DEG;
    for (
      let y = Math.floor(p.south - m);
      y <= Math.floor(p.north + m);
      y += 1
    ) {
      for (
        let x = Math.floor(p.west - m);
        x <= Math.floor(p.east + m);
        x += 1
      ) {
        const key = `${y},${x}`;
        const cell = grid.get(key);
        if (cell) cell.push(p);
        else grid.set(key, [p]);
      }
    }
  }
  return { grid, cache: new Map() };
}

/**
 * ISO2 code of the country at a position. A point just outside every
 * polygon (a harbour camera against a simplified coastline) goes to the
 * smallest part whose box, widened a little, still holds it.
 */
export function countryCodeAt(index, lat, lon) {
  if (!index || !Number.isFinite(lat) || !Number.isFinite(lon))
    return UNKNOWN_COUNTRY;
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = index.cache.get(key);
  if (cached) return cached;
  let code = null;
  let near = null;
  let nearArea = Infinity;
  const m = COAST_MARGIN_DEG;
  const cell = index.grid.get(`${Math.floor(lat)},${Math.floor(lon)}`);
  for (const p of cell || []) {
    if (
      lat < p.south - m ||
      lat > p.north + m ||
      lon < p.west - m ||
      lon > p.east + m
    )
      continue;
    if (polygonsContain(p.polygons, lat, lon)) {
      code = p.code;
      break;
    }
    const area = (p.north - p.south + 2 * m) * (p.east - p.west + 2 * m);
    if (area < nearArea) {
      nearArea = area;
      near = p.code;
    }
  }
  code = code || near || UNKNOWN_COUNTRY;
  index.cache.set(key, code);
  return code;
}

const loadIndex = createRetryableLoader(async () =>
  buildCountryIndex(await loadBundledJson(COUNTRIES_URL)),
);

let loadedIndex = null;

/** The country index once loaded, else null. */
export function cctvCountryIndex() {
  return loadedIndex;
}

/** Load the country index; resolves to it (or null when the pack fails). */
export function loadCctvCountryIndex() {
  return loadIndex().then(
    (index) => (loadedIndex = index),
    () => null,
  );
}

const collator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
});

/**
 * Dropdown entries for the camera list: `{ id, label }` sorted by country
 * code, city and name; label "NL | Amsterdam | Dam Square". Unknown
 * countries sort last.
 */
export function cctvListEntries(cameras, index) {
  const rows = (cameras || []).map((camera) => {
    const country = index
      ? countryCodeAt(index, Number(camera.lat), Number(camera.lon))
      : UNKNOWN_COUNTRY;
    const city = String(camera.city ?? '').trim() || '-';
    const name = String(camera.name ?? '').trim() || String(camera.id);
    return { id: camera.id, country, city, name };
  });
  rows.sort(
    (a, b) =>
      (a.country === UNKNOWN_COUNTRY) - (b.country === UNKNOWN_COUNTRY) ||
      collator.compare(a.country, b.country) ||
      collator.compare(a.city, b.city) ||
      collator.compare(a.name, b.name),
  );
  return rows.map((row) => ({
    id: row.id,
    label: `${row.country} | ${row.city} | ${row.name}`,
  }));
}
