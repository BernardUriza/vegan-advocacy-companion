#!/usr/bin/env bash
# Publica iceberg/ en https://aos.bernarduriza.com/iceberg/ (Static Web App de activist-os).
# SSOT = este repo. En activist-os queda una copia DERIVADA (web/public/iceberg/), marcada
# como generada, que el workflow azure-static-web-apps.yml sube al hacer push a main.
# Verifica el CONTENIDO vivo (una firma que solo trae esta build), no el 200 (Rule 22).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
AOS="${AOS_REPO:-$HOME/Documents/activist-os}"
DEST="$AOS/web/public/iceberg"
URL="https://aos.bernarduriza.com/iceberg/"

[ -d "$AOS/.git" ] || { echo "✗ no encuentro activist-os en $AOS (clona: gh repo clone BernardUriza/activist-os)"; exit 1; }
node "$HERE/scripts/iceberg-build.mjs"

SRC_SHA="$(cd "$HERE" && git rev-parse --short HEAD)"
STAMP="$(date -u +%Y-%m-%dT%H:%MZ)"
SIG="iceberg-build ${SRC_SHA} ${STAMP}"
mkdir -p "$DEST"
{ head -1 "$HERE/iceberg/index.html"; echo "<!-- GENERADO desde vegan-advocacy-companion/iceberg (${SIG}) — no editar aquí; publicar con scripts/iceberg-publish.sh -->"; tail -n +2 "$HERE/iceberg/index.html"; } > "$DEST/index.html"
for f in data.js moat.js; do
  { echo "// GENERADO desde vegan-advocacy-companion/iceberg/$f (${SIG}) — no editar aquí."; cat "$HERE/iceberg/$f"; } > "$DEST/$f"
done

cd "$AOS"
git fetch -q origin
[ "$(git branch --show-current)" = "main" ] || { echo "✗ activist-os no está en main ($(git branch --show-current)) — otra sesión lo tiene; aborto"; exit 1; }
git pull -q --rebase origin main
git add web/public/iceberg
if git diff --cached --quiet; then echo "· activist-os ya tiene esta build; nada que publicar"; exit 0; fi
git commit -q -m "iceberg: publicar build ${SRC_SHA} de vegan-advocacy-companion

Copia derivada de vegan-advocacy-companion/iceberg (SSOT allá). ${SIG}.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -q origin main
echo "· pusheado a activist-os main: $(git rev-parse --short HEAD)"

echo "· esperando el workflow SWA…"
sleep 20
RUN_ID="$(gh run list -R BernardUriza/activist-os --workflow azure-static-web-apps.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run watch -R BernardUriza/activist-os "$RUN_ID" --exit-status >/dev/null && echo "· workflow $RUN_ID verde" || { echo "✗ workflow $RUN_ID rojo: gh run view -R BernardUriza/activist-os $RUN_ID --log-failed"; exit 1; }

for i in $(seq 1 30); do
  if curl -s "$URL" | grep -qF "$SIG"; then echo "✓ EN VIVO: $URL sirve la build ${SRC_SHA} (firma encontrada)"; exit 0; fi
  sleep 10
done
echo "✗ $URL responde pero NO trae la firma '${SIG}' tras 5 min — CDN o build distinto; no reportar como publicado"; exit 1
