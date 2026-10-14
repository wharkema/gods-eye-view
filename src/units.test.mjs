import test from 'node:test';
import assert from 'node:assert/strict';

import { formatAltitudeM, formatSpeedKt, formatSpeedMps } from './units.js';

test('speeds read in knots and km/h side by side', () => {
  assert.equal(formatSpeedKt(486), '486 kts · 900 km/h');
  assert.equal(formatSpeedKt(14.5), '15 kts · 27 km/h');
  assert.equal(formatSpeedKt(0), '0 kts · 0 km/h');
  assert.equal(formatSpeedMps(250), '486 kts · 900 km/h');
  for (const bad of [null, undefined, NaN, -1]) assert.equal(formatSpeedKt(bad), '');
  assert.equal(formatSpeedMps(null), '');
});

test('altitude reads in whole metres with a thin thousands separator', () => {
  assert.equal(formatAltitudeM(10668.2), '10 668 m');
  assert.equal(formatAltitudeM(950), '950 m');
  assert.equal(formatAltitudeM(0), '0 m');
  assert.equal(formatAltitudeM(null), '');
});
