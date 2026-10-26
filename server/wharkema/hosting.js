/**
 * Self-hosting additions for wharkema.nl/gods-eye-view (docs/deploy-nas.md),
 * kept in one place so the upstream config files change by a line or two.
 * Off unless GEV_SELF_HOSTING=1 (set by deploy/Dockerfile.nas, or in a local
 * .env), so upstream's own behaviour and tests stay exactly as they are:
 *
 *  - the login gate runs first after the Host check, so nothing answers
 *    without a session (when APP_GEBRUIKERS is set);
 *  - every provider also runs under `vite preview`, the production server on
 *    the NAS (upstream only runs the dev server);
 *  - a build uses a relative base, so one build serves at the site root and
 *    behind nginx on a sub-path (src/basePath.js covers root-absolute URLs);
 *  - `vite preview` gets the same host, port and Host allowlist as dev;
 *  - the CARTO label proxy for the Map Labels layer (CARTO_API_KEY).
 */
import { loginGate } from './login/plugin.js';
import { alsoServeInPreview } from './preview.js';
import { cartoLabelsProxy } from './cartoLabels.js';

/**
 * @param {import('vite').UserConfig} config - From createBrowserViteConfig.
 * @param {{command?: string}} options
 * @returns {import('vite').UserConfig}
 */
export function applySelfHosting(config, { command, env = process.env } = {}) {
  if (env.GEV_SELF_HOSTING !== '1') return config;
  const plugins = (config.plugins || []).map(alsoServeInPreview);
  // Fork-only API routes go before upstream's /api 404 catch-all.
  const notFound = plugins.findIndex(
    (plugin) => plugin?.name === 'api-not-found',
  );
  plugins.splice(
    notFound < 0 ? plugins.length : notFound,
    0,
    alsoServeInPreview(cartoLabelsProxy()),
  );
  const hostCheck = plugins.findIndex(
    (plugin) => plugin?.name === 'host-check',
  );
  plugins.splice(hostCheck + 1, 0, loginGate());
  return {
    ...config,
    plugins,
    base: command === 'build' ? './' : '/',
    // The client registers the fork's own layers (Map Labels) only here.
    define: {
      ...config.define,
      'import.meta.env.GEV_SELF_HOSTING': JSON.stringify('1'),
    },
    preview: {
      ...config.preview,
      host: config.server?.host,
      port: config.server?.port,
      allowedHosts: config.server?.allowedHosts,
    },
  };
}
