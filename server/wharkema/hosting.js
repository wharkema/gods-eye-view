/**
 * Self-hosting additions for wharkema.nl/gods-eye-view (docs/deploy-nas.md),
 * kept in one place so the upstream config files change by a line or two:
 *
 *  - the login gate runs first after the Host check, so nothing answers
 *    without a session (when APP_GEBRUIKERS is set);
 *  - every provider also runs under `vite preview`, the production server on
 *    the NAS (upstream only runs the dev server);
 *  - a build uses a relative base, so one build serves at the site root and
 *    behind nginx on a sub-path (src/basePath.js covers root-absolute URLs);
 *  - `vite preview` gets the same host, port and Host allowlist as dev.
 */
import { loginGate } from './login/plugin.js';
import { alsoServeInPreview } from './preview.js';

/**
 * @param {import('vite').UserConfig} config - From createBrowserViteConfig.
 * @param {{command?: string}} options
 * @returns {import('vite').UserConfig}
 */
export function applySelfHosting(config, { command } = {}) {
  const plugins = (config.plugins || []).map(alsoServeInPreview);
  const hostCheck = plugins.findIndex((plugin) => plugin?.name === 'host-check');
  plugins.splice(hostCheck + 1, 0, loginGate());
  return {
    ...config,
    plugins,
    base: command === 'build' ? './' : '/',
    preview: {
      ...config.preview,
      host: config.server?.host,
      port: config.server?.port,
      allowedHosts: config.server?.allowedHosts,
    },
  };
}
