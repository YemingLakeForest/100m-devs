# Looking at the game in the right shape

The game is **landscape-locked** ([GDD §23.4](GDD.html)) — `sensorLandscape` on Android,
portrait never. A desktop browser window is the wrong aspect ratio for every judgement you
might make about framing, so set the viewport before deciding anything looks wrong.

---

## The 20-second version

1. `./start-dev.sh`
2. **F12** to open DevTools
3. **Ctrl+Shift+M** (Cmd+Shift+M on Mac) to toggle the device toolbar
4. Set the dropdown to **Responsive** and type **997 × 448**
5. Set **DPR to 2.25** in the toolbar's overflow (⋮ → *Add device pixel ratio*)

997 × 448 @ 2.25 is the **Pixel 8 Pro in landscape** — the exact viewport recorded in the
§23.3 device run, so it is the one shape the performance numbers actually refer to.

---

## Add it as a saved device, once

Worth doing — the Responsive box forgets, and a saved device is one click.

**DevTools → ⚙ Settings → Devices → Add custom device**

| Field | Value |
|---|---|
| Name | `Pixel 8 Pro — landscape` |
| Width | `997` |
| Height | `448` |
| Device pixel ratio | `2.25` |
| User agent type | Mobile |

Then add these two as well, because §23.4.2 requires the layout to hold across the whole
range and only checking one shape will let a break through:

| Name | Size | Why |
|---|---|---|
| `Narrowest — 16:9` | `800 × 450` | The squarest phone still sold. Least horizontal room |
| `Widest — 20:9` | `1080 × 450` | Modern tall phones. Most margin, worst edge-anchoring bugs |

**Compose for 2.0 : 1. Guarantee legibility from 1.78 : 1 to 2.4 : 1.**

---

## What to actually check

The iso floor is 2:1 and fits to **height**, so on wider devices it leaves margin at the
sides — that margin is where the HUD lives, and it is a feature, not waste (§23.4.2).

- Nothing load-bearing within **5%** of the left or right edge — notches, gesture bars,
  curved-display cutoff all live there.
- HUD elements anchored to **edges**, never to fractions of the width. Resize the responsive
  frame and watch: anything that slides toward the middle is anchored wrong.
- The dominant tier should fill about **88%** of the shorter axis. `window.__stage`'s
  `fillShortAxis` reads it directly, so you do not have to eyeball it.

---

## Two things that will waste your time

**The Pixi ticker stops in a hidden tab.** Chrome suspends `requestAnimationFrame` whenever
`document.hidden` is true — a background window, a minimised one, another tab in front. The
React HUD keeps rendering and `window.__stage` keeps returning its last value, so the app
looks alive while the simulation and every animation are frozen mid-flight. **Check
`document.hidden`, not `document.hasFocus()`** — a tab reports focused and hidden at the
same time, and it is `hidden` that suspends rAF.

**Rotating the device toolbar does not always resize the canvas.** Pixi's `resizeTo`
recalculates on *window* resize events and does not observe the host element. If the canvas
keeps its old dimensions after a rotate, nudge the window or reload. A real device rotation
resizes the window, so this only bites in DevTools.

---

## On a real handset

```bash
./start-dev.sh
```

The banner prints a Network URL. Open that on a phone on the same Wi-Fi — no build, no
install, and the orientation lock is the real one rather than a simulated viewport.

The §23.3 harness is available only from a loopback browser session (`localhost`,
`127.0.0.1` or `::1`). It is deliberately unavailable in every Capacitor Android build,
including snapshot/debug APKs; Capacitor's localhost-looking internal origin does not bypass
the native-platform check.
