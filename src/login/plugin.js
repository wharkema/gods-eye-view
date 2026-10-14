/**
 * Vite plugin: puts the whole app (page, assets and every /api proxy) behind
 * the login from ./auth.js. Registered first, so nothing answers before it.
 *
 * Open without a session: /login, /login-bestanden/*, /api/health, /api/sessie.
 * Without a session a page request gets 303 → login, an /api/ call gets 401.
 * All redirects are relative, so this also works under a sub-path behind nginx.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COOKIE,
  SESSIEDUUR,
  Pogingen,
  loadLoginConfig,
  relatief,
} from './auth.js';

const STATIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'static');
const STATIC_FILES = {
  'login.css': 'text/css; charset=utf-8',
  'login.js': 'text/javascript; charset=utf-8',
  'login-pulse.js': 'text/javascript; charset=utf-8',
};
const MAX_BODY = 8 * 1024;

function leesCookie(req, naam) {
  for (const deel of String(req.headers.cookie || '').split(';')) {
    const i = deel.indexOf('=');
    if (i > 0 && deel.slice(0, i).trim() === naam) return deel.slice(i + 1).trim();
  }
  return null;
}

function leesFormulier(req) {
  return new Promise((resolve, reject) => {
    let grootte = 0;
    const delen = [];
    req.on('data', (chunk) => {
      grootte += chunk.length;
      if (grootte > MAX_BODY) {
        reject(new Error('te groot'));
        req.destroy();
        return;
      }
      delen.push(chunk);
    });
    req.on('end', () => resolve(new URLSearchParams(Buffer.concat(delen).toString('utf8'))));
    req.on('error', reject);
  });
}

function stuur(res, status, body, headers = {}) {
  if (res.headersSent) return;
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

const json = (res, status, obj) => stuur(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json' });
const doorsturen = (res, naar, headers = {}) => stuur(res, 303, '', { Location: naar, ...headers });

/**
 * Build the connect middleware. Exported for tests.
 * @param {import('./auth.js').LoginConfig} config
 */
export function maakLoginMiddleware(config) {
  const pogingen = new Pogingen();
  const pagina = fs.readFileSync(path.join(STATIC_DIR, 'login.html'));

  const cookie = (waarde, maxAge) => [
    `${COOKIE}=${waarde}`,
    `Path=${config.cookiePad}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(config.cookieSecure ? ['Secure'] : []),
  ].join('; ');

  return async function loginMiddleware(req, res, next) {
    const rawUrl = req.url || '/';
    const pad = rawUrl.split('?')[0].split('#')[0];
    const methode = req.method || 'GET';

    if (pad === '/api/health') {
      json(res, 200, { status: 'ok' });
      return;
    }

    if (!config.actief) {
      if (pad === '/api/sessie') {
        json(res, 200, { login: false, gebruiker: null });
        return;
      }
      if (pad === '/login' || pad === '/uitloggen') {
        doorsturen(res, relatief(pad, './'));
        return;
      }
      next();
      return;
    }

    const gebruiker = config.leesSessie(leesCookie(req, COOKIE));

    if (pad === '/api/sessie') {
      json(res, 200, { login: true, gebruiker });
      return;
    }

    if (pad.startsWith('/login-bestanden/')) {
      const naam = pad.slice('/login-bestanden/'.length);
      const type = STATIC_FILES[naam];
      if (!type) {
        stuur(res, 404, 'Not found\n', { 'Content-Type': 'text/plain; charset=utf-8' });
        return;
      }
      stuur(res, 200, fs.readFileSync(path.join(STATIC_DIR, naam)), { 'Content-Type': type });
      return;
    }

    if (pad === '/login') {
      if (methode === 'POST') {
        let formulier;
        try {
          formulier = await leesFormulier(req);
        } catch {
          stuur(res, 413, 'Too large\n', { 'Content-Type': 'text/plain; charset=utf-8' });
          return;
        }
        const naam = String(formulier.get('gebruiker') || '').trim().slice(0, 100);
        const wachtwoord = String(formulier.get('wachtwoord') || '').slice(0, 200);
        if (pogingen.geblokkeerd(naam)) {
          doorsturen(res, 'login?fout=geblokkeerd');
          return;
        }
        if (!naam || !config.controleer(naam, wachtwoord)) {
          pogingen.registreerMislukt(naam);
          doorsturen(res, 'login?fout=onjuist');
          return;
        }
        pogingen.gelukt(naam);
        doorsturen(res, './', { 'Set-Cookie': cookie(config.maakSessie(naam), SESSIEDUUR) });
        return;
      }
      if (gebruiker) {
        doorsturen(res, './');
        return;
      }
      stuur(res, 200, pagina, {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'same-origin',
      });
      return;
    }

    if (pad === '/uitloggen') {
      doorsturen(res, 'login', { 'Set-Cookie': cookie('', 0) });
      return;
    }

    if (gebruiker) {
      next();
      return;
    }
    if (pad.startsWith('/api/')) {
      json(res, 401, { error: 'login_vereist' });
      return;
    }
    doorsturen(res, relatief(pad, 'login'));
  };
}

/**
 * The plugin. Reads the settings once at startup; wrong settings stop the
 * server with a clear message instead of running unprotected.
 */
export function loginGate() {
  const install = (server) => {
    const config = loadLoginConfig(process.env);
    if (config.actief) {
      server.config.logger.info(`  Login aan: ${config.gebruikers.size} account(s), cookiepad ${config.cookiePad}`);
    }
    server.middlewares.use(maakLoginMiddleware(config));
  };
  return {
    name: 'login-gate',
    configureServer: install,
    configurePreviewServer: install,
  };
}
