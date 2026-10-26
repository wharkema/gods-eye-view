/**
 * Serve dev-server middleware from `vite preview` as well.
 *
 * Upstream runs the app with the Vite dev server only, so its provider
 * plugins hook `configureServer`. On the NAS (docs/deploy-nas.md) the app runs
 * from a production build through `vite preview`; registering the same
 * middleware in `configurePreviewServer` keeps every /api route working there.
 */
export function alsoServeInPreview(plugin) {
  if (!plugin || typeof plugin.configureServer !== 'function') return plugin;
  if (typeof plugin.configurePreviewServer === 'function') return plugin;
  return {
    ...plugin,
    configurePreviewServer(server) {
      return plugin.configureServer(server);
    },
  };
}
