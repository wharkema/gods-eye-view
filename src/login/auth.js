/**
 * Login with an account from .env, the session in a signed cookie.
 *
 * Port of the password half of superp_login (wharkema/TTD2026) to Node, with
 * the same formats, so a hash or secret made with either tool works in both:
 *
 *   APP_GEBRUIKERS=naam=pbkdf2-sha256.<iteraties>.<salt>.<digest>[,naam2=…]
 *   APP_GEHEIM=<minstens 32 tekens>
 *
 * Without accounts the login is off (local use). With APP_LOGIN_VERPLICHT=1
 * (the container on the NAS) the server refuses to start without one.
 *
 * Make an account:  node scripts/login.mjs hash
 * Make a secret:    node scripts/login.mjs geheim
 */

import crypto from 'node:crypto';

export const COOKIE = 'gev_sessie';
export const SESSIEDUUR = 8 * 3600; // seconds; log in again after that
export const ITERATIES = 600_000;
const MIN_ITERATIES = 100_000;
export const MIN_GEHEIM = 32; // characters
export const MAX_POGINGEN = 5; // failed attempts per username ...
export const BLOKKADE = 15 * 60; // ... within this many seconds, then blocked that long
const ALGORITME = 'pbkdf2-sha256';

/** The login settings in .env are wrong; the server does not start. */
export class LoginConfigFout extends Error {}

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const unb64 = (text) => Buffer.from(text, 'base64url');

/** Format without '$' or ':', so it fits safely in .env and docker compose. */
export function hashWachtwoord(wachtwoord, salt = crypto.randomBytes(16), iteraties = ITERATIES) {
  const digest = crypto.pbkdf2Sync(String(wachtwoord), salt, iteraties, 32, 'sha256');
  return `${ALGORITME}.${iteraties}.${b64(salt)}.${b64(digest)}`;
}

export function controleerWachtwoord(wachtwoord, opgeslagen) {
  const delen = String(opgeslagen || '').split('.');
  if (delen.length !== 4) return false;
  const [algoritme, iteraties, salt, digest] = delen;
  const n = Number.parseInt(iteraties, 10);
  if (algoritme !== ALGORITME || !Number.isFinite(n) || n < MIN_ITERATIES) return false;
  const verwacht = unb64(digest);
  if (verwacht.length === 0) return false;
  const berekend = crypto.pbkdf2Sync(String(wachtwoord), unb64(salt), n, verwacht.length, 'sha256');
  return crypto.timingSafeEqual(berekend, verwacht);
}

// Still hash for an unknown username, so the response time gives nothing away.
let dummyHash = null;
const dummy = () => (dummyHash ??= hashWachtwoord(crypto.randomBytes(16).toString('hex')));

/** APP_GEBRUIKERS=naam=hash,naam2=hash2 */
export function parseGebruikers(waarde) {
  const gebruikers = new Map();
  for (const ruw of String(waarde || '').split(',')) {
    const deel = ruw.trim();
    if (!deel) continue;
    const i = deel.indexOf('=');
    const naam = i > 0 ? deel.slice(0, i).trim() : '';
    const opgeslagen = i > 0 ? deel.slice(i + 1).trim() : '';
    if (!naam || !opgeslagen.startsWith(`${ALGORITME}.`)) {
      throw new LoginConfigFout(
        `Ongeldig account in APP_GEBRUIKERS: ${JSON.stringify(naam || deel.slice(0, 10))}. `
        + 'Maak de regel met: node scripts/login.mjs hash',
      );
    }
    gebruikers.set(naam, opgeslagen);
  }
  return gebruikers;
}

function ja(waarde, standaard) {
  if (waarde === undefined || waarde === null || !String(waarde).trim()) return standaard;
  return ['1', 'true', 'ja', 'yes', 'aan', 'on'].includes(String(waarde).trim().toLowerCase());
}

export class LoginConfig {
  constructor({ gebruikers = new Map(), geheim = '', cookieSecure = true, cookiePad = '/' } = {}) {
    this.gebruikers = gebruikers;
    this.geheim = Buffer.from(geheim, 'utf8');
    this.cookieSecure = cookieSecure;
    this.cookiePad = cookiePad;
  }

