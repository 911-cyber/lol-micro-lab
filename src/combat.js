import * as THREE from 'three';
import { state } from './state.js';
import { clampPoint, facePoint, moveToward, moveTowardTarget } from './player.js';
import { livingEnemies } from './entities.js';
import { toast, flashTarget, showMarker } from './ui.js';
export function edgeDistance(e) {
  return Math.max(0, state.player.position.distanceTo(e.group.position) - state.PLAYER_RADIUS - e.radius);
}
export function enemyInAttackRange(e) {
  return e?.alive && edgeDistance(e) <= state.ATTACK_RANGE + .001;
}
export function cancelWindup(reason = 'move') {
  if (state.attackState !== 'windup') return false;
  state.attackState = 'idle';
  state.attackTarget = null;
  state.nextAttackReady = performance.now() / 1000;
  state.cancels++;
  state.score = Math.max(0, state.score - 20);
  toast(reason === 'stop' ? 'AA cancelled by Stop' : 'AA cancelled — moved before release', 'bad');
  return true;
}
export function notePostShotMove() {
  const now = performance.now() / 1000;
  if (state.awaitingKiteMove && now - state.lastShotAt <= .46) {
    state.awaitingKiteMove = false;
    state.cleanKites++;
    state.score += 30;
    toast('Clean kite: shot → move', 'good');
  }
}
export function issueAttack(target) {
  if (!target?.alive) return;
  state.order = {
    type: 'attack',
    point: target.group.position.clone(),
    target
  };
  flashTarget(target);
}
export function nearestEnemyToPoint(point, rangeOnly = true) {
  let best = null,
    bestD = Infinity;
  for (const e of livingEnemies()) {
    if (rangeOnly && !enemyInAttackRange(e)) continue;
    const d = e.group.position.distanceToSquared(point);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}
export function issueAttackMove(point) {
  point = clampPoint(point.clone());
  cancelWindup('move');
  notePostShotMove();
  const target = nearestEnemyToPoint(point, true);
  state.order = {
    type: 'attackMove',
    point,
    target
  };
  showMarker(point, 0xe06469);
  if (target) flashTarget(target);
}
export function startAttack(e, now) {
  if (!e?.alive || now < state.nextAttackReady || state.attackState === 'windup' || !enemyInAttackRange(e)) return false;
  state.attackState = 'windup';
  state.attackTarget = e;
  state.windupEnd = now + state.WINDUP_TIME;
  state.nextAttackReady = now + state.ATTACK_INTERVAL;
  facePoint(e.group.position);
  return true;
}
export function launchProjectile(e, now) {
  state.attackState = 'idle';
  state.attackTarget = null;
  state.lastShotAt = now;
  state.awaitingKiteMove = true;
  const mesh = new THREE.Mesh(state.projectileGeom, state.projectileMat.clone());
  mesh.position.copy(state.player.position).add(new THREE.Vector3(0, 1.05, 0));
  state.scene.add(mesh);
  state.projectiles.push({
    mesh,
    target: e
  });
}
export function killEnemy(e, now, fromPlayer = true) {
  e.alive = false;
  e.group.visible = false;
  if (e.hpBar) e.hpBar.root.visible = false;
  e.respawnAt = now + .8;
  if (fromPlayer) {
    state.score += e.type === 'minion' ? 45 : 250;
    if (e.type === 'minion') state.cs++;
  }
}
export function damageEnemy(e, amount, now, fromPlayer = true) {
  if (!e?.alive) return;
  e.hp = Math.max(0, e.hp - amount);
  if (fromPlayer) {
    state.hits++;
    state.score += 60;
  }
  if (e.hp <= 0) killEnemy(e, now, fromPlayer);
}
export function updateProjectiles(dt, now) {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i],
      e = p.target;
    if (!e?.alive) {
      state.scene.remove(p.mesh);
      state.projectiles.splice(i, 1);
      continue;
    }
    const aim = e.group.position.clone().add(new THREE.Vector3(0, .9, 0));
    const delta = aim.sub(p.mesh.position),
      dist = delta.length(),
      step = state.PROJECTILE_SPEED * dt;
    if (dist <= step + .18) {
      state.scene.remove(p.mesh);
      state.projectiles.splice(i, 1);
      damageEnemy(e, state.ATTACK_DAMAGE, now, true);
    } else {
      p.mesh.position.addScaledVector(delta.normalize(), step);
    }
  }
}
export function updateOrder(dt, now) {
  if (state.attackState === 'windup') {
    if (!state.attackTarget?.alive) {
      state.attackState = 'idle';
      state.attackTarget = null;
      return;
    }
    facePoint(state.attackTarget.group.position);
    if (now >= state.windupEnd) launchProjectile(state.attackTarget, now);
    return;
  }
  if (state.order.type === 'idle') return;
  if (state.order.type === 'move') {
    if (moveToward(state.order.point, dt)) state.order.type = 'idle';
    return;
  }
  if (state.order.type === 'attack') {
    const e = state.order.target;
    if (!e?.alive) {
      state.order.type = 'idle';
      return;
    }
    if (enemyInAttackRange(e)) {
      facePoint(e.group.position);
      startAttack(e, now);
    } else moveTowardTarget(e, dt);
    return;
  }
  if (state.order.type === 'attackMove') {
    if (state.order.target?.alive && enemyInAttackRange(state.order.target)) {
      startAttack(state.order.target, now);
      return;
    }
    const target = nearestEnemyToPoint(state.order.point, true);
    if (target) {
      state.order.target = target;
      flashTarget(target);
      startAttack(target, now);
      return;
    }
    if (moveToward(state.order.point, dt)) state.order.type = 'idle';
  }
}
