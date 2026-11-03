/**
 * Self-hosting fork: whether the server has the login on (server/wharkema/login),
 * for the logout button in the globe actions (src/selfHosting/LogoutButton.vue).
 * The path is relative, so this works under a sub-path too.
 */

/** True when the build is the self-hosted one (GEV_SELF_HOSTING=1). */
export const SELF_HOSTING = import.meta.env?.GEV_SELF_HOSTING === '1';

/**
 * Ask the server who is logged in.
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{login: boolean, gebruiker?: string}|null>} null when
 *   the login is off or the server did not answer.
 */
export async function fetchSession(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl('api/sessie');
    if (!response.ok) return null;
    const session = await response.json();
    return session?.login ? session : null;
  } catch {
    return null;
  }
}
