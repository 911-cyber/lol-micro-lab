import * as THREE from 'three';
import { state } from './state.js';
import { createEnemy, createAlliedMinion, livingEnemies } from './entities.js';
import { enemyMovement } from './abilities.js';
export function makeMinionHpBar(unit) {
  const root = new THREE.Group();
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({
    color: 0x0a0d12,
    transparent: true,
    opacity: .98,
    depthTest: false,
    depthWrite: false
  }));
  const fillColor = unit.team === 'ally' ? 0x4b9cff : 0xd93e4b;
  const fillMat = new THREE.SpriteMaterial({
    color: fillColor,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false
  });
  const fill = new THREE.Sprite(fillMat);
  bg.scale.set(1.64, .155, 1);
  fill.scale.set(1.49, .088, 1);
  bg.renderOrder = 30;
  fill.renderOrder = 31;
  root.add(bg, fill);
  state.scene.add(root);
  unit.hpBar = {
    root,
    bg,
    fill,
    fillMat
  };
  updateMinionHpBar(unit);
}
export function updateMinionHpBar(unit) {
  if (!unit.hpBar) return;
  const ratio = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
  const y = unit.type==='tower'?4.5:unit.type!=='minion' ? unit.group.userData.profile?3.65:2.45 : unit.minionClass === 'melee' || unit.maxHp === 320 ? 1.82 : 1.68;
  unit.hpBar.root.position.set(unit.group.position.x, y, unit.group.position.z);
  unit.hpBar.root.quaternion.copy(state.camera.quaternion);
  unit.hpBar.root.visible = (unit.type!=='minion'||state.mode === state.MODE.CS || state.mode === state.MODE.LANE||state.mode==='DUEL') && unit.alive && unit.group.visible;
  unit.hpBar.fill.scale.x = 1.49 * ratio;
  unit.hpBar.fill.position.x = -.745 * (1 - ratio);
}
export function updateEnemyHpBars(){
  for(const enemy of [...state.enemies,...state.alliedMinions]){if(enemy.type!=='minion'&&!enemy.hpBar&&enemy.alive&&enemy.group.visible)makeMinionHpBar(enemy);updateMinionHpBar(enemy);}
}
export function makeLastHitIndicator(e) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(.62, .73, 36), new THREE.MeshBasicMaterial({
    color: 0xf5f0d0,
    transparent: true,
    opacity: .78,
    side: THREE.DoubleSide,
    depthWrite: false
  }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .06;
  state.scene.add(ring);
  e.lastHitIndicator = ring;
}
export function spawnWave() {
  state.modeData.wave++;
  for (const e of state.enemies.slice(1)) {
    state.scene.remove(e.group);
    if (e.lastHitIndicator) state.scene.remove(e.lastHitIndicator);
    if (e.hpBar) state.scene.remove(e.hpBar.root);
  }
  state.enemies.splice(1);
  for (const a of state.alliedMinions) {
    state.scene.remove(a.group);
    if (a.hpBar) state.scene.remove(a.hpBar.root);
  }
  state.alliedMinions.splice(0);
  state.minionProjectiles.splice(0).forEach(p => state.scene.remove(p.mesh));
  const enemyXs = [5.8, 7.0, 8.2, 7.2, 8.5, 9.8];
  const allyXs = [-.8, -2.0, -3.2, -2.2, -3.5, -4.8];
  const zOffsets = [-.9, .15, 1.2, -1.8, -.55, .75];
  for (let i = 0; i < 6; i++) {
    const melee = i < 3,
      cls = melee ? 'melee' : 'caster',
      hp = melee ? 320 : 220;
    const e = createEnemy(`${melee ? 'MELEE' : 'CASTER'} MINION`, enemyXs[i], zOffsets[i], melee ? 0xb45a52 : 0xa56b73, hp, melee ? .48 : .42, 'minion');
    e.minionClass = cls;
    e.group.scale.setScalar(melee ? .62 : .55);
    e.hp = e.maxHp;
    makeLastHitIndicator(e);
    makeMinionHpBar(e);
    const a = createAlliedMinion(`ALLY ${melee ? 'MELEE' : 'CASTER'}`, allyXs[i], zOffsets[i] * .9, hp, melee ? .48 : .42, cls);
    makeMinionHpBar(a);
  }
}
export function livingAlliedMinions() {
  return state.alliedMinions.filter(a => a.alive && a.group.visible);
}
export function nearestUnit(origin, units) {
  let best = null,
    bestD = Infinity;
  for (const u of units) {
    const d = origin.distanceToSquared(u.group.position);
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}
export function laneUnitStats(unit) {
  return unit.minionClass === 'caster' ? {
    range: 4.25,
    move: 1.05,
    interval: 1.45,
    damage: 16
  } : {
    range: .92,
    move: 1.25,
    interval: 1.20,
    damage: 22
  };
}
export function damageLaneUnit(unit, amount, now, sourceTeam) {
  if (!unit?.alive) return;
  unit.hp = Math.max(0, unit.hp - amount);
  if (unit.hp > 0) return;
  unit.alive = false;
  unit.group.visible = false;
  if (unit.hpBar) unit.hpBar.root.visible = false;
  if (unit.team === 'enemy') {
    if (unit.lastHitIndicator) unit.lastHitIndicator.visible = false;
    if (sourceTeam === 'ally') {
      state.missedCs++;
      state.score = Math.max(0, state.score - 18);
    }
  }
}
export function launchMinionProjectile(attacker, target, damage) {
  const mat = attacker.team === 'ally' ? state.allyMinionProjectileMat : state.enemyMinionProjectileMat;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), mat.clone());
  mesh.position.copy(attacker.group.position).add(new THREE.Vector3(0, .72, 0));
  state.scene.add(mesh);
  state.minionProjectiles.push({
    mesh,
    target,
    damage,
    sourceTeam: attacker.team,
    speed: 9.5
  });
}
export function updateMinionProjectiles(dt, now) {
  for (let i = state.minionProjectiles.length - 1; i >= 0; i--) {
    const p = state.minionProjectiles[i],
      t = p.target;
    if (!t?.alive) {
      state.scene.remove(p.mesh);
      state.minionProjectiles.splice(i, 1);
      continue;
    }
    const aim = t.group.position.clone().add(new THREE.Vector3(0, .65, 0));
    const delta = aim.sub(p.mesh.position),
      dist = delta.length(),
      step = p.speed * dt;
    if (dist <= step + .12) {
      state.scene.remove(p.mesh);
      state.minionProjectiles.splice(i, 1);
      damageLaneUnit(t, p.damage, now, p.sourceTeam);
    } else p.mesh.position.addScaledVector(delta.normalize(), step);
  }
}
export function updateLaneMinion(unit, opponents, dt, now) {
  if (!unit.alive) return;
  const target = nearestUnit(unit.group.position, opponents);
  if (!target) return;
  const st = laneUnitStats(unit);
  const delta = new THREE.Vector3().subVectors(target.group.position, unit.group.position);
  delta.y = 0;
  const dist = delta.length();
  if (dist > st.range) {
    delta.normalize();
    unit.group.position.addScaledVector(delta, Math.min(st.move * dt * enemyMovement(unit,now), dist - st.range));
    unit.group.lookAt(unit.group.position.x + delta.x, 0, unit.group.position.z + delta.z);
  } else if (now >= unit.nextAttack) {
    unit.nextAttack = now + st.interval * (1.04 - Math.min(.12, state.difficultyIndex * .04));
    unit.group.lookAt(target.group.position.x, 0, target.group.position.z);
    if (unit.minionClass === 'caster') launchMinionProjectile(unit, target, st.damage);else damageLaneUnit(target, st.damage, now, unit.team);
  }
}
export function updateCsMode(dt, now) {
  if (state.mode !== state.MODE.CS && state.mode !== state.MODE.LANE) return;
  const enemyMinions = livingEnemies().filter(e => e.type === 'minion');
  const allies = livingAlliedMinions();
  if (!enemyMinions.length && state.modeData.time > 1) {
    spawnWave();
    return;
  }
  for (const a of allies) updateLaneMinion(a, enemyMinions, dt, now);
  for (const e of enemyMinions) updateLaneMinion(e, allies, dt, now);
  updateMinionProjectiles(dt, now);
  for (const e of enemyMinions) {
    if (e.lastHitIndicator) {
      e.lastHitIndicator.position.set(e.group.position.x, .06, e.group.position.z);
      e.lastHitIndicator.visible = e.hp > 0 && e.hp <= state.ATTACK_DAMAGE;
    }
    updateMinionHpBar(e);
  }
  for (const a of allies) updateMinionHpBar(a);
}
