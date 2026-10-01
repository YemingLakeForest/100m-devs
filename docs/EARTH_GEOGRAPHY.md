# Earth geography — 2026-10-01

The globe uses Natural Earth's public-domain 1:110m land polygons:

- [Source GeoJSON](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson)
- [Public-domain terms](https://www.naturalearthdata.com/about/terms-of-use/)

`src/sim/earthLand.json` is a 1440 × 720 equirectangular binary land mask.
Each row stores alternating start and length values in base 36, separated by dots.
The mask is shared by coastline rendering and settlement placement, keeping lights
on the same land that the player sees. No external requests occur during play.

Regenerate from a local copy of the source:

```powershell
node scripts/build-earth-land.mjs tmp/earth-land.geojson
```

Thirty named hubs provide an authored expansion sequence. Their district capacities
and growth order describe the game, not actual city populations. Land stays neutral;
earned headcount controls city lights, connections and the outer progress instrument.
