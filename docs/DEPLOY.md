# Deploying

Two targets, two mechanisms, and they share nothing:

| Target | How | When |
|---|---|---|
| A phone in the room | `./deploy.sh` | Whenever you want to look at it on glass |
| https://100mdevs.mercilessstudio.com | GitHub Actions → Cloudflare Pages | Every push to `main` |

---

## 1. The phone — `./deploy.sh`

```bash
./deploy.sh              # build the snapshot APK, install it
./deploy.sh --launch     # ...and start it
./deploy.sh --skip       # install the last APK without rebuilding
./deploy.sh --ip 192.168.1.42
```

It finds ADB, gets itself onto the phone over Wi-Fi (cached address → USB
`tcpip 5555` handshake → a short list of usual suspects), builds
`.apk/m100devs-snapshot-<timestamp>.apk` via `build-snapshot.sh`, and streams
it across. Both are git-ignored, as is `.adb-wifi-ip`, which is one machine's
notion of one LAN.

The first run wants a USB cable: plug the phone in with USB debugging on,
accept the *Allow USB debugging* dialog, and the script switches it to Wi-Fi
ADB and tells you to unplug. Subsequent runs are cable-free.

`VITE_BENCH=1 ./deploy.sh` includes the GDD §23.3 acceptance-run button, which
is the only way to reach it on a device — a Capacitor shell has no query string,
so `?bench` cannot get there. A shipping build never carries it.

Logs: `adb logcat -s Capacitor:V Capacitor/Console:V`.

**The APK is a debug build.** It is signed with the debug key and it is not
what goes to Play; that is `push-play.sh`'s job when there is one.

---

## 2. The web — Cloudflare Pages

`.github/workflows/deploy-web.yml` builds and deploys on every push to `main`.
Standard studio pattern (playbook §G); the live siblings are geodaily/terradex,
mind-the-gap and dungeon-doom-dash.

### One-time setup

Account `c77ec6812dd721ca0c42f8658779de6f`, zone `mercilessstudio.com`
(`140c7f38036dfe6788b7ba3d41501471`).

1. **Create the Pages project**, named for the subdomain you want:

   ```bash
   curl -sX POST "https://api.cloudflare.com/client/v4/accounts/$ACCT/pages/projects" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json' \
     -d '{"name":"100mdevs","production_branch":"main"}'
   ```

   **Read `result.subdomain` back out of the response and use that**, rather
   than assuming `100mdevs.pages.dev`. The `*.pages.dev` namespace is global; if
   a stranger holds the name, Cloudflare quietly issues a suffixed one instead
   (mind-the-gap ended up on `mindthegap-5tc.pages.dev`), and a CNAME pointing
   at the name you assumed serves error 1014.

2. **Attach the custom domain**, then **CNAME the zone at the real subdomain**:

   ```bash
   curl -sX POST ".../pages/projects/100mdevs/domains" \
     -d '{"name":"100mdevs.mercilessstudio.com"}'
   curl -sX POST "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records" \
     -d '{"type":"CNAME","name":"100mdevs","content":"<result.subdomain>","proxied":true}'
   ```

3. **Repo secrets** (`gh secret set -R YemingLakeForest/100m-devs`):
   `CLOUDFLARE_API_TOKEN` (needs *Cloudflare Pages: Edit*) and
   `CLOUDFLARE_ACCOUNT_ID`.

   No `GH_PACKAGES_TOKEN` here, unlike the other games: nothing in this repo
   depends on the private `@mercilessstudio` packages yet. The day `game-cloud`
   or `game-monetise` lands in `package.json`, add that secret **and** the
   `url.insteadOf` git rewrite from geodaily's workflow — the lockfile pins
   those as `git+ssh` and the runner has no SSH key. It must be a fine-grained
   PAT; runners reject `gho_` OAuth tokens.

4. Keep `--branch=main` on `wrangler pages deploy`. The checkout is a detached
   HEAD, so without it every deploy files as a *preview* and production never
   moves.

---

## 3. Landscape on a page that isn't a phone

The game is landscape-locked (GDD §23.4) and composed against the §23.4.2
design box — 1.78:1 to 2.4:1. Android enforces that with `sensorLandscape`. A
browser window enforces nothing: it is whatever shape it was dragged to.

So on the web the game is **letterboxed into a legal aspect** and the leftover
window is left dark around it — `#root` in `src/styles/app.css`:

```
width  = min(100vw, 100vh * 2.4)     never wider than 2.4:1
height = min(100vh, 100vw / 1.78)    never taller than 1.78:1
```

the largest legal box that fits. Inside the design box it is the identity —
which is why **this is invisible on a handset**, where the box is the screen,
and why nothing in the game had to learn about it. A 1px phosphor `outline`
draws the edge; it is an outline and not a border so it costs no pixel row on
the device, where it falls off-screen.

Two consequences worth knowing:

- **`--edge-x` is `5cqw`, not `5vw`** (`tokens.css`). The §23.4.2 side
  clearance has to be five percent of the *picture*; on an ultrawide monitor
  five percent of the *window* would push the HUD rails inward on exactly the
  screens with the most room. `#root` is the size container. On a phone the two
  units are the same number.
- **Portrait gets a rotate prompt, not a squeezed game.** A 9:16 window clamped
  to 1.78:1 leaves a strip a third of the screen tall with the two 176px rails
  meeting in the middle of it. `.rotate-me` in `index.html` says so instead;
  static markup and a media query, so it is right on the first paint rather
  than after the bundle mounts.

Check all of it the way §23.4.2 asks — see [LANDSCAPE.md](../LANDSCAPE.md) for
the viewports, and:

```bash
npm run build && npx vite preview --port 5199
node scripts/screenshot.mjs "http://localhost:5199/?notitle" wide.png 2400 900
node scripts/screenshot.mjs "http://localhost:5199/?notitle" tall.png 1000 900
```

---

## 4. The icon is temporary

`npm run art:icon` (`scripts/build-icon.ts`) generates every launcher and web
icon from one 32x32 grid: a CRT with a rising bar chart, master-palette colours,
nearest-neighbour scaling only. It writes the five Android densities (legacy,
round, adaptive foreground, plus the background colour resource) and
`public/icon-{32,180,192,512}.png`.

It is a placeholder for real key art (GDD §22) and it is a script rather than
fifteen committed PNGs so that replacing it is one edit — and so nobody has to
work out later which files were regenerated and which were stale.
