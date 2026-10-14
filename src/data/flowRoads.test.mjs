import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { decodeFlowTile } from './flowTiles.js';
import { flowSegmentsToOverpass } from './flowRoads.js';

const box = { south: 30.26, west: -97.76, north: 30.28, east: -97.74 };

test('flow segments become Overpass-shaped ways with an OSM highway class', () => {
  const { elements } = flowSegmentsToOverpass([
    { coords: [[-97.75, 30.27], [-97.749, 30.271]], roadType: 'Motorway' },
    { coords: [[-97.75, 30.27], [-97.751, 30.272]], roadType: 'Connecting road' },
    { coords: [[-97.75, 30.27], [-97.751, 30.272]], roadType: 'Something new' },
  ], box);
  assert.equal(elements.length, 3);
  assert.deepEqual(elements[0], {
    type: 'way',
    geometry: [{ lat: 30.27, lon: -97.75 }, { lat: 30.271, lon: -97.749 }],
    tags: { highway: 'motorway' },
  });
  assert.equal(elements[1].tags.highway, 'tertiary');
  assert.equal(elements[2].tags.highway, 'unclassified', 'unknown types still draw');
});

test('segments outside the view box and degenerate lines are dropped', () => {
  const { elements } = flowSegmentsToOverpass([
    { coords: [[-97.9, 30.5], [-97.91, 30.51]], roadType: 'Motorway' },
    { coords: [[-97.75, 30.27]], roadType: 'Motorway' },
    null,
  ], box);
  assert.equal(elements.length, 0);
  assert.deepEqual(flowSegmentsToOverpass(undefined, box), { elements: [] });
});

test('a real TomTom tile yields drawable roads inside its own area', () => {
  const tile = readFileSync(new URL('./fixtures/tomtom-flow-austin-12-935-1686.pbf', import.meta.url));
  const segments = decodeFlowTile(tile, 12, 935, 1686);
  const { elements } = flowSegmentsToOverpass(segments, box);
  assert.ok(elements.length > 50, `got ${elements.length}`);
  assert.ok(elements.every((e) => e.geometry.length >= 2));
});
