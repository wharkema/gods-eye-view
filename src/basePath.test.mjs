import test from 'node:test';
import assert from 'node:assert/strict';

import { basePathFromModuleUrl, withBase } from './basePath.js';

const PAGE = 'https://wharkema.nl/gods-eye-view/';
const BASE = '/gods-eye-view/';

test('root-absolute paths move under the sub-path', () => {
  assert.equal(withBase('/api/tomtom/status', BASE, PAGE), '/gods-eye-view/api/tomtom/status');
  assert.equal(withBase('/models/a320.glb?v=2#x', BASE, PAGE), '/gods-eye-view/models/a320.glb?v=2#x');
});

test('same-origin absolute URLs move too, keeping their type', () => {
  assert.equal(
    withBase('https://wharkema.nl/api/ais-live?x=1', BASE, PAGE),
    'https://wharkema.nl/gods-eye-view/api/ais-live?x=1',
  );
  const url = withBase(new URL('https://wharkema.nl/models/x.glb'), BASE, PAGE);
  assert.ok(url instanceof URL);
  assert.equal(url.pathname, '/gods-eye-view/models/x.glb');
});

test('relative, already-prefixed, cross-origin and data URLs pass through', () => {
  for (const input of [
    'api/sessie',
    './cesium/Assets/x.json',
    '/gods-eye-view/api/x',
    'https://tile.googleapis.com/v1/3dtiles/root.json',
    '//cdn.example.com/x.js',
    'data:image/png;base64,AAAA',
    'blob:https://wharkema.nl/1234',
  ]) {
    assert.equal(withBase(input, BASE, PAGE), input, input);
  }
});

test('at the site root nothing changes', () => {
  assert.equal(withBase('/api/x', '/', 'http://localhost:4173/'), '/api/x');
});

test('the base comes from the built chunk URL', () => {
  assert.equal(basePathFromModuleUrl('https://wharkema.nl/gods-eye-view/assets/index-abc.js'), '/gods-eye-view/');
  assert.equal(basePathFromModuleUrl('http://localhost:4173/assets/index-abc.js'), '/');
  assert.equal(basePathFromModuleUrl('not a url'), '/');
});
