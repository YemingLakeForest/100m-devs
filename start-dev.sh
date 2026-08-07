#!/usr/bin/env bash
#
# Start the dev server on a stable port, and print the flags worth knowing.
#
# Exists because plain `npm run dev` drifts: Vite walks 5173 -> 5174 -> 5175
# when an old instance is still holding the port, so the URL changes every time
# and any bookmark, script or note pointing at it goes stale. This kills what
# is there and pins the port.
#
#   ./start-dev.sh                    the game
#   ./start-dev.sh act3_bait          jump the §21 script to a phase
#   ./start-dev.sh dialogue           the §10.7 dialogue preview
#   ./start-dev.sh bench              the §23.3 acceptance run
#
set -euo pipefail

PORT=5173
cd "$(dirname "$0")"

# Vite from a previous run is the usual reason the port drifts. Killing by name
# is blunt but this is a single-app repo and there is nothing else to hit.
if pgrep -f "vite" >/dev/null 2>&1; then
  echo "  stopping a previous dev server..."
  pkill -f "vite" >/dev/null 2>&1 || true
  sleep 1
fi

QUERY=""
case "${1:-}" in
  "")         ;;
  dialogue)   QUERY="?dialogue" ;;
  bench)      QUERY="?bench" ;;
  bench=*)    QUERY="?${1}" ;;
  nopost)     QUERY="?nopost" ;;
  act*)       QUERY="?act=$1" ;;
  *)          QUERY="?$1" ;;
esac

URL="http://localhost:${PORT}/${QUERY}"

cat <<BANNER

  100000000 Developers — dev server

  ${URL}

  ── flags ────────────────────────────────────────────────────────────────
   ?act=act1_poke | act2_offer_hire | act2_ship | act3_bait
        act4_collapse | act5_bleeding | bankrupt      jump the §21 script
   ?dialogue                     §10.7 dialogue preview
   ?bench   ?bench=10            §23.3 acceptance run (10 shortens the 60s leg)
   ?nopost  ?post=bloom,crt      drop or select post-process passes
   window.__stage                camera Z, LOD weights, tier size on screen

  ── landscape ────────────────────────────────────────────────────────────
   The game is landscape-locked (§23.4). A desktop window is the wrong shape.
   F12 → Ctrl+Shift+M → device toolbar → "Responsive" → set 997 x 448.
   See LANDSCAPE.md for the exact device presets.

  ── one gotcha that will cost you an hour ─────────────────────────────────
   Chrome suspends requestAnimationFrame when the tab is hidden, so the Pixi
   ticker STOPS in a background window while React keeps drawing. Animations
   freeze mid-flight and the app looks alive. Keep the window in front.

BANNER

exec npx vite --port "$PORT" --strictPort
