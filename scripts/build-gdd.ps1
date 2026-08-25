param(
  [string]$InputPath = "GDD.md",
  [string]$OutputPath = "GDD.html"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repoRoot $InputPath
$targetPath = Join-Path $repoRoot $OutputPath

if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
  throw "GDD source not found: $sourcePath"
}

$article = (ConvertFrom-Markdown -Path $sourcePath).Html

# PowerShell's Markdown renderer creates stable, readable heading ids, but the
# three hand-authored links in the source pre-date that renderer. Rewrite those
# legacy fragments so every in-document reference lands in the canonical HTML.
$anchorMap = [ordered]@{
  '#26-the-delivery-roadmap-canon--added-2026-08-15---r51r79' = '#the-delivery-roadmap-canon-added-2026-08-15-r51r79'
  '#31-the-loop-is-the-inventory-canon--added-2026-08-15---r80' = '#the-loop-is-the-inventory-canon-added-2026-08-15-r80'
  '#appendix-f--shipping-readiness-register' = '#appendix-f-shipping-readiness-register-canon'
}

foreach ($entry in $anchorMap.GetEnumerator()) {
  $article = $article.Replace("href=`"$($entry.Key)`"", "href=`"$($entry.Value)`"")
}

# The GDD is part of the product's interface plane, so it takes its colours
# from the same source as the game rather than carrying a lookalike palette.
# Only the ramps with an interface role are exposed here: neutral structure,
# monitor glow, calm/warn/alarm phosphor, and the one rarity violet. Foliage,
# wood and skin keep their scene-only jobs from ART_DIRECTION §2.1.
$palettePath = Join-Path $repoRoot 'src/art/palette.ts'
$paletteSource = Get-Content -LiteralPath $palettePath -Raw

function Get-PaletteRamp([string]$Name, [int]$ExpectedCount) {
  $escaped = [regex]::Escape($Name)
  $match = [regex]::Match($paletteSource, "(?s)\b$escaped\s*:\s*\[(.*?)\]")
  if (-not $match.Success) { throw "Palette ramp not found: $Name" }
  $values = @([regex]::Matches($match.Groups[1].Value, '#[0-9a-fA-F]{6}') | ForEach-Object { $_.Value.ToLowerInvariant() })
  if ($values.Count -ne $ExpectedCount) {
    throw "Palette ramp $Name has $($values.Count) colours; expected $ExpectedCount"
  }
  return $values
}

$neutral = @(Get-PaletteRamp 'NEUTRAL' 9)
$glow = @(Get-PaletteRamp 'GLOW' 3)
$calm = @(Get-PaletteRamp 'CALM' 4)
$warn = @(Get-PaletteRamp 'WARN' 4)
$alarm = @(Get-PaletteRamp 'ALARM' 4)
$rarity = @(Get-PaletteRamp 'RARITY' 1)

$paletteCss = @"
      /* Generated from src/art/palette.ts — never hand-tune these here. */
      --n0: $($neutral[0]);
      --n1: $($neutral[1]);
      --n2: $($neutral[2]);
      --n3: $($neutral[3]);
      --n4: $($neutral[4]);
      --n5: $($neutral[5]);
      --n6: $($neutral[6]);
      --n7: $($neutral[7]);
      --n8: $($neutral[8]);
      --glow-0: $($glow[0]);
      --glow-1: $($glow[1]);
      --glow-2: $($glow[2]);
      --calm-0: $($calm[0]);
      --calm-1: $($calm[1]);
      --calm-2: $($calm[2]);
      --calm-3: $($calm[3]);
      --warn-0: $($warn[0]);
      --warn-1: $($warn[1]);
      --warn-2: $($warn[2]);
      --warn-3: $($warn[3]);
      --alarm-0: $($alarm[0]);
      --alarm-1: $($alarm[1]);
      --alarm-2: $($alarm[2]);
      --alarm-3: $($alarm[3]);
      --rarity-violet: $($rarity[0]);
"@

$head = @'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#14121a">
  <title>100,000,000 Developers — Canonical Game Design Document</title>
  <style>
    @font-face {
      font-family: "Departure Mono";
      src: url("src/assets/fonts/DepartureMono-Regular.woff2") format("woff2");
      font-display: swap;
    }

    :root {
/*__GAME_PALETTE__*/
      --bg: var(--n0);
      --panel: var(--n1);
      --panel-2: var(--n2);
      --panel-3: var(--n3);
      --ink: var(--n8);
      --muted: var(--n6);
      --dim: var(--n4);
      --line: var(--n2);
      --green: var(--calm-2);
      --cyan: var(--glow-2);
      --amber: var(--warn-2);
      --red: var(--alarm-2);
      --violet: var(--rarity-violet);
      --sidebar: 18.5rem;
      --content: 78rem;
      --shadow: 3px 3px 0 var(--n2);
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-width: 320px;
      color: var(--ink);
      background:
        linear-gradient(var(--n1) 1px, transparent 1px),
        linear-gradient(90deg, var(--n1) 1px, transparent 1px),
        var(--bg);
      background-size: 24px 24px, 24px 24px, auto;
      font-family: "Departure Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
      line-height: 1.62;
    }

    ::selection { color: var(--n0); background: var(--calm-3); }
    a { color: var(--cyan); text-underline-offset: .19em; }
    a:hover { color: var(--green); }
    button, input { font: inherit; }
    code, pre { font-family: inherit; }
    img { max-width: 100%; }
    [id] { scroll-margin-top: 1.4rem; }

    .skip-link {
      position: fixed;
      z-index: 100;
      top: .6rem;
      left: .6rem;
      transform: translateY(-160%);
      padding: .6rem .8rem;
      color: var(--n0);
      background: var(--calm-3);
    }
    .skip-link:focus { transform: none; }

    .read-progress {
      position: fixed;
      z-index: 80;
      inset: 0 0 auto;
      height: 3px;
      transform: scaleX(0);
      transform-origin: left;
      background: linear-gradient(90deg, var(--green), var(--cyan));
    }

    .masthead {
      position: relative;
      overflow: hidden;
      border-bottom: 1px solid var(--line);
      background: var(--bg);
    }
    .masthead::after {
      content: "CANON";
      position: absolute;
      right: -1.4rem;
      bottom: -4.8rem;
      color: var(--n1);
      font-size: clamp(8rem, 19vw, 17rem);
      line-height: 1;
      pointer-events: none;
    }
    .masthead__inner {
      position: relative;
      z-index: 1;
      width: min(100% - 3rem, calc(var(--sidebar) + var(--content) + 3rem));
      margin: 0 auto;
      padding: 4.4rem 0 3.2rem;
    }
    .eyebrow, .section-label {
      margin: 0 0 .8rem;
      color: var(--green);
      font-size: .72rem;
      letter-spacing: .14em;
      text-transform: uppercase;
    }
    .masthead h1 {
      max-width: 15ch;
      margin: 0;
      font-size: clamp(2.4rem, 7vw, 6.4rem);
      font-weight: 400;
      letter-spacing: -.055em;
      line-height: .95;
    }
    .masthead h1 span { color: var(--green); }
    .dek {
      max-width: 78ch;
      margin: 1.5rem 0 0;
      color: var(--n6);
      font-size: clamp(.92rem, 1.8vw, 1.12rem);
    }
    .meta-row { display: flex; flex-wrap: wrap; gap: .55rem; margin-top: 1.5rem; }
    .chip {
      padding: .35rem .55rem;
      border: 1px solid var(--line);
      color: var(--muted);
      background: var(--panel);
      font-size: .68rem;
      letter-spacing: .06em;
      text-transform: uppercase;
    }
    .chip--canon { color: var(--calm-3); border-color: var(--calm-1); }

    .layout {
      display: grid;
      grid-template-columns: var(--sidebar) minmax(0, var(--content));
      gap: 3rem;
      width: min(100% - 3rem, calc(var(--sidebar) + var(--content) + 3rem));
      margin: 0 auto;
      align-items: start;
    }

    .toc {
      position: sticky;
      top: 0;
      height: 100vh;
      padding: 2rem 1rem 2rem 0;
      border-right: 1px solid var(--line);
    }
    .toc__title {
      margin: 0 0 .65rem;
      color: var(--green);
      font-size: .7rem;
      letter-spacing: .13em;
      text-transform: uppercase;
    }
    .toc__search {
      width: 100%;
      margin: 0 0 .85rem;
      padding: .56rem .62rem;
      border: 1px solid var(--line);
      border-radius: 0;
      outline: 0;
      color: var(--ink);
      background: var(--panel);
      font-size: .72rem;
    }
    .toc__search:focus { border-color: var(--green); }
    .toc nav {
      max-height: calc(100vh - 9rem);
      overflow: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--line) transparent;
    }
    .toc a {
      display: block;
      padding: .42rem .56rem;
      border-left: 2px solid transparent;
      color: var(--muted);
      text-decoration: none;
      font-size: .69rem;
      line-height: 1.35;
    }
    .toc a:hover, .toc a[aria-current="true"] {
      border-left-color: var(--green);
      color: var(--ink);
      background: var(--calm-0);
    }
    .toc a[hidden] { display: none; }
    .toc__actions { display: flex; gap: .5rem; margin-top: .9rem; }
    .toc button {
      flex: 1;
      padding: .45rem;
      border: 1px solid var(--line);
      color: var(--muted);
      background: var(--panel);
      cursor: pointer;
    }
    .toc button:hover { color: var(--green); border-color: var(--green); }

    main { min-width: 0; padding: 2.4rem 0 6rem; }
    .authority {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 1.2rem;
      align-items: center;
      margin-bottom: 1.2rem;
      padding: 1rem 1.1rem;
      border: 1px solid var(--calm-1);
      border-left: 5px solid var(--green);
      background: var(--calm-0);
      box-shadow: var(--shadow);
    }
    .authority strong { color: var(--calm-3); font-weight: 400; }
    .authority p { margin: 0; color: var(--n7); font-size: .82rem; }
    .authority__links { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .5rem; }
    .authority__links a {
      padding: .4rem .55rem;
      border: 1px solid var(--line);
      text-decoration: none;
      white-space: nowrap;
      font-size: .68rem;
    }

    .status-overview {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: .75rem;
      margin-bottom: 3rem;
    }
    .status-card {
      min-height: 9rem;
      padding: .9rem;
      border: 1px solid var(--line);
      background: var(--panel);
      box-shadow: var(--shadow);
    }
    .status-card small { display: block; color: var(--muted); font-size: .62rem; letter-spacing: .1em; text-transform: uppercase; }
    .status-card b { display: block; margin: .65rem 0 .45rem; color: var(--green); font-weight: 400; font-size: 1rem; line-height: 1.3; }
    .status-card p { margin: 0; color: var(--n6); font-size: .69rem; line-height: 1.48; }
    .status-card--warn b { color: var(--amber); }
    .status-card--phase b { color: var(--cyan); }

    .document { min-width: 0; }
    .document > h1:first-child { display: none; }
    .document h2 {
      margin: 5.6rem 0 1.2rem;
      padding: 1.1rem 0 .85rem;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      color: var(--green);
      font-size: clamp(1.45rem, 3vw, 2.25rem);
      font-weight: 400;
      letter-spacing: -.025em;
      line-height: 1.15;
    }
    .document h2:first-of-type { margin-top: 0; }
    .document h3 {
      margin: 3.2rem 0 1rem;
      color: var(--cyan);
      font-size: clamp(1.1rem, 2vw, 1.45rem);
      font-weight: 400;
      line-height: 1.3;
    }
    .document h4 { margin: 2.35rem 0 .85rem; color: var(--n7); font-size: 1rem; font-weight: 400; }
    .document h5, .document h6 { margin: 2rem 0 .75rem; color: var(--n6); font-size: .88rem; font-weight: 400; }
    .document p, .document li { max-width: 92ch; color: var(--n7); font-size: .86rem; }
    .document li + li { margin-top: .35rem; }
    .document strong { color: var(--n8); font-weight: 400; }
    .document em { color: var(--n6); }
    .document hr { margin: 3rem 0; border: 0; border-top: 1px solid var(--line); }
    .document blockquote {
      max-width: 92ch;
      margin: 1.5rem 0;
      padding: .8rem 1rem;
      border-left: 4px solid var(--cyan);
      background: var(--calm-0);
    }
    .document blockquote > :first-child { margin-top: 0; }
    .document blockquote > :last-child { margin-bottom: 0; }
    .document code {
      padding: .1em .25em;
      border: 1px solid var(--calm-1);
      color: var(--calm-3);
      background: var(--n0);
      font-size: .91em;
      overflow-wrap: anywhere;
    }
    .document pre {
      max-width: 100%;
      overflow: auto;
      padding: 1rem;
      border: 1px solid var(--line);
      background: var(--n0);
      font-size: .75rem;
    }
    .document pre code { padding: 0; border: 0; background: transparent; }
    .table-scroll { max-width: 100%; overflow-x: auto; margin: 1.25rem 0 2rem; border: 1px solid var(--line); }
    .document table { width: 100%; min-width: 44rem; border-collapse: collapse; background: var(--panel); }
    .document th, .document td { padding: .72rem .76rem; border: 1px solid var(--line); text-align: left; vertical-align: top; font-size: .72rem; line-height: 1.5; }
    .document th { color: var(--green); background: var(--panel-3); font-weight: 400; }
    .document tr:nth-child(even) td { background: var(--n0); }

    strong[data-status] {
      display: inline-block;
      padding: .12rem .36rem;
      border: 1px solid currentColor;
      font-size: .63rem;
      line-height: 1.25;
      letter-spacing: .04em;
      white-space: nowrap;
    }
    strong[data-status="LIVE"] { color: var(--calm-3); border-color: var(--calm-2); background: var(--calm-0); }
    strong[data-status="PARTIAL"], strong[data-status="DECISION"] { color: var(--warn-3); border-color: var(--warn-2); background: var(--warn-0); }
    strong[data-status="DEFECT"], strong[data-status="NOT BUILT"] { color: var(--alarm-3); border-color: var(--alarm-2); background: var(--alarm-0); }
    strong[data-status="NOT REACHABLE"] { color: var(--n7); border-color: var(--rarity-violet); background: var(--n1); }

    .footer {
      margin-top: 5rem;
      padding-top: 1.2rem;
      border-top: 1px solid var(--line);
      color: var(--dim);
      font-size: .68rem;
    }

    @media (max-width: 980px) {
      .layout { display: block; width: min(100% - 1.4rem, var(--content)); }
      .masthead__inner { width: min(100% - 1.4rem, var(--content)); padding: 3rem 0 2.2rem; }
      .toc { position: relative; height: auto; padding: 1rem 0; border-right: 0; border-bottom: 1px solid var(--line); }
      .toc nav { display: flex; gap: .3rem; max-height: none; overflow-x: auto; }
      .toc a { flex: 0 0 auto; max-width: 16rem; border-left: 0; border-bottom: 2px solid transparent; }
      .toc a:hover, .toc a[aria-current="true"] { border-left-color: transparent; border-bottom-color: var(--green); }
      .toc__search, .toc__actions { display: none; }
      main { padding-top: 1.3rem; }
      .status-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 620px) {
      .authority { grid-template-columns: 1fr; }
      .authority__links { justify-content: flex-start; }
      .status-overview { grid-template-columns: 1fr; }
      .status-card { min-height: 0; }
      .document h2 { margin-top: 4rem; }
      .document ul, .document ol { padding-left: 1.3rem; }
    }

    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

    @media print {
      :root { --ink: #101414; --muted: #414747; --line: #bbc2bf; --green: #245b28; --cyan: #155b66; }
      body { color: #111; background: #fff; font-family: "Departure Mono", monospace; }
      .read-progress, .toc, .no-print, .status-overview { display: none !important; }
      .masthead { border-color: #aaa; background: #fff; }
      .masthead::after { display: none; }
      .masthead__inner, .layout { width: 100%; }
      .masthead__inner { padding: 1.4rem 0; }
      .layout { display: block; }
      main { padding: 0; }
      .authority { box-shadow: none; background: #fff; }
      .document p, .document li, .document td { color: #222; }
      .document h2 { break-before: page; }
      .document h2:first-of-type { break-before: auto; }
      .document table { min-width: 0; background: #fff; }
      .document tr, .document blockquote, .document pre { break-inside: avoid; }
      .table-scroll { overflow: visible; border: 0; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#canonical-document">Skip to GDD</a>
  <div class="read-progress" id="read-progress" aria-hidden="true"></div>

  <header class="masthead" id="top">
    <div class="masthead__inner">
      <p class="eyebrow">100,000,000 Developers // canonical development guide</p>
      <h1>Game design<br><span>document</span></h1>
      <p class="dek">The internal source of truth for mechanics, progression, upgrades, prestige, heroes, placement, presentation, technical constraints, delivery order, and the current implementation register. This is a development document, not marketing material.</p>
      <div class="meta-row" aria-label="Document status">
        <span class="chip chip--canon">Canonical</span>
        <span class="chip">Consolidated v3.0+</span>
        <span class="chip">Implementation audit 25 Aug 2026</span>
        <span class="chip">Appendix G owns live status</span>
      </div>
    </div>
  </header>

  <div class="layout">
    <aside class="toc no-print" aria-label="Document contents">
      <p class="toc__title">Document contents</p>
      <input class="toc__search" id="toc-search" type="search" placeholder="Filter sections…" aria-label="Filter document sections">
      <nav id="toc-nav"></nav>
      <div class="toc__actions">
        <button type="button" onclick="window.print()">PRINT</button>
        <button type="button" onclick="location.hash='top'">TOP</button>
      </div>
    </aside>

    <main id="canonical-document">
      <section class="authority" aria-label="Canonical status">
        <p><strong>DEVELOPMENT AUTHORITY.</strong> Design intent lives in this GDD. Appendix G is the only current-build status register; Appendix F tracks missing product specification. The old mechanics HTML remains a dated backup only.</p>
        <div class="authority__links">
          <a href="#appendix-g-current-implementation-development-register-canon">CURRENT STATUS</a>
          <a href="#g.2-gaps-divergences">GAPS / DIVERGENCES</a>
          <a href="#g.4-further-improvement-experiments">IMPROVEMENTS</a>
          <a href="#the-delivery-roadmap-canon-added-2026-08-15-r51r79">BUILD ORDER</a>
          <a href="docs/game-mechanics-current.html">BACKUP AUDIT</a>
        </div>
      </section>

      <section class="status-overview" aria-label="Current development snapshot">
        <article class="status-card">
          <small>Playable core</small>
          <b>Run 1 → Layer 1 is live</b>
          <p>Entropy, economy, roles, upgrades, founder skills, six story heroes, posting, save/offline and audio are reachable.</p>
        </article>
        <article class="status-card status-card--warn">
          <small>Integrity first</small>
          <b>Five P0 corrections</b>
          <p>Prestige persistence/semantics, first hero purchase, rating coverage and Telepathic Compression need reconciliation.</p>
        </article>
        <article class="status-card status-card--phase">
          <small>Scale status</small>
          <b>100m globe live; Phase 2 open</b>
          <p>Aggregate simulation and seven lens levels work. Full ladder fidelity, history and low-end device proof remain.</p>
        </article>
        <article class="status-card">
          <small>Next principle</small>
          <b>Deepen choice before scope</b>
          <p>Make purchases and postings predictable, then add Layer 2, events and platform work in measured slices.</p>
        </article>
      </section>

      <article class="document" id="document-body">
'@

$head = $head.Replace('/*__GAME_PALETTE__*/', $paletteCss.TrimEnd())

$tail = @'
      </article>

      <footer class="footer">
        Canonical GDD · generated from GDD.md with scripts/build-gdd.ps1 · revision 2026-08-25
      </footer>
    </main>
  </div>

  <script>
    (() => {
      const article = document.getElementById('document-body');
      const nav = document.getElementById('toc-nav');
      const progress = document.getElementById('read-progress');
      const search = document.getElementById('toc-search');
      const headings = [...article.querySelectorAll(':scope > h2')];

      for (const table of article.querySelectorAll('table')) {
        const wrap = document.createElement('div');
        wrap.className = 'table-scroll';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      }

      const statuses = new Set(['LIVE', 'PARTIAL', 'DEFECT', 'NOT REACHABLE', 'NOT BUILT', 'DECISION']);
      for (const strong of article.querySelectorAll('strong')) {
        const value = strong.textContent.trim().toUpperCase();
        if (statuses.has(value)) strong.dataset.status = value;
      }

      const links = headings.map((heading, index) => {
        const link = document.createElement('a');
        link.href = `#${heading.id}`;
        link.textContent = `${String(index).padStart(2, '0')} / ${heading.textContent.replace(/\s*\[[^\]]+\]\s*/g, ' ').trim()}`;
        nav.appendChild(link);
        return link;
      });

      const setActive = () => {
        const marker = window.scrollY + Math.min(240, window.innerHeight * .28);
        let active = 0;
        headings.forEach((heading, index) => {
          if (heading.offsetTop <= marker) active = index;
        });
        links.forEach((link, index) => link.setAttribute('aria-current', index === active ? 'true' : 'false'));
      };

      const updateProgress = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
        setActive();
      };

      search.addEventListener('input', () => {
        const term = search.value.trim().toLowerCase();
        links.forEach((link) => { link.hidden = term !== '' && !link.textContent.toLowerCase().includes(term); });
      });

      window.addEventListener('scroll', updateProgress, { passive: true });
      window.addEventListener('resize', updateProgress);
      updateProgress();
    })();
  </script>
</body>
</html>
'@

$output = $head + $article + $tail
$utf8 = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($targetPath, $output, $utf8)

Write-Host "Canonical GDD written to $targetPath"
