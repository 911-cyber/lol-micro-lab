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
  if(state.abilities)state.abilities.pending=null;
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
  const destination=navigationPoint(point);delta.copy(destination).sub(state.player.position).setY(0).normalize();
  state.player.position.addScaledVector(delta, Math.min(step,state.player.position.distanceTo(destination)));
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
  const destination=navigationPoint(e.group.position);delta.copy(destination).sub(state.player.position).setY(0).normalize();
  state.player.position.addScaledVector(delta, Math.min(Math.max(0,step),state.player.position.distanceTo(destination)));
  clampPoint(state.player.position);
  facePoint(e.group.position);
  return dist - step <= stop + .01;
}

// A small deterministic path around the two solid towers; cursor movement never crosses their bases.
function navigationPoint(goal){
 const origin=state.player.position,old=state.navigation;
 if(old&&old.goal.distanceTo(goal)<.6){while(old.points.length&&origin.distanceTo(old.points[0])<.15)old.points.shift();if(old.points.length)return old.points[0];}
 const direction=goal.clone().sub(origin).setY(0),length=direction.length();if(length<.01)return goal;direction.normalize();
 for(const tower of [state.duel?.blue,state.duel?.red]){if(!tower?.alive)continue;const center=tower.group.position,radius=tower.radius+state.PLAYER_RADIUS+.22,projection=center.clone().sub(origin).dot(direction);if(projection<=0||projection>=length)continue;
  const closest=origin.clone().addScaledVector(direction,projection);if(closest.distanceTo(center)>=radius)continue;
  const side=new THREE.Vector3(-direction.z,0,direction.x);if(goal.clone().sub(center).dot(side)<0)side.negate();const points=[center.clone().addScaledVector(direction,-radius).addScaledVector(side,radius),center.clone().addScaledVector(direction,radius).addScaledVector(side,radius),goal.clone()].map(clampPoint);state.navigation={goal:goal.clone(),points};return points[0];
 }
 state.navigation=null;return goal;
}
