import * as THREE from 'three';
import { state } from './state.js';
import { updateCameraMotion, updateCameraTransform } from './camera.js';
import { updateOrder, updateProjectiles } from './combat.js';
import { respawnEnemies } from './entities.js';
import { updateCsMode } from './minions.js';
import { updateLane } from './lane.js';
import { updateKiteMode, updateTargetMode, updateSpacingMode, updateDodgeMode, updateModeTimer } from './drills.js';
import { updateVisuals, updateHud } from './ui.js';
export function animate(ms) {
  const now = ms / 1000,
    dt = Math.min(.05, (ms - state.lastTime) / 1000 || 0);
  state.lastTime = ms;
  updateOrder(dt, now);
  updateProjectiles(dt, now);
  respawnEnemies(now);
  updateKiteMode(dt, now);
  updateTargetMode(dt);
  updateSpacingMode(dt, now);
  updateDodgeMode(dt);
  updateCsMode(dt, now);
  updateLane(dt, now);
  updateModeTimer(dt);
  updateVisuals(dt);
  updateCameraMotion(dt);
  updateCameraTransform();
  updateHud(now);
  state.renderer.render(state.scene, state.camera);
  requestAnimationFrame(animate);
}
export function startLoop() {
  addEventListener('resize', () => {
    state.camera.aspect = innerWidth / innerHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(innerWidth, innerHeight);
  });
  updateCameraTransform();
  updateHud(0);
  requestAnimationFrame(animate);
}