  get actief() {
    return this.gebruikers.size > 0;
  }

  // The password hash is part of the key: a new password invalidates old sessions.
  handtekening(payload, naam) {
    const sleutel = Buffer.concat([
      this.geheim,
      Buffer.from('sessie', 'ascii'),
      Buffer.from(this.gebruikers.get(naam) || '', 'utf8'),
    ]);
    return b64(crypto.createHmac('sha256', sleutel).update(payload, 'ascii').digest());
  }

  maakSessie(naam, nu = Date.now() / 1000) {
    const payload = b64(JSON.stringify({ g: naam, v: Math.floor(nu) + SESSIEDUUR }));
    return `${payload}.${this.handtekening(payload, naam)}`;
  }

  /** The username of a valid, unexpired session, else null. */
  leesSessie(waarde, nu = Date.now() / 1000) {
    if (!waarde || !this.actief) return null;
    const delen = String(waarde).split('.');
    if (delen.length !== 2) return null;
    const [payload, handtekening] = delen;
    let naam;
    let verloopt;
    try {
      const gegevens = JSON.parse(unb64(payload).toString('utf8'));
      naam = String(gegevens.g);
      verloopt = Number.parseInt(gegevens.v, 10);
    } catch {
      return null;
    }
    if (!this.gebruikers.has(naam) || !Number.isFinite(verloopt)) return null;
    const verwacht = Buffer.from(this.handtekening(payload, naam));
    const gekregen = Buffer.from(handtekening);
    if (verwacht.length !== gekregen.length || !crypto.timingSafeEqual(verwacht, gekregen)) return null;
    return nu < verloopt ? naam : null;
  }

  controleer(naam, wachtwoord) {
    const opgeslagen = this.gebruikers.get(naam);
    if (opgeslagen === undefined) {
      controleerWachtwoord(wachtwoord, dummy());
      return false;
    }
    return controleerWachtwoord(wachtwoord, opgeslagen);
  }
}

export function loadLoginConfig(env = process.env) {
  const gebruikers = parseGebruikers(env.APP_GEBRUIKERS);
  if (gebruikers.size === 0) {
    if (ja(env.APP_LOGIN_VERPLICHT, false)) {
      throw new LoginConfigFout(
        'APP_LOGIN_VERPLICHT staat aan, maar APP_GEBRUIKERS is leeg. '
        + 'Maak een account met: node scripts/login.mjs hash',
      );
    }
    return new LoginConfig();
  }
  const geheim = String(env.APP_GEHEIM || '');
  if (geheim.length < MIN_GEHEIM) {
    throw new LoginConfigFout(
      `APP_GEHEIM moet minstens ${MIN_GEHEIM} tekens zijn. Maak er een met: node scripts/login.mjs geheim`,
    );
  }
  const pad = String(env.APP_COOKIE_PAD || '/').trim() || '/';
  return new LoginConfig({
    gebruikers,
    geheim,
    cookieSecure: ja(env.APP_COOKIE_SECURE, true),
    cookiePad: pad.startsWith('/') ? pad : `/${pad}`,
  });
}

/** Counts failed login attempts per username (in memory) and blocks for a while. */
export class Pogingen {
  constructor() {
    this.mislukt = new Map();
  }

  recent(naam, nu) {
    const sleutel = String(naam).toLowerCase();
    const lijst = (this.mislukt.get(sleutel) || []).filter((t) => nu - t < BLOKKADE);
    this.mislukt.set(sleutel, lijst);
    return lijst;
  }

  geblokkeerd(naam, nu = Date.now() / 1000) {
    return this.recent(naam, nu).length >= MAX_POGINGEN;
  }

  registreerMislukt(naam, nu = Date.now() / 1000) {
    this.recent(naam, nu).push(nu);
  }

  gelukt(naam) {
    this.mislukt.delete(String(naam).toLowerCase());
  }
}

/** Relative URL to `doel` in the app's root; also works under a sub-path behind a proxy. */
export function relatief(pad, doel) {
  const diepte = Math.max(String(pad).split('?')[0].split('/').length - 2, 0);
  return '../'.repeat(diepte) + doel;
}
