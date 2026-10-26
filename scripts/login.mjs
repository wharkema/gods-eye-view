#!/usr/bin/env node
/**
 * Make the login settings for .env (see src/login/auth.js).
 *
 *   node scripts/login.mjs hash     asks name and password, prints the APP_GEBRUIKERS line
 *   node scripts/login.mjs geheim   prints an APP_GEHEIM line
 *
 * The formats match superp_login in wharkema/TTD2026, so lines made with
 * `python -m superp_login.auth hash` work here as well.
 */

import crypto from 'node:crypto';
import readline from 'node:readline';
import { hashWachtwoord } from '../server/wharkema/login/auth.js';

// One interface for every question: with piped input the lines arrive at
// once, and a second interface would lose them.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: Boolean(process.stdin.isTTY),
});
const regels = rl[Symbol.asyncIterator]();
let stil = false;
const schrijf = rl._writeToOutput?.bind(rl);
if (schrijf) {
  // While a password is typed, echo nothing.
  rl._writeToOutput = (s) => {
    if (!stil) schrijf(s);
  };
}

/** Ask a question; with `verborgen` the typed characters are not echoed. */
async function vraag(tekst, verborgen = false) {
  process.stdout.write(tekst);
  stil = verborgen;
  const { value } = await regels.next();
  stil = false;
  if (verborgen) process.stdout.write('\n');
  return value ?? '';
}

const opdracht = process.argv[2] || '';

if (opdracht === 'geheim') {
  console.log(`APP_GEHEIM=${crypto.randomBytes(48).toString('base64url')}`);
  rl.close();
} else if (opdracht === 'hash') {
  const naam = (await vraag('Gebruikersnaam: ')).trim();
  const wachtwoord = await vraag('Wachtwoord (minstens 12 tekens): ', true);
  const nogmaals = await vraag('Nogmaals: ', true);
  if (!naam || /[=,\s]/.test(naam)) {
    console.error('Gebruik een naam zonder spaties, = of komma.');
    process.exit(1);
  }
  if (wachtwoord.length < 12 || wachtwoord !== nogmaals) {
    console.error('Wachtwoord te kort of niet gelijk.');
    process.exit(1);
  }
  console.log('Zet dit in .env (meerdere accounts scheiden met een komma):');
  console.log(`APP_GEBRUIKERS=${naam}=${hashWachtwoord(wachtwoord)}`);
  rl.close();
} else {
  console.log('Gebruik: node scripts/login.mjs hash | geheim');
  process.exit(1);
}
