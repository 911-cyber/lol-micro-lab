import * as THREE from 'three';
import { state } from './state.js';
import { edgeDistance } from './combat.js';
import { resetEntities, createEnemy, livingEnemies } from './entities.js';
import { spawnWave } from './minions.js';
import { toast, hideResult, showResult } from './ui.js';
export function resetStats() {
  state.hits = 0;
  state.cancels = 0;
  state.cleanKites = 0;
  state.dodges = 0;
  state.cs = 0;
  state.missedCs = 0;
  state.score = 0;
  state.playerHp = 100;
  state.targetSwitches = 0;
  state.skillshotsFired = 0;
  state.skillshotsHit = 0;
  state.sessionDuration = 0;
  state.lastSelectedTarget = null;
  state.modeData.time = 0;
  state.modeData.nextSpawn = 0;
  state.modeData.nextEnemyAttack = 0;
  state.modeData.spacingGoodTime = 0;
  state.modeData.spacingDangerTime = 0;
  state.modeData.wave = 0;
}
export function cycleDifficulty() {
  state.difficultyIndex = (state.difficultyIndex + 1) % state.DIFFICULTIES.length;
  state.difficultyStateEl.textContent = state.difficulty().name;
  toast(`DIFFICULTY — ${state.difficulty().name}`, 'info');
}
export function setMode(next, opts = {}) {
  const keepStats = !!opts.keepStats,
    keepResult = !!opts.keepResult;
  state.mode = next;
  resetEntities();
  if (!keepStats) resetStats();
  if (!keepResult) hideResult();
  state.order = {
    type: 'idle',
    point: state.player.position.clone(),
    target: null
  };
  state.attackState = 'idle';
  state.attackTarget = null;
  state.projectiles.splice(0).forEach(p => state.scene.remove(p.mesh));
  state.skillshots.splice(0).forEach(s => state.scene.remove(s.mesh));
  state.player.position.set(-4, 0, 2);
  if (state.mode === state.MODE.FREE) {
    state.modeBanner.textContent = opts.complete ? `${opts.complete} COMPLETE` : 'FREE MODE';
    state.objectiveBanner.textContent = opts.complete ? 'リザルトを確認。1〜6で次の練習を開始' : '1 KITE • 2 TARGET • 3 SPACE • 4 DODGE • 5 CS • 6 COMBO';
    return;
  }
  if (state.mode === state.MODE.KITE) {
    state.modeBanner.textContent = 'KITING — 30s';
    state.objectiveBanner.textContent = 'AAを出した直後に移動。追いつかれないように削る';
    state.mainDummy.group.position.set(8, 0, -1);
    state.modeData.time = 30;
    state.sessionDuration = 30;
    state.rangeRing.visible = true;
  }
  if (state.mode === state.MODE.TARGET) {
    state.modeBanner.textContent = 'TARGET SWITCH — 30s';
    state.objectiveBanner.textContent = 'A→クリックでカーソルに近い敵を素早く切り替える';
    state.mainDummy.group.position.set(6, 0, -3);
    createEnemy('ORANGE DUMMY', 10, 2, state.enemyColors[1], 420, .76);
    createEnemy('PURPLE DUMMY', 5, 5, state.enemyColors[2], 420, .76);
    state.mainDummy.hp = state.mainDummy.maxHp = 420;
    state.modeData.time = 30;
    state.sessionDuration = 30;
    state.rangeRing.visible = true;
  }
  if (state.mode === state.MODE.SPACING) {
    state.modeBanner.textContent = 'SPACING — 30s';
    state.objectiveBanner.textContent = '黄色い自分の射程内、赤い敵の危険範囲外を維持';
    state.mainDummy.group.position.set(5.7, 0, -1);
    state.modeData.time = 30;
    state.sessionDuration = 30;
    state.rangeRing.visible = true;
    state.dangerRing.visible = true;
  }
  if (state.mode === state.MODE.DODGE) {
    state.modeBanner.textContent = 'DODGE — 30s';
    state.objectiveBanner.textContent = '青いスキルショットを避ける。被弾でHPとスコア減';
    state.mainDummy.group.visible = false;
    state.mainDummy.alive = false;
    state.modeData.time = 30;
    state.sessionDuration = 30;
    state.modeData.nextSpawn = .45;
  }
  if (state.mode === state.MODE.CS) {
    state.modeBanner.textContent = 'CS / LAST HIT — 45s';
    state.objectiveBanner.textContent = '味方/敵ミニオンが実際に殴り合う。赤HPバーを見てラストヒット';
    state.mainDummy.group.visible = false;
    state.mainDummy.alive = false;
    state.modeData.time = 45;
    state.sessionDuration = 45;
    spawnWave();
  }
  if (state.mode === state.MODE.COMBINED) {
    state.modeBanner.textContent = 'KITE + DODGE — 40s';
    state.objectiveBanner.textContent = 'AA→移動を維持しながら青いスキルショットも避ける';
    state.mainDummy.group.position.set(8, 0, -1);
    state.modeData.time = 40;
    state.sessionDuration = 40;
    state.modeData.nextSpawn = .65;
    state.rangeRing.visible = true;
  }
  toast(`${state.mode} START — ${state.difficulty().name}`, 'info');
}
export function updateKiteMode(dt, now) {
  if (state.mode !== state.MODE.KITE && state.mode !== state.MODE.COMBINED || !state.mainDummy.alive) return;
  const delta = new THREE.Vector3().subVectors(state.player.position, state.mainDummy.group.position);
  delta.y = 0;
  const dist = delta.length();
  if (dist > 1.55) {
    delta.normalize();
    state.mainDummy.group.position.addScaledVector(delta, state.difficulty().kiteSpeed * dt);
  }
  if (dist < 1.95 && now >= state.modeData.nextEnemyAttack) {
    state.modeData.nextEnemyAttack = now + 1.0;
    state.playerHp = Math.max(0, state.playerHp - state.difficulty().kiteDamage);
    state.score = Math.max(0, state.score - 40);
    toast('Too close — hit by dummy', 'bad');
  }
}
export function updateTargetMode(dt) {
  if (state.mode !== state.MODE.TARGET) return;
  for (const e of livingEnemies()) {
    e.aiClock += dt;
    const center = e === state.mainDummy ? new THREE.Vector3(6, 0, -3) : e.name.startsWith('ORANGE') ? new THREE.Vector3(10, 0, 2) : new THREE.Vector3(5, 0, 5);
    e.group.position.x = center.x + Math.sin(e.aiClock * .9 * state.difficulty().targetMotion) * 1.2;
    e.group.position.z = center.z + Math.cos(e.aiClock * .7 * state.difficulty().targetMotion) * 1.0;
  }
}
export function updateSpacingMode(dt, now) {
  if (state.mode !== state.MODE.SPACING || !state.mainDummy.alive) return;
  state.dangerRing.position.set(state.mainDummy.group.position.x, .052, state.mainDummy.group.position.z);
  const dist = edgeDistance(state.mainDummy);
  const dir = new THREE.Vector3().subVectors(state.player.position, state.mainDummy.group.position);
  dir.y = 0;
  if (dir.lengthSq()) dir.normalize();
  if (dist > 3.85) state.mainDummy.group.position.addScaledVector(dir, state.difficulty().spacingSpeed * dt);
  if (dist < 3.9) {
    state.modeData.spacingDangerTime += dt;
    state.score = Math.max(0, state.score - 8 * dt);
    if (now >= state.modeData.nextEnemyAttack) {
      state.modeData.nextEnemyAttack = now + .8;
      state.playerHp = Math.max(0, state.playerHp - state.difficulty().spacingDamage);
    }
  }
  if (dist >= 4.1 && dist <= state.ATTACK_RANGE) {
    state.modeData.spacingGoodTime += dt;
    state.score += 12 * dt;
  }
}
export function spawnSkillshot() {
  const side = Math.floor(Math.random() * 4);
  const bounds = {
    x: 18,
    z: 12
  };
  let start = new THREE.Vector3();
  if (side === 0) start.set(-bounds.x, 0.35, THREE.MathUtils.randFloat(-bounds.z, bounds.z));
  if (side === 1) start.set(bounds.x, 0.35, THREE.MathUtils.randFloat(-bounds.z, bounds.z));
  if (side === 2) start.set(THREE.MathUtils.randFloat(-bounds.x, bounds.x), 0.35, -bounds.z);
  if (side === 3) start.set(THREE.MathUtils.randFloat(-bounds.x, bounds.x), 0.35, bounds.z);
  const aim = state.player.position.clone();
  aim.x += THREE.MathUtils.randFloat(-.8, .8);
  aim.z += THREE.MathUtils.randFloat(-.8, .8);
  const vel = aim.sub(start).setY(0).normalize().multiplyScalar(state.difficulty().dodgeSpeed);
  const mesh = new THREE.Mesh(state.skillGeom, state.skillMat.clone());
  mesh.position.copy(start);
  state.scene.add(mesh);
  state.skillshots.push({
    mesh,
    vel,
    life: 5,
    scored: false
  });
  state.skillshotsFired++;
}
export function updateDodgeMode(dt) {
  if (state.mode !== state.MODE.DODGE && state.mode !== state.MODE.COMBINED) return;
  state.modeData.nextSpawn -= dt;
  if (state.modeData.nextSpawn <= 0) {
    spawnSkillshot();
    state.modeData.nextSpawn = Math.max(.34, state.difficulty().dodgeSpawn - state.modeData.time * .002);
  }
  for (let i = state.skillshots.length - 1; i >= 0; i--) {
    const s = state.skillshots[i];
    s.life -= dt;
    s.mesh.position.addScaledVector(s.vel, dt);
    const d = s.mesh.position.distanceTo(state.player.position.clone().setY(.35));
    if (d < .72) {
      state.skillshotsHit++;
      state.playerHp = Math.max(0, state.playerHp - 14);
      state.score = Math.max(0, state.score - 70);
      toast('Skillshot hit', 'bad');
      state.scene.remove(s.mesh);
      state.skillshots.splice(i, 1);
      continue;
    }
    if (s.life <= 0 || Math.abs(s.mesh.position.x) > 24 || Math.abs(s.mesh.position.z) > 18) {
      state.dodges++;
      state.score += 35;
      state.scene.remove(s.mesh);
      state.skillshots.splice(i, 1);
    }
  }
}
export function updateModeTimer(dt) {
  if (state.mode === state.MODE.FREE) return;
  state.modeData.time = Math.max(0, state.modeData.time - dt);
  const label = state.mode === state.MODE.CS ? `CS ${state.cs} • MISS ${state.missedCs} • ${state.modeData.time.toFixed(1)}s` : `${state.mode} • ${state.modeData.time.toFixed(1)}s`;
  state.modeBanner.textContent = label;
  if (state.modeData.time <= 0) {
    const finished = state.mode;
    showResult(finished);
    setMode(state.MODE.FREE, {
      keepStats: true,
      keepResult: true,
      complete: finished
    });
    toast(`${finished} COMPLETE`, 'good');
  }
}
