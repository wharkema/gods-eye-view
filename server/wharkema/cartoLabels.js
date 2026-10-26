/**
 * CARTO label tiles for the Map Labels layer (src/layers/mapLabels).
 *
 * Since 25 September 2026 CARTO only serves raster basemap tiles with a key
 * (?key=…); without one every tile carries an "API KEY REQUIRED" watermark.
 * The key comes from CARTO_API_KEY server-side only — the browser fetches
 * same-origin `api/carto/labels/{z}/{x}/{y}.png`. Keyless, the proxy still
 * forwards the request, which is the old behaviour.
 *
 * GET /api/carto/status → {hasKey}.
 */
export function cartoLabelsProxy() {
  const UPSTREAM = 'https://basemaps.cartocdn.com/dark_only_labels';
  const MAX_ZOOM = 20;
  const UPSTREAM_TIMEOUT_MS = 15000;

  return {
    name: 'carto-labels-proxy',
    configureServer(server) {
      server.middlewares.use('/api/carto', async (req, res) => {
        const sendJson = (status, obj) => {
          if (res.headersSent) return;
          res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify(obj));
        };
        const urlPath = String(req.url || '').split('?')[0];
        if (urlPath === '/status') {
          sendJson(200, { hasKey: Boolean(process.env.CARTO_API_KEY) });
          return;
        }
        const m = urlPath.match(/^\/labels\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})\.png$/);
        const z = m ? Number(m[1]) : NaN;
        const x = m ? Number(m[2]) : NaN;
        const y = m ? Number(m[3]) : NaN;
        if (!m || z > MAX_ZOOM || x >= 2 ** z || y >= 2 ** z) {
          sendJson(404, { error: 'not_found' });
          return;
        }
        const key = process.env.CARTO_API_KEY;
        // Sanitized responses only: never echo the key or the upstream URL.
        const url = `${UPSTREAM}/${z}/${x}/${y}@2x.png${key ? `?key=${encodeURIComponent(key)}` : ''}`;
        try {
          const upstream = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
          if (!upstream.ok) {
            sendJson(upstream.status === 404 ? 404 : 502, { error: 'upstream' });
            return;
          }
          const buf = Buffer.from(await upstream.arrayBuffer());
          if (res.headersSent) return;
          res.writeHead(200, {
            'Content-Type': upstream.headers.get('content-type') || 'image/png',
            // Labels change rarely; private because the app may sit behind a login.
            'Cache-Control': 'private, max-age=86400',
          });
          res.end(buf);
        } catch {
          sendJson(502, { error: 'upstream' });
        }
      });
    },
  };
}
