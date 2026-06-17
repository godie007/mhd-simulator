# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Browser-based simulator (vanilla ES modules + Three.js, no build step) of electron
confinement inside a sphere of magnetic coils, with a genetic algorithm that evolves
the coil/laser parameters to keep the plasma cloud confined and stable. Spanish UI and
comments. See `README.md` (physics intuition + controls) and `docs/` (technical doc and
"thesis") for domain detail.

## Run

ES modules + a Web Worker require HTTP (won't work over `file://`):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Three.js loads from a CDN via the import map in `index.html`, so the first load needs
internet. There is **no build, lint, test, or package manager** — edit and refresh.

## Architecture

Three JS modules with a deliberate split:

- **`js/physics.js` — pure, shared core.** Coil/cannon placement, magnetic dipole field,
  Boris pusher, the `Simulation` class, and `evaluateGenome()`. Imported by **both** the
  main thread (live render) and the worker (GA evaluation). This sharing is the whole
  point: the physics the GA optimizes is byte-for-byte the physics you see on screen.
  Keep this module free of DOM/Three.js/worker references.
- **`js/ga.js` — genetic algorithm.** `GA` class: tournament selection, BLX-α crossover,
  Gaussian mutation, 10% elitism. Calls `evaluateGenome()` from physics.js.
- **`js/sim-worker.js` — Web Worker.** Runs the GA generation loop off the main thread so
  the UI never freezes. Message protocol: main → worker `{type: 'init'|'start'|'pause'|'reset', config}`;
  worker → main `{type: 'ready', geneLength}` and `{type: 'gen', stats}` (stats include
  `bestGenome`, which the main thread applies live).
- **`js/main.js` — Three.js scene, DOM, live sim.** Reads the config from sliders
  (`readConfig()`), builds the scene, runs a *separate* live `Simulation` instance, and on
  each worker `gen` message swaps in the latest `bestGenome` via `setGenome()`.

### Genome layout (critical)

A genome is a `Float64Array` of length `geneCount(numCoils, numLasers)` =
`ceil(numCoils/2) + 3 + numLasers`:

```
[ f_common, A_0 .. A_{ng-1}, kp, kd, L_0 .. L_{nl-1} ]
```

- `ng = ceil(numCoils/2)` = number of **opposing-pair groups**. Coils are paired by
  antipode (`computeGroups`); both coils in a pair share genes and fire identically.
- One common frequency for the whole system; **phase is NOT evolved** — it's a fixed 60°
  (`PHASE_STEP`) polyphase offset per pair, producing a rotating field.
- `kp`/`kd` are the PD self-regulation gains (push inward as the cloud's mean radius grows).
- Each laser gene `L_k ∈ [0,1]` is on/off (`>0.5` = on); the GA decides which lasers fire.
- Bounds live in `BOUNDS` / `makeBounds()`. Any change to gene meaning or count must stay
  consistent across `geneCount`, `makeBounds`, `fillCurrents`, and `Simulation`'s
  `laserBase`/`updateLaserState`.

### Determinism invariant

The GA depends on reproducibility. `makeRng` (mulberry32) is seeded so every genome in a
generation is evaluated against the **same** episode seed (fair comparison), while the seed
varies *between* generations (`seed + generation*7919`) to avoid overfitting one shot. Don't
introduce `Math.random()` into physics/GA evaluation paths — it's only used in main.js for
non-evaluated seeds.

### Other physics notes

- Particle storage is dynamic (`reset` starts empty, `grow()` doubles capacity, swap-remove
  on escape). Accumulation is "unlimited"; `maxParticles` is a browser-memory safety cap, not
  a physical limit.
- `getGeometry()` memoizes per-config geometry (coils, pairs, convex-hull triangulation →
  laser "gaps" and edges). The convex hull is O(n⁴) enumeration but runs once per config.
- Lasers sit at face centroids of the coil triangulation and only add speed (the B field
  rotates but never accelerates), so they're the plasma's only energy source.
