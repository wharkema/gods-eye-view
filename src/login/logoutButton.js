/**
 * Show the logout button when the server has the login on (src/login/plugin.js).
 * Paths are relative, so this works under a sub-path too.
 */
export function initLogoutButton(doc = document) {
  const knop = doc.getElementById('logout-btn');
  if (!knop) return;
  fetch('api/sessie')
    .then((r) => (r.ok ? r.json() : null))
    .then((sessie) => {
      if (!sessie?.login) return;
      knop.hidden = false;
      if (sessie.gebruiker) knop.title = `Uitloggen (${sessie.gebruiker})`;
    })
    .catch(() => {});
}
