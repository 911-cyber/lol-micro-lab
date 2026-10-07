import * as THREE from 'three';
import { state } from './state.js';
import { screenToGround } from './camera.js';
import { cancelWindup, notePostShotMove } from './combat.js';
import { showMarker } from './ui.js';
import { cancelChannel } from './abilities.js';
export function clampPoint(p) {
  p.x = THREE.MathUtils.clamp(p.x, state.arenaBounds?.minX ?? -42, state.arenaBounds?.maxX ?? 42);
  p.z = THREE.MathUtils.clamp(p.z, state.arenaBounds?.minZ ?? -32, state.arenaBounds?.maxZ ?? 32);
  p.y = 0;
  return p;
}
export function facePoint(p) {
  state.player.lookAt(p.x, state.player.position.y, p.z);
}
export function issueMovePoint(point, show = true) {
  cancelChannel('move');
  point = clampPoint(point.clone());
  cancelWindup('move');
  notePostShotMove();
  state.order = {
    type: 'move',
    point,
    target: null
  };
  if (show) showMarker(point);
}
export function issueMoveFromScreen(x, y, show = true) {
  const hit = screenToGround(x, y);
  if (hit) issueMovePoint(hit, show);
}
export function issueStop() {
  cancelChannel('stop');
  cancelWindup('stop');
  state.order = {
    type: 'idle',
    point: state.player.position.clone(),
    target: null
  };
  state.rightMouseHeld = false;
}
export function moveToward(point, dt, stopDistance = 0) {
  if(state.playerRootUntil>performance.now()/1000)return false;
  const delta = new THREE.Vector3().subVectors(point, state.player.position);
  delta.y = 0;
  const dist = delta.length();
  if (dist <= stopDistance + .025) return true;
  delta.normalize();
  const step = Math.min(Math.max(0, dist - stopDistance), state.MOVE_SPEED * dt);
  state.player.position.addScaledVector(delta, step);
  clampPoint(state.player.position);
  facePoint(state.player.position.clone().add(delta));
  return dist - step <= stopDistance + .025;
}
export function moveTowardTarget(e, dt) {
  if(state.playerRootUntil>performance.now()/1000)return false;
  const stop = state.ATTACK_RANGE + state.PLAYER_RADIUS + e.radius;
  const delta = new THREE.Vector3().subVectors(e.group.position, state.player.position);
  delta.y = 0;
  const dist = delta.length();
  if (dist <= stop) return true;
  delta.normalize();
  const step = Math.min(dist - stop, state.MOVE_SPEED * dt);
  state.player.position.addScaledVector(delta, Math.max(0, step));
  clampPoint(state.player.position);
  facePoint(e.group.position);
  return dist - step <= stop + .01;
}
