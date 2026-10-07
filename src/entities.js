import * as THREE from 'three';
import { state } from './state.js';
import { rayFromScreen } from './camera.js';
import { makeChampion } from './scene.js';
import { buildChampion, disposeObject } from './champions.js';
import { championById } from './roster.js';
export function setEnemyAppearance(enemy,id=null) {
  const previous=enemy.group,position=previous.position.clone();
  previous.remove(enemy.hitbox);state.scene.remove(previous);disposeObject(previous);
  enemy.group=id?buildChampion(championById(id),'enemy'):makeChampion(0xd95762,0x69232b);
  enemy.group.position.copy(position);enemy.group.scale.setScalar(1.05);enemy.group.add(enemy.hitbox);state.scene.add(enemy.group);
}
export function createEnemy(name, x, z, color = 0xd95762, maxHp = 700, radius = .76, type = 'dummy') {
  const group = makeChampion(color, 0x69232b);
  group.position.set(x, 0, z);
  group.scale.setScalar(type === 'minion' ? .62 : 1.05);
  state.scene.add(group);
  const hitbox = new THREE.Mesh(new THREE.SphereGeometry(type === 'minion' ? .85 : 1.25, 14, 10), new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false
  }));
  hitbox.position.y = .85;
  group.add(hitbox);
  const e = {
    name,
    group,
    hitbox,
    hp: maxHp,
    maxHp,
    radius,
    type,
    team: 'enemy',
    alive: true,
    respawnAt: 0,
    velocity: new THREE.Vector3(),
    aiClock: Math.random() * 4,
    lastHitIndicator: null,
    hpBar: null,
    nextAttack: 0,
    minionClass: null
  };
  state.enemies.push(e);
  return e;
}
export function createAlliedMinion(name, x, z, maxHp = 320, radius = .48, minionClass = 'melee') {
  const color = minionClass === 'melee' ? 0x4d82c8 : 0x637ccf;
  const group = makeChampion(color, 0x24456f);
  group.position.set(x, 0, z);
  group.scale.setScalar(minionClass === 'melee' ? .62 : .55);
  state.scene.add(group);
  const unit = {
    name,
    group,
    hp: maxHp,
    maxHp,
    radius,
    type: 'minion',
    team: 'ally',
    alive: true,
    nextAttack: 0,
    minionClass,
    hpBar: null
  };
  state.alliedMinions.push(unit);
  return unit;
}
export function livingEnemies() {
  return state.enemies.filter(e => e.alive && e.group.visible);
}
export function pickEnemy(x, y) {
  rayFromScreen(x, y);
  let best = null,
    bestDist = Infinity;
  for (const e of livingEnemies()) {
    const hits = state.raycaster.intersectObject(e.group, true);
    if (hits.length && hits[0].distance < bestDist) {
      best = e;
      bestDist = hits[0].distance;
    }
  }
  return best;
}
export function resetEntities() {
  if(state.mainDummy.group.userData.profile)setEnemyAppearance(state.mainDummy);
  for (const e of state.enemies) {
    if (e !== state.mainDummy) {
      state.scene.remove(e.group);
      if(e.type==='caster')disposeObject(e.group);
      if (e.lastHitIndicator) state.scene.remove(e.lastHitIndicator);
      if (e.hpBar) state.scene.remove(e.hpBar.root);
    }
  }
  for (const a of state.alliedMinions) {
    state.scene.remove(a.group);
    if (a.hpBar) state.scene.remove(a.hpBar.root);
  }
  state.alliedMinions.splice(0);
  state.minionProjectiles.splice(0).forEach(p => state.scene.remove(p.mesh));
  state.enemies.splice(1);
  if (state.mainDummy.hpBar) {
    state.scene.remove(state.mainDummy.hpBar.root);
    state.mainDummy.hpBar.bg.material.dispose();
    state.mainDummy.hpBar.fillMat.dispose();
  }
  state.mainDummy.alive = true;
  state.mainDummy.group.visible = true;
  state.mainDummy.hp = state.mainDummy.maxHp = 700;
  state.mainDummy.microOpeningUntil=0;state.mainDummy.recoverUntil=0;
  state.mainDummy.type = 'dummy';
  state.mainDummy.name = 'TRAINING DUMMY';
  state.mainDummy.radius = .76;
  state.mainDummy.group.scale.setScalar(1.05);
  state.mainDummy.group.position.set(8, 0, -2);
  state.mainDummy.velocity.set(0, 0, 0);
  state.mainDummy.lastHitIndicator = null;
  state.mainDummy.hpBar = null;
  state.activeTarget = state.mainDummy;
  state.dangerRing.visible = false;
  state.rangeRing.visible = false;
}
export function respawnEnemies(now) {
  if (state.mode==='DUEL') return;
  if (state.mode === state.MODE.CS || state.mode === state.MODE.LANE || state.mode === state.MODE.DODGE) return;
  for (const e of state.enemies) {
    if(e.type==='caster')continue;
    if (e.alive || now < e.respawnAt) continue;
    e.alive = true;
    e.group.visible = true;
    e.hp = e.maxHp;
    if (state.mode === state.MODE.TARGET) {
      e.group.position.x = THREE.MathUtils.randFloat(4, 11);
      e.group.position.z = THREE.MathUtils.randFloat(-4, 6);
    } else if (e === state.mainDummy) {
      e.group.position.set(8, 0, -2);
    }
  }
}
