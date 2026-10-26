/**
 * Map Labels — town, neighbourhood and street names over the live globe.
 *
 * Google's Photorealistic 3D Tiles ship without cartographic labels, so this
 * drapes a transparent label-only raster (OpenStreetMap data rendered by CARTO)
 * on whatever surface the map stack offers: the 3D tileset (Cesium drapes
 * imagery on tiles), or the globe on a 2D/keyless stack. The shell hands the
 * layer that host the same way it does for the weather layers.
 *
 * CARTO serves raster tiles only with a key since 25 September 2026; the tiles
 * come through the same-origin proxy (server/wharkema/cartoLabels.js), which
 * adds CARTO_API_KEY server-side. The relative URL also works under a sub-path.
 *
 * Attribution: © OpenStreetMap contributors, © CARTO.
 */
import * as Cesium from 'cesium';

/** Label-only raster through the local proxy. */
const CARTO_LABELS_URL = 'api/carto/labels/{z}/{x}/{y}.png';
/** CARTO serves these to z20; asking past it returns 404s, not sharper text. */
const CARTO_MAX_ZOOM = 20;
/**
 * CARTO draws the names light grey on a dark halo. Brightening the layer
 * multiplies every channel, so the grey type clips to white while the halo
 * stays dark — white names that still read on bright roofs.
 */
const LABEL_BRIGHTNESS = 1.8;

/** @returns {object} A data layer for the DataLayerManager. */
export function createMapLabelsLayer({
  cesium = Cesium,
  eventTarget = globalThis.window,
} = {}) {
  let viewer = null;
  let imageryHost = null;
  let imageryLayer = null;
  let collection = null;
  let enabled = false;
  let status = 'idle';
  let removeCamera = null;

  const hostCollection = () => {
    const host = imageryHost?.();
    if (host?.collection) return host.collection;
    return viewer?.scene?.globe?.show ? viewer.imageryLayers : null;
  };

  const buildImageryLayer = () => {
    const provider = new cesium.UrlTemplateImageryProvider({
      url: CARTO_LABELS_URL,
      maximumLevel: CARTO_MAX_ZOOM,
      credit: new cesium.Credit('© OpenStreetMap contributors, © CARTO', false),
    });
    const layer = new cesium.ImageryLayer(provider);
    // An overlay, never a basemap: fully on top, transparent elsewhere.
    layer.alpha = 1.0;
    layer.brightness = LABEL_BRIGHTNESS;
    return layer;
  };

  const detach = () => {
    // `false` keeps the layer alive: destroying it would re-download every
    // visible label tile on each toggle.
    if (collection && imageryLayer && collection.contains?.(imageryLayer))
      collection.remove(imageryLayer, false);
    collection = null;
  };

  /** Put the labels on the current map stack's surface, on top. */
  const attach = () => {
    if (!enabled) return;
    const next = hostCollection();
    if (next === collection && (!next || next.contains?.(imageryLayer))) return;
    detach();
    if (!next) {
      status = 'unavailable';
      return;
    }
    imageryLayer ??= buildImageryLayer();
    next.add(imageryLayer);
    collection = next;
    status = 'live';
    viewer?.scene?.requestRender?.();
  };

  const onMapStackChanged = () => attach();

  return {
    id: 'map-labels',
    name: 'Map Labels',
    icon: '🏷️',
    source: 'OpenStreetMap / CARTO',
    // Raster imagery streams itself; nothing to poll.
    updateInterval: 0,
    init(nextViewer) {
      viewer = nextViewer;
      eventTarget?.addEventListener?.('gev:map-stack-changed', onMapStackChanged);
    },
    attachShellServices(services) {
      imageryHost =
        typeof services?.imageryHost === 'function' ? services.imageryHost : null;
      attach();
    },
    enable() {
      enabled = true;
      attach();
      // The host can change without an event (the tileset arrives late).
      removeCamera ??= viewer?.camera?.moveEnd?.addEventListener?.(attach) || null;
    },
    disable() {
      enabled = false;
      removeCamera?.();
      removeCamera = null;
      detach();
      status = 'idle';
      viewer?.scene?.requestRender?.();
    },
    update() {},
    getStats() {
      return {
        count: null,
        status,
        detail:
          status === 'unavailable'
            ? 'No surface to drape labels on'
            : 'Town, neighbourhood & street names (OSM / CARTO)',
      };
    },
    destroy() {
      this.disable();
      eventTarget?.removeEventListener?.('gev:map-stack-changed', onMapStackChanged);
      if (imageryLayer && !imageryLayer.isDestroyed?.()) imageryLayer.destroy?.();
      imageryLayer = null;
      viewer = null;
    },
  };
}
