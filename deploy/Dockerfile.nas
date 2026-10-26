# Production container for the Synology NAS (docs/deploy-nas.md), used by
# deploy/compose.nas.yaml. Upstream's ./Dockerfile runs the Vite dev server on a
# bind-mounted checkout; the NAS instead builds once and serves the build with
# `vite preview` behind nginx on https://wharkema.nl/gods-eye-view.
FROM node:24-bookworm-slim

# Puppeteer is only for the QA scripts; never download a browser into the image
ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    # The fork's self-hosting layer (server/wharkema/hosting.js): login, relative
    # build base, preview providers, Map Labels
    GEV_SELF_HOSTING=1 \
    # On the internet always log in: without accounts in .env the server does not start
    APP_LOGIN_VERPLICHT=1

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit

COPY --chown=node:node . .

# The Google, Cesium and Mapillary client keys are compiled into the browser
# bundle (client-side keys by design). deploy/compose.nas.yaml passes them in from .env.
ARG GOOGLE_MAPS_API_KEY=""
ARG CESIUM_ION_TOKEN=""
ARG MAPILLARY_CLIENT_TOKEN=""
RUN npm run build \
    && mkdir -p .gev-cache .gev-logs

ENV HOST=0.0.0.0 \
    PORT=4173
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# vite preview serves dist/ and every /api provider (server/wharkema/hosting.js)
CMD ["node", "node_modules/vite/bin/vite.js", "preview"]
