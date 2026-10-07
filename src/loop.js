import { shiftDeadlines } from './game-clock.js';
import * as THREE from 'three';
import { state } from './state.js';
import { updateCameraMotion, updateCameraTransform } from './camera.js';
import { updateOrder, updateProjectiles } from './combat.js';
import { updateEnemyHpBars } from './minions.js';
import { updateVisuals, updateHud } from './ui.js';
import { animateChampion } from './champions.js';
import { updateCoach } from './coach.js';
import { updateAbilities } from './abilities.js';
import { updatePresentation } from './presentation.js';
import { updateMicro } from './micro.js';
import { updateAim } from './aim.js';
import { updateDuel } from './duel.js';
export function animate(ms) {
  const now = ms / 1000,
    dt = Math.min(.05, (ms - state.lastTime) / 1000 || 0);
  state.lastTime = ms;
  if(state.settingsOpen||state.menuOpen||state.resultPanel.classList.contains('show')||(state.mode==='DUEL'&&state.duel?.phase!=='play')) {state.pausedAt??=ms;state.renderer.render(state.scene,state.camera);requestAnimationFrame(animate);return;}
  if(state.pausedAt!==undefined){shiftDeadlines((ms-state.pausedAt)/1000);state.pausedAt=undefined;}
  updateAbilities(dt,now);
  updateOrder(dt, now);
  updateProjectiles(dt, now);
  updateDuel(dt,now);
  updateMicro(dt,now);
  updateAim();
  updateVisuals(dt);
  updateCameraMotion(dt);
  updateCameraTransform();
  updateEnemyHpBars();
  updateHud(now);
  animateChampion(dt,now);updatePresentation(dt,now);updateCoach(dt);
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
