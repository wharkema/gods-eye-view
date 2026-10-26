import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { LoginConfig, parseGebruikers } from './auth.js';
import { maakLoginMiddleware } from './plugin.js';

const HASH = 'pbkdf2-sha256.100000.AAECAwQFBgcICQoLDA0ODw.yNEi7NuUd81IprF1DFmFwLiwUVjQQNIFF8zbSYZd5DY';
const WACHTWOORD = 'correct horse battery';

/** Run the middleware in a real HTTP server; `next` answers 200 'app'. */
async function metServer(config, fn) {
  const middleware = maakLoginMiddleware(config);
  const server = http.createServer((req, res) => {
    middleware(req, res, () => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('app');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const basis = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn((pad, init = {}) => fetch(basis + pad, { redirect: 'manual', ...init }));
  } finally {
    server.close();
  }
}

const aan = () => new LoginConfig({
  gebruikers: parseGebruikers(`wesley=${HASH}`),
  geheim: 'x'.repeat(40),
  cookieSecure: true,
  cookiePad: '/gods-eye-view',
});

const inloggen = (get, wachtwoord) => get('/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ gebruiker: 'wesley', wachtwoord }).toString(),
});

test('login off: the app is open, health answers, /login goes home', async () => {
  await metServer(new LoginConfig(), async (get) => {
    assert.equal(await (await get('/')).text(), 'app');
    assert.deepEqual(await (await get('/api/health')).json(), { status: 'ok' });
    assert.deepEqual(await (await get('/api/sessie')).json(), { login: false, gebruiker: null });
    const r = await get('/login');
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), './');
  });
});

test('login on: everything is closed without a session, with relative redirects', async () => {
  await metServer(aan(), async (get) => {
    let r = await get('/');
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), 'login');
    r = await get('/assets/index.js');
    assert.equal(r.headers.get('location'), '../login');
    r = await get('/api/tomtom/status');
    assert.equal(r.status, 401);
    assert.equal((await get('/api/health')).status, 200, 'health stays open for the container check');
    r = await get('/login');
    assert.equal(r.status, 200);
    assert.match(await r.text(), /action="login"/);
    assert.equal((await get('/login-bestanden/login.css')).status, 200);
    assert.equal((await get('/login-bestanden/%2e%2e%2fauth.js')).status, 404);
  });
});

test('a wrong password is refused, a right one opens the app with a scoped cookie', async () => {
  await metServer(aan(), async (get) => {
    let r = await inloggen(get, 'fout');
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), 'login?fout=onjuist');
    assert.equal(r.headers.get('set-cookie'), null);

    r = await inloggen(get, WACHTWOORD);
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), './');
    const setCookie = r.headers.get('set-cookie');
    assert.match(setCookie, /gev_sessie=[\w-]+\.[\w-]+/);
    assert.match(setCookie, /Path=\/gods-eye-view/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /Secure/);
    assert.match(setCookie, /SameSite=Lax/);
    const cookie = setCookie.split(';')[0];

    r = await get('/', { headers: { cookie } });
    assert.equal(await r.text(), 'app');
    r = await get('/api/tomtom/status', { headers: { cookie } });
    assert.equal(r.status, 200);
    assert.deepEqual(await (await get('/api/sessie', { headers: { cookie } })).json(), { login: true, gebruiker: 'wesley' });

    r = await get('/uitloggen', { method: 'POST', headers: { cookie } });
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), 'login');
    assert.match(r.headers.get('set-cookie'), /gev_sessie=;.*Max-Age=0/);
  });
});

test('five wrong passwords block the name, even for the right password', async () => {
  await metServer(aan(), async (get) => {
    for (let i = 0; i < 5; i += 1) await inloggen(get, 'fout');
    const r = await inloggen(get, WACHTWOORD);
    assert.equal(r.headers.get('location'), 'login?fout=geblokkeerd');
    assert.equal(r.headers.get('set-cookie'), null);
  });
});

test('behind the trusted nginx a logged-in request reaches providers as same-origin', async () => {
  const { trustProxiedRequest } = await import('./plugin.js');
  const req = { headers: {
    host: 'wharkema.nl', origin: 'https://wharkema.nl', 'x-forwarded-proto': 'https',
    'x-forwarded-for': '1.2.3.4', 'x-real-ip': '1.2.3.4', 'sec-fetch-site': 'same-origin',
  } };
  trustProxiedRequest(req);
  assert.equal(req.headers.origin, 'http://wharkema.nl');
  assert.equal(req.headers['x-forwarded-for'], undefined);
  assert.equal(req.headers['x-real-ip'], undefined);
  assert.equal(req.headers['sec-fetch-site'], 'same-origin', 'never touched');

  const foreign = { headers: { host: 'wharkema.nl', origin: 'https://evil.example', 'x-forwarded-proto': 'https' } };
  trustProxiedRequest(foreign);
  assert.equal(foreign.headers.origin, 'https://evil.example', 'a foreign Origin stays foreign');
});
