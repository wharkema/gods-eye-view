#!/bin/sh
# Werkt de app op de NAS bij zodra er een nieuwe versie op main staat.
# Draait elke 5 minuten via DSM Taakplanner (als root), zie docs/deploy-nas.md.
#   sh /volume1/docker/gods-eye-view/deploy/nas-update.sh [map] [--forceer]
set -eu

MAP="${1:-/volume1/docker/gods-eye-view}"
FORCEER="${2:-}"
# Taakplanner van DSM kent /usr/local/bin (docker) niet altijd
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin"
cd "$MAP"

# De Taakplanner draait als root, de map kan van een andere gebruiker zijn: anders weigert git
# ("detected dubious ownership"). Alleen voor deze map, niet globaal.
git() { command git -c safe.directory="$MAP" "$@"; }

# Alleen main gaat live: daar staat code die getest en via een pull request gemerged is
git fetch --quiet origin main
HUIDIG=$(git rev-parse HEAD)
NIEUW=$(git rev-parse origin/main)
if [ "$HUIDIG" = "$NIEUW" ] && [ "$FORCEER" != "--forceer" ]; then
  exit 0
fi

if [ ! -f .env ]; then
  echo "Geen .env in $MAP: maak die eerst aan (zie docs/deploy-nas.md)." >&2
  exit 1
fi

git merge --ff-only --quiet origin/main

# The NAS compose file lives in deploy/; the repo root stays the project
# directory, so .env is read from there. (./compose.yaml is upstream's dev setup.)
COMPOSE_ARGS="--project-directory $MAP -f $MAP/deploy/compose.nas.yaml"
if docker compose version >/dev/null 2>&1; then
  docker compose $COMPOSE_ARGS up -d --build --remove-orphans
else
  docker-compose $COMPOSE_ARGS up -d --build --remove-orphans
fi
docker image prune -f >/dev/null 2>&1 || true
echo "$(date '+%Y-%m-%d %H:%M:%S') bijgewerkt naar $(git rev-parse --short HEAD)"
