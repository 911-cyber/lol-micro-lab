# ES module refactor

Baseline: `f475a6618df3beb2b96bf3bceeaa5900ee4799d9` (Training Suite v1.0).

## Structure

| File | Responsibility |
| --- | --- |
| `main.js` | Initialize game, bind input, start animation |
| `src/setup.js` | Original DOM, rendering, constants and state initialization order |
| `src/state.js` | Shared runtime state; modules read current values instead of copying mutable primitives |
| `src/scene.js` | Champion and scenery mesh construction |
| `src/camera.js` | Camera transforms, projection, ground picking and edge scrolling |
| `src/player.js` | Movement and stop orders, facing, movement integration |
| `src/combat.js` | Attack orders, attack move, windup, cooldown, projectiles and player damage |
| `src/entities.js` | Enemy/allied unit creation, picking, cleanup and respawn |
| `src/minions.js` | CS waves, lane combat, caster projectiles and overhead HP bars |
| `src/drills.js` | Mode/difficulty selection, drill updates, reset and session timer |
| `src/ui.js` | HUD, markers, toast, results, grading and local result history |
| `src/input.js` | Original mouse, wheel, keyboard and focus event handlers |
| `src/loop.js` | Original per-frame update order, rendering and resize handling |

All imports use relative `.js` paths, apart from the existing `three` import map entry. No build step or production dependency changes. Circular function imports are intentional: modules only export functions at evaluation time, and state is initialized before any game function is called. `index.html`, `styles.css`, Three.js version, numeric values, UI strings, drawing settings and input mappings are unchanged.

## Verification (2026-10-07)

- All 70 original functions were compared structurally after removing only the `state.` qualification: no logic changes.
- 40 deterministic browser checkpoints passed with identical runtime state and HUD content between baseline and refactor. Fixed random seed and 50 ms simulated frames were used.
- Covered RMB movement/AA, A + LMB and Shift + RMB attack move, S stop, Space/Y camera, edge scroll, middle drag, wheel zoom, all three difficulty settings, all six modes, mode restart, full session completion/results/history and Escape.
- CS checks include both teams taking minion damage, player last-hit CS credit, HP bar position/visibility/width/offset/team color, and wave/session resets. Last-hit credit uses an isolated low-HP target fixture to avoid competing minion kills.
- 14 rendered screenshots compared (initial scene, six mode starts, six results and CS last hit). Allowed maximum per-channel difference: 1/255, for browser compositing rounding. CSS transitions are disabled only during screenshot capture; production CSS is unchanged.
- No JavaScript errors or failed HTTP requests. Browser runs served under `/before/lol-micro-lab/` and `/after/lol-micro-lab/` to check project-subpath module loading as used by GitHub Pages. The unchanged Three.js CDN modules were downloaded for the test.
- Intermediate simulation frames update scene/camera matrices without rendering; actual WebGL rendering is exercised at screenshot checkpoints. This is regression coverage, not an exhaustive manual/performance test on every device.
- Production GitHub Pages remains on `main` until this refactor is merged. A deployment of the changed branch has not been performed.

## Repeat the browser comparison

Use a full checkout containing the baseline commit and Node.js 18 or newer. Install test-only dependencies outside production if preferred:

```sh
npm install --no-save playwright pngjs
npx playwright install chromium
node tests/regression.cjs
```

For an existing Chrome installation, set `CHROME_PATH` to its executable. Test-only dependencies do not change the static site. The script downloads the pinned Three.js modules, serves both versions locally, and writes screenshots and a JSON report into a printed temporary directory. No baseline code or test hooks are included in production modules.
