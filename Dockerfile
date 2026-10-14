# Container for the Synology NAS (Container Manager), see docs/deploy-nas.md.
# Local test: docker compose up --build
FROM node:24-bookworm-slim

# Puppeteer is only for the QA scripts; never download a browser into the image
ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    # On the internet always log in: without accounts in .env the server does not start
    APP_LOGIN_VERPLICHT=1

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit

COPY --chown=node:node . .

# The Google and Cesium keys are compiled into the browser bundle (they are
# client-side keys by design). docker-compose.yml passes them in from .env.
ARG GOOGLE_MAPS_API_KEY=""
ARG CESIUM_ION_TOKEN=""
RUN npm run build \
    && mkdir -p .gev-cache .gev-logs

EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# vite preview is the production server: it serves dist/ and every /api proxy
CMD ["npm", "start"]
