import test from 'node:test';
import assert from 'node:assert/strict';

import {
  altitudeRulerStepMetres,
  altitudeRulerTicksMetres,
  formatAltitudeMetres,
  formatSpeedKnots,
  formatSpeedMps,
} from './units.js';

const NB = ' ';

test('speeds read in knots and km/h side by side', () => {
  assert.equal(formatSpeedKnots(486), `486${NB}kts · 900${NB}km/h`);
  assert.equal(formatSpeedKnots(14.5), `15${NB}kts · 27${NB}km/h`);
  assert.equal(formatSpeedMps(250), `486${NB}kts · 900${NB}km/h`);
  for (const bad of [null, undefined, NaN, -1])
    assert.equal(formatSpeedKnots(bad), '');
});

test('altitude reads in whole metres', () => {
  assert.equal(formatAltitudeMetres(10668.2), `10668${NB}m`);
  assert.equal(formatAltitudeMetres(0), `0${NB}m`);
  assert.equal(formatAltitudeMetres(null), '');
});

test('the metre altitude tape steps 50/100/200 m and moves behind the pointer', () => {
  assert.equal(altitudeRulerStepMetres(1200), 50);
  assert.equal(altitudeRulerStepMetres(3000), 100);
  assert.equal(altitudeRulerStepMetres(10000), 200);
  const ticks = altitudeRulerTicksMetres(10650);
  assert.equal(ticks.length, 9);
  assert.equal(ticks[4].valueM, 10600);
  assert.equal(ticks[4].slot, -0.25);
  assert.equal(ticks[5].valueM, 10800);
  assert.equal(altitudeRulerTicksMetres(-20)[4].valueM, 0);
  assert.deepEqual(altitudeRulerTicksMetres(null), []);
});
