/**
 * Bundles the demos into one standalone script, so they run without Vite and
 * can be published: three.js, the game's own garage and people (imported from
 * `src/`), and the Departure Mono face inlined as a data URL.
 *
 *   node tools/build.mjs      ->  dist/g2g.js, dist/play.html, dist/index.html, dist/shots/
 *
 * `dist/` is ignored by the repo (.gitignore); the sources are the record.
 */
import { build } from 'esbuild'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = join(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(join(here, 'dist'), { recursive: true })
const result = await build({
  entryPoints: [join(here, 'src', 'main.ts')],
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2022',
  loader: { '.woff2': 'dataurl' },
  outfile: join(here, 'dist', 'g2g.js'),
  metafile: true,
  legalComments: 'none',
})
writeFileSync(join(here, 'dist', 'play.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Garage to Galaxy</title>
  <style>html, body { margin: 0; height: 100%; background: #14121a; overflow: hidden; }</style>
</head>
<body>
  <div id="stage"></div>
  <script src="g2g.js"></script>
</body>
</html>
`)
// The brief, with the face inlined (a published page may not fetch fonts from
// anywhere but Google), and the pictures beside it.
const font = readFileSync(join(here, '..', '..', '..', 'src', 'assets', 'fonts', 'DepartureMono-Regular.woff2')).toString('base64')
const brief = readFileSync(join(here, 'index.html'), 'utf8')
  .replace("url('../../../src/assets/fonts/DepartureMono-Regular.woff2')", `url(data:font/woff2;base64,${font})`)
writeFileSync(join(here, 'dist', 'index.html'), brief)
cpSync(join(here, 'shots'), join(here, 'dist', 'shots'), { recursive: true })
const bytes = Object.values(result.metafile.outputs)[0].bytes
console.log(`dist/g2g.js ${(bytes / 1024).toFixed(0)} KB`)
