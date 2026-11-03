/**
 * Self-hosting fork: keep index.html working under a sub-path
 * (wharkema.nl/gods-eye-view, docs/deploy-nas.md).
 *
 *  - Build: root-absolute local URLs in index.html and in the Vue templates
 *    (`/logo.svg`, `/pin.svg`, `/mic.svg`) become relative, like the bundles
 *    Vite already writes with base './'. Behind nginx a `/logo.svg` would
 *    escape to the site root, and Vue writes static markup as HTML, past the
 *    `img.src` shim in src/selfHosting/basePath.js.
 *  - Preview: a short share link, `<app>/share/<code>` (src/share/), gets
 *    index.html with `<base href="../">`, so its relative bundles resolve at
 *    the app root instead of under `share/`. At the site root upstream's
 *    absolute base needs none of this.
 */
import fs from 'node:fs';
import path from 'node:path';

const SHARE_PATH = /^\/share\/[^/]+\/?$/;

/**
 * '/logo.svg' → './logo.svg' in src, href and data-*-src attributes;
 * protocol-relative ('//…') and absolute URLs are left alone.
 * @param {string} html
 * @param {string} [prefix] - What replaces the leading '/'.
 * @returns {string}
 */
export function relativizeRootUrls(html, prefix = './') {
  return html.replace(
    /(\s(?:src|href|data-[a-z-]*src)=")\/(?!\/)/g,
    (_match, attribute) => `${attribute}${prefix}`,
  );
}

/**
 * Point every relative URL of the page at the app root.
 * @param {string} html
 * @returns {string}
 */
export function withShareBase(html) {
  return html.replace(/<head([^>]*)>/i, '<head$1>\n    <base href="../" />');
}

/** True for `/share/<code>` (query string ignored). */
export function isSharePath(url) {
  return SHARE_PATH.test(String(url || '').split('?')[0]);
}

export function subPathHtml() {
  return {
    name: 'gev-sub-path-html',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].endsWith('.vue')) return null;
      // Bare 'logo.svg', not './logo.svg': the Vue compiler would turn a
      // './' URL into a module import.
      const next = relativizeRootUrls(code, '');
      return next === code ? null : { code: next, map: null };
    },
    transformIndexHtml: {
      order: 'post',
      handler: (html) => relativizeRootUrls(html),
    },
  };
}

export function sharePathPreview() {
  return {
    name: 'gev-share-path-preview',
    configurePreviewServer(server) {
      const indexFile = path.resolve(
        server.config.root,
        server.config.build.outDir,
        'index.html',
      );
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        if (!isSharePath(req.url)) return next();
        let html;
        try {
          html = fs.readFileSync(indexFile, 'utf8');
        } catch {
          return next();
        }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        });
        res.end(req.method === 'HEAD' ? undefined : withShareBase(html));
      });
    },
  };
}
