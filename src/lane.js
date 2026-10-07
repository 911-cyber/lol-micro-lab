import * as THREE from 'three';
import { state } from './state.js';
import { edgeDistance } from './combat.js';
import { makeMinionHpBar, updateMinionHpBar } from './minions.js';
import { toast } from './ui.js';
import { setEnemyAppearance } from './entities.js';
import { championProjectile, disposeObject } from './champions.js';
import { championById } from './roster.js';

const SETTINGS = [
  { windup: .75, interval: 3, speed: 7.2, damage: 8, movement: 1.3 },
  { windup: .55, interval: 2.4, speed: 8.5, damage: 10, movement: 1.6 },
  { windup: .4, interval: 1.9, speed: 10.2, damage: 12, movement: 1.9 }
];
const SHOT_RANGE = 12;
const HIT_RADIUS = .72;

function removeMesh(mesh) {
  state.scene.remove(mesh);
  disposeObject(mesh);
}

export function resetLane() {
  if (!state.laneData) return;
  if (state.laneData.warning) removeMesh(state.laneData.warning.mesh);
  for (const shot of state.laneData.shots) removeMesh(shot.mesh);
  state.laneData = null;
}

export function startLane() {
  const enemy = state.mainDummy;
  if(state.selectedChampion)setEnemyAppearance(enemy,'Ezreal');
  enemy.name = state.selectedChampion?'エズリアル · 練習用':'LANE OPPONENT';
  enemy.type = 'champion';
  enemy.hp = enemy.maxHp = 700;
  enemy.group.position.set(9, 0, 3);
  enemy.alive = true;
  enemy.group.visible = true;
  makeMinionHpBar(enemy);
  state.laneData = { nextAttack: performance.now() / 1000 + 2, warning: null, shots: [] };
  state.laneMetrics = { fired: 0, hit: 0, dodged: 0, damage: 0 };
}

function prepareShot(now) {
  const config = SETTINGS[state.difficultyIndex];
  const origin = state.mainDummy.group.position.clone().setY(.35);
  const direction = state.player.position.clone().sub(origin).setY(0).normalize();
  if (!direction.lengthSq()) direction.set(-1, 0, 0);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.5, SHOT_RANGE), new THREE.MeshBasicMaterial({
    color: 0xffc16e, transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false
  }));
  mesh.rotation.set(-Math.PI / 2, 0, Math.atan2(direction.x, direction.z));
  mesh.position.copy(origin).addScaledVector(direction, SHOT_RANGE / 2).setY(.075);
  state.scene.add(mesh);
  state.mainDummy.group.lookAt(state.player.position.x, 0, state.player.position.z);
  // Lock the aim when the warning appears; moving sideways during windup can evade it.
  state.laneData.warning = { mesh, origin, direction, releaseAt: now + config.windup, config };
  state.laneData.nextAttack = now + config.interval;
}

function releaseShot() {
  const warning = state.laneData.warning;
  removeMesh(warning.mesh);
  state.laneData.warning = null;
  const mesh = state.selectedChampion?championProjectile(championById('Ezreal')):new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffa25c }));
  mesh.position.copy(warning.origin);
  mesh.lookAt(warning.origin.clone().add(warning.direction));
  state.scene.add(mesh);
  state.laneData.shots.push({ mesh, direction: warning.direction, config: warning.config, traveled: 0 });
  state.laneMetrics.fired++;
}

function updateShots(dt) {
  const data = state.laneData;
  const player = state.player.position.clone().setY(.35);
  for (let i = data.shots.length - 1; i >= 0; i--) {
    const shot = data.shots[i];
    const previous = shot.mesh.position.clone();
    const step = Math.min(shot.config.speed * dt, SHOT_RANGE - shot.traveled);
    shot.mesh.position.addScaledVector(shot.direction, step);
    shot.traveled += step;
    // Swept collision keeps hits consistent even on a slow frame.
    const segment = new THREE.Line3(previous, shot.mesh.position);
    const closest = segment.closestPointToPoint(player, true, new THREE.Vector3());
    if (closest.distanceTo(player) < HIT_RADIUS) {
      state.playerHp = Math.max(0, state.playerHp - shot.config.damage);
      state.laneMetrics.hit++;
      state.laneMetrics.damage += shot.config.damage;
      state.score = Math.max(0, state.score - 50);
      toast('ハラス被弾 — 予告線の横へ移動', 'bad');
    } else if (shot.traveled < SHOT_RANGE) {
      continue;
    } else {
      state.laneMetrics.dodged++;
      state.dodges++;
      state.score += 25;
    }
    removeMesh(shot.mesh);
    data.shots.splice(i, 1);
  }
}

export function updateLane(dt, now) {
  if (state.mode !== state.MODE.LANE || !state.laneData) return;
  const enemy = state.mainDummy;
  const data = state.laneData;
  if (!enemy.alive) {
    if (data.warning) {
      removeMesh(data.warning.mesh);
      data.warning = null;
    }
    if (now >= enemy.respawnAt + 2.2) {
      enemy.alive = true;
      enemy.hp = enemy.maxHp;
      enemy.group.visible = true;
      enemy.group.position.set(9, 0, 3);
      data.nextAttack = now + 2;
    }
  } else if (data.warning) {
    if (now >= data.warning.releaseAt) releaseShot();
  } else {
    const config = SETTINGS[state.difficultyIndex];
    const distance = edgeDistance(enemy);
    const direction = state.player.position.clone().sub(enemy.group.position).setY(0);
    if (direction.lengthSq()) direction.normalize();
    if (distance > 6.2) enemy.group.position.addScaledVector(direction, config.movement * dt);
    if (distance < 4.2) enemy.group.position.addScaledVector(direction, -config.movement * dt);
    enemy.group.position.x = THREE.MathUtils.clamp(enemy.group.position.x, -2, 12);
    enemy.group.position.z = THREE.MathUtils.clamp(enemy.group.position.z, -6, 6);
    if (distance <= 7 && now >= data.nextAttack) prepareShot(now);
  }
  updateShots(dt);
  updateMinionHpBar(enemy);
}
