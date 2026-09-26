// PROOF 2026-09-26 — tells the bundled three.js garage (garageView.js) to light
// itself for this build's glass: dusk, screen-lit, head-and-body people. Imported
// first in main.tsx so it runs before the bundle evaluates. `?day` keeps the
// rebuild's own daylight garage, for comparison.
if (!new URLSearchParams(location.search).has('day')) globalThis.__studioOs = true
