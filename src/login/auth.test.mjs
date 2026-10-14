import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LoginConfig,
  LoginConfigFout,
  MAX_POGINGEN,
  Pogingen,
  SESSIEDUUR,
  controleerWachtwoord,
  hashWachtwoord,
  loadLoginConfig,
  parseGebruikers,
  relatief,
} from './auth.js';

// Made by superp_login (wharkema/TTD2026, Python) for 'correct horse battery':
// a line from that tool must work here unchanged.
const PYTHON_HASH = 'pbkdf2-sha256.100000.AAECAwQFBgcICQoLDA0ODw.yNEi7NuUd81IprF1DFmFwLiwUVjQQNIFF8zbSYZd5DY';
const GEHEIM = 'x'.repeat(40);

test('a hash made by the Python superp_login tool verifies', () => {
  assert.equal(controleerWachtwoord('correct horse battery', PYTHON_HASH), true);
  assert.equal(controleerWachtwoord('wrong', PYTHON_HASH), false);
});

test('hashWachtwoord round-trips and rejects weak or malformed hashes', () => {
  const hash = hashWachtwoord('een lang wachtwoord', undefined, 100_000);
  assert.match(hash, /^pbkdf2-sha256\.100000\.[\w-]+\.[\w-]+$/);
  assert.equal(controleerWachtwoord('een lang wachtwoord', hash), true);
  assert.equal(controleerWachtwoord('ander', hash), false);
  assert.equal(controleerWachtwoord('x', 'pbkdf2-sha256.1000.AAAA.AAAA'), false, 'too few iterations');
  assert.equal(controleerWachtwoord('x', 'onzin'), false);
  assert.equal(controleerWachtwoord('x', ''), false);
});

test('parseGebruikers reads name=hash pairs and refuses anything else', () => {
  const gebruikers = parseGebruikers(` wesley=${PYTHON_HASH} , `);
  assert.deepEqual([...gebruikers.keys()], ['wesley']);
  assert.throws(() => parseGebruikers('wesley=geheim123'), LoginConfigFout);
  assert.throws(() => parseGebruikers(`=${PYTHON_HASH}`), LoginConfigFout);
  assert.equal(parseGebruikers('').size, 0);
});

test('loadLoginConfig: off without accounts, refuses to start when required', () => {
  assert.equal(loadLoginConfig({}).actief, false);
  assert.throws(() => loadLoginConfig({ APP_LOGIN_VERPLICHT: '1' }), LoginConfigFout);
  assert.throws(
    () => loadLoginConfig({ APP_GEBRUIKERS: `w=${PYTHON_HASH}`, APP_GEHEIM: 'kort' }),
    LoginConfigFout,
  );
  const config = loadLoginConfig({
    APP_GEBRUIKERS: `w=${PYTHON_HASH}`,
    APP_GEHEIM: GEHEIM,
    APP_COOKIE_PAD: 'gods-eye-view',
    APP_COOKIE_SECURE: '0',
  });
  assert.equal(config.actief, true);
  assert.equal(config.cookiePad, '/gods-eye-view');
  assert.equal(config.cookieSecure, false);
});

function config() {
  return new LoginConfig({ gebruikers: parseGebruikers(`w=${PYTHON_HASH}`), geheim: GEHEIM });
}

test('sessions verify, expire, and resist tampering', () => {
  const c = config();
  const nu = 1_700_000_000;
  const sessie = c.maakSessie('w', nu);
  assert.equal(c.leesSessie(sessie, nu + 10), 'w');
  assert.equal(c.leesSessie(sessie, nu + SESSIEDUUR + 1), null, 'expired');
  const [payload, sig] = sessie.split('.');
  assert.equal(c.leesSessie(`${payload}.${sig.slice(0, -2)}xx`, nu), null, 'bad signature');
  const vals = Buffer.from(JSON.stringify({ g: 'w', v: nu + 99_999 })).toString('base64url');
  assert.equal(c.leesSessie(`${vals}.${sig}`, nu), null, 'payload swapped');
  assert.equal(c.leesSessie('onzin', nu), null);
  const ander = new LoginConfig({ gebruikers: parseGebruikers(`w=${PYTHON_HASH}`), geheim: 'y'.repeat(40) });
  assert.equal(ander.leesSessie(sessie, nu), null, 'other secret');
});

test('controleer: right password only, unknown user is false', () => {
  const c = config();
  assert.equal(c.controleer('w', 'correct horse battery'), true);
  assert.equal(c.controleer('w', 'fout'), false);
  assert.equal(c.controleer('onbekend', 'correct horse battery'), false);
});

test('Pogingen blocks after the maximum and resets on success', () => {
  const p = new Pogingen();
  for (let i = 0; i < MAX_POGINGEN; i += 1) p.registreerMislukt('W', 100);
  assert.equal(p.geblokkeerd('w', 101), true);
  assert.equal(p.geblokkeerd('w', 100 + 15 * 60 + 1), false, 'block expires');
  p.registreerMislukt('w', 100);
  p.gelukt('w');
  assert.equal(p.geblokkeerd('w', 101), false);
});

test('relatief climbs back to the app root', () => {
  assert.equal(relatief('/', 'login'), 'login');
  assert.equal(relatief('/index.html', 'login'), 'login');
  assert.equal(relatief('/api/x', 'login'), '../login');
  assert.equal(relatief('/a/b/c?q=1', 'login'), '../../login');
});
