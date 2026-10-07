# Lane Phase (Training Suite v1.1)

Based on refactor commit `7a12ff3c9a42966b1fb6d46cbfa38f7714837a64`. Adds a seventh mode while keeping the existing CS drill.

## Behavior

- `7` starts a 45-second session: existing 6-v-6 minion combat plus an opposing champion.
- An orange ground telegraph locks the shot direction when it appears. The shot follows after windup; sideways movement can evade it. Swept collision prevents a slow frame from skipping a player hit.
- The champion approaches to harass range, retreats if too close, and stays within lane bounds. Player AA can damage it; killing it gives a three-second respite before respawn.
- Red overhead bars for opponents, blue for allies. HP loss changes width, not color.
- New waves preserve the champion. Only player last hits award CS; allied kills count as misses.
- Results: CS, misses, CS rate, harass hits, dodges and remaining HP. Grade weights CS precision 65%, remaining HP 20%, resolved-shot dodge rate 15%, scaled down when fewer than six minions have resolved. No resolved minions means zero performance.
- Zero player HP ends the session early. Restart, Escape, completion and mode switches clear telegraphs, shots and the opponent HP bar.

| Difficulty | Windup | Interval | Shot speed | Damage | Champion speed |
| --- | --- | --- | --- | --- | --- |
| EASY | .75s | 3s | 7.2 | 8 | 1.3 |
| NORMAL | .55s | 2.4s | 8.5 | 10 | 1.6 |
| HARD | .4s | 1.9s | 10.2 | 12 | 1.9 |

`src/lane.js` handles the new opponent AI, warning, shots and cleanup. Existing six-mode tuning, player movement/AA, camera and CSS are unchanged. Menu/help text includes mode 7; the title is v1.1.

## Verification (2026-10-07)

- Existing RMB movement/AA, Stop, both Attack Move inputs, Space/Y and difficulty match the original baseline. Also compared 72 runtime/result/HP-bar checkpoints across the six existing modes.
- New-mode assertions cover start, minion combat, locked aim/dodge, damage, difficulty, restart, cleanup, waves, opponent death/respawn, CS/misses, swept collision, player death, results/history, Escape and zero-participation score.
- Integration tests use actual Three.js math and scene objects with a stubbed renderer/DOM. They do not verify WebGL pixels.
- Real in-app browser at `/lol-micro-lab/index.html`: scene and bars render, `7` starts Lane Phase, RMB changes movement, harass reduces HP/increments hits, `R` resets session/HP/counters, and death displays the Lane result. Browser error/warning log was empty when checked.
- Production deployment is pending. This feature PR is stacked on the unmerged refactor branch.

## Repeat integration tests

Download pinned Three.js 0.180.0 `three.module.js` and sibling `three.core.js`. Use Node.js with VM modules:

```sh
node --experimental-vm-modules tests/lane.test.cjs /path/to/three.module.js /path/to/baseline-main.js
```

The optional baseline is unchanged main.js from `f475a6618df3beb2b96bf3bceeaa5900ee4799d9`. Without it, only new-mode assertions run. Results are saved to `LANE-TEST-RESULTS.json`. The browser regression script aligns only the intentional 1–7 menu text when comparing existing modes.
