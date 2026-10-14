/**
 * Run the app under a sub-path (e.g. https://wharkema.nl/gods-eye-view/).
 *
 * The production build uses a relative base, so bundles, CSS and Cesium
 * assets already resolve under whatever path serves index.html. The source
 * code, however, calls the local proxies with root-absolute URLs ('/api/…',
 * '/models/…') in ~100 places. Behind a reverse proxy that mounts the app on a
 * sub-path those would escape to the site root, so this module prefixes every
 * same-origin request that falls outside the app's base path.
 *
 * At the root (local dev, Render) BASE is '/' and nothing is patched.
 * Import it first in main.js, before any module issues a request.
 */

/**
 * The path the app is served from, always ending in '/'. Derived from this
 * module's own URL: the built chunk lives in <base>/assets/, the dev source in
 * /src/, so one level up is the base either way.
 */
export const BASE = new URL('../', import.meta.url).pathname;

/**
 * Prefix a same-origin URL with `base` when it points outside it.
 * Relative URLs already resolve under the page, cross-origin URLs belong to
 * someone else: both pass through untouched.
 *
 * @param {string|URL} input
 * @param {string} [base]
 * @param {string} [pageHref] - Page URL used to resolve and to judge same-origin.
 * @returns {string|URL} The input itself when unchanged, else the prefixed URL.
 */
export function withBase(input, base = BASE, pageHref = globalThis.location?.href) {
  if (base === '/' || !pageHref) return input;
  if (typeof input !== 'string' && !(input instanceof URL)) return input;
  const raw = String(input);
  const rootAbsolute = raw.startsWith('/') && !raw.startsWith('//');
  if (!rootAbsolute && !/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.startsWith('//')) return input;
  let url;
  try {
    url = new URL(raw, pageHref);
  } catch {
    return input;
  }
  // blob: URLs share the page origin but are not paths on the server.
  if (!/^https?:$/.test(url.protocol) || url.origin !== new URL(pageHref).origin) return input;
  if (url.pathname.startsWith(base) || `${url.pathname}/` === base) return input;
  url.pathname = base + url.pathname.replace(/^\/+/, '');
  if (rootAbsolute) return url.pathname + url.search + url.hash;
  return input instanceof URL ? url : url.href;
}

function installBasePath() {
  if (BASE === '/' || typeof window === 'undefined') return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (input instanceof Request) {
      const next = withBase(input.url);
      return nativeFetch(next === input.url ? input : new Request(next, input), init);
    }
    return nativeFetch(withBase(input), init);
  };

  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
    return nativeOpen.call(this, method, withBase(url), ...rest);
  };

  if (navigator.sendBeacon) {
    const nativeBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => nativeBeacon(withBase(url), data);
  }

  const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (srcDescriptor?.set) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      ...srcDescriptor,
      set(value) {
        srcDescriptor.set.call(this, withBase(value));
      },
    });
  }
}

installBasePath();
