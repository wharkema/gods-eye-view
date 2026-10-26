import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  UNKNOWN_COUNTRY,
  buildCountryIndex,
  cctvListEntries,
  countryCodeAt,
  loadCctvCountryIndex,
} from './cctvList.js';

const pack = JSON.parse(
  readFileSync(
    new URL('../data/local_data/natural_earth/countries.json', import.meta.url),
    'utf8',
  ),
);
const index = buildCountryIndex(pack);

test('positions resolve to their ISO2 country', () => {
  const cases = [
    [52.3731, 4.8922, 'NL'], // Amsterdam
    [52.52, 13.405, 'DE'], // Berlin
    [60.1699, 24.9384, 'FI'], // Helsinki
    [47.6062, -122.3321, 'US'], // Seattle
    [49.2827, -123.1207, 'CA'], // Vancouver
    [-33.8688, 151.2093, 'AU'], // Sydney
    [51.5074, -0.1278, 'GB'], // London
  ];
  for (const [lat, lon, code] of cases)
    assert.equal(countryCodeAt(index, lat, lon), code, `${lat},${lon}`);
});

test('mid-ocean, missing or bad positions are unknown', () => {
  assert.equal(countryCodeAt(index, 0, -30), UNKNOWN_COUNTRY);
  assert.equal(countryCodeAt(index, NaN, 4), UNKNOWN_COUNTRY);
  assert.equal(countryCodeAt(null, 52, 4), UNKNOWN_COUNTRY);
});

test('list sorts by country, city, name; unknown last', () => {
  const cameras = [
    { id: 'a', name: 'Zuid', city: 'Utrecht', lat: 52.09, lon: 5.12 },
    { id: 'b', name: 'Dam', city: 'Amsterdam', lat: 52.37, lon: 4.89 },
    { id: 'c', name: 'Cam 10', city: 'Berlin', lat: 52.52, lon: 13.4 },
    { id: 'd', name: 'Cam 9', city: 'Berlin', lat: 52.52, lon: 13.4 },
    { id: 'e', name: 'Buoy', city: '', lat: 0, lon: -30 },
    { id: 'f', name: 'Abel', city: 'Amsterdam', lat: 52.36, lon: 4.9 },
  ];
  assert.deepEqual(cctvListEntries(cameras, index), [
    { id: 'd', label: 'DE | Berlin | Cam 9' },
    { id: 'c', label: 'DE | Berlin | Cam 10' },
    { id: 'f', label: 'NL | Amsterdam | Abel' },
    { id: 'b', label: 'NL | Amsterdam | Dam' },
    { id: 'a', label: 'NL | Utrecht | Zuid' },
    { id: 'e', label: '?? | - | Buoy' },
  ]);
});

test('without the index every country reads ??', () => {
  assert.deepEqual(
    cctvListEntries([{ id: 'x', name: 'N', city: 'C', lat: 52, lon: 4 }]),
    [{ id: 'x', label: '?? | C | N' }],
  );
  assert.deepEqual(cctvListEntries(undefined, index), []);
});

test('the bundled pack loads through the shared loader', async () => {
  const loaded = await loadCctvCountryIndex();
  assert.equal(countryCodeAt(loaded, 52.37, 4.89), 'NL');
});
