import { updateDuelOverlay } from './duel-overlay.js';
import * as THREE from 'three';
import { state } from './state.js';
import { updateMinimap } from './minimap.js';
export function showMarker(point, color = 0x55e36f) {
  state.markerMaterial.color.setHex(color);
  state.orderMarker.position.set(point.x, .065, point.z);
  state.orderMarker.scale.setScalar(.82);
  state.markerMaterial.opacity = .92;
  state.orderMarker.visible = true;
  state.markerLife = .34;
}
export function flashTarget(e) {
  if (!e) return;
  state.activeTarget = e;
  state.targetFlash = .24;
  state.targetRing.position.set(e.group.position.x, .055, e.group.position.z);
  state.targetRing.material.opacity = .95;
  state.targetRing.visible = true;
}
export function toast(text, kind = '') {
  state.toastEl.textContent = text;
  state.toastEl.className = `show ${kind}`.trim();
  state.toastUntil = performance.now() / 1000 + 1.0;
}
export function hideResult() {
  state.resultPanel.classList.remove('show');
}
export function updateVisuals(dt) {
  state.rangeRing.position.set(state.player.position.x, .05, state.player.position.z);
  state.markerLife -= dt;
  if (state.orderMarker.visible) {
    if (state.markerLife <= 0) state.orderMarker.visible = false;else {
      const t = 1 - state.markerLife / .34;
      state.markerMaterial.opacity = .92 * (1 - t);
      state.orderMarker.scale.setScalar(.82 + t * .55);
    }
  }
  state.targetFlash -= dt;
  if (state.targetRing.visible) {
    if (state.activeTarget?.alive) state.targetRing.position.set(state.activeTarget.group.position.x, .055, state.activeTarget.group.position.z);
    if (state.targetFlash <= 0) state.targetRing.material.opacity = Math.max(.2, state.targetRing.material.opacity - dt * 2.5);
  }
}
export function updateHud(now) {
  updateMinimap();updateDuelOverlay(now);
  if(state.selectedChampion){document.querySelector('#playAttackSpeed').textContent=state.ATTACK_SPEED.toFixed(2);document.querySelector('#playRange').textContent=Math.round(state.ATTACK_RANGE*100);document.querySelector('#hudAD').textContent=Math.round(state.ATTACK_DAMAGE);document.querySelector('#hudAS').textContent=state.ATTACK_SPEED.toFixed(2);document.querySelector('#hudMS').textContent=Math.round(state.MOVE_SPEED*100);document.querySelector('#cameraFollow').textContent=state.cameraLocked?'Y 追従ON':'Y 追従OFF';document.querySelector('#trainingPreset').textContent='MID DUEL';}
  state.modeStateEl.textContent = state.mode;
  state.difficultyStateEl.textContent = state.difficulty().name;
  const attackCycle=document.querySelector('#attackCycle');
  if(attackCycle&&state.selectedChampion)attackCycle.textContent=state.reloadUntil>now?`リロード ${(state.reloadUntil-now).toFixed(1)}s`:state.selectedChampion.id==='Jhin'?`ウィスパー ${4-(state.championShots||0)%4} / 4発`:`${state.selectedChampion.weapon} · AD ${state.ATTACK_DAMAGE}`;
    state.orderStateEl.textContent = state.abilities?.cast ? 'CAST '+state.abilities.cast.key : state.abilities?.dash ? 'DASH' : state.abilities?.channel ? 'CHANNEL R' : state.attackState === 'windup' ? 'WINDUP' : state.order.type.toUpperCase();
    state.orderStateEl.className = state.abilities?.cast||state.abilities?.channel||state.attackState === 'windup' ? 'attacking' : state.order.type === 'move' ? 'moving' : '';
  state.hitsStateEl.textContent = state.hits;
  state.cancelStateEl.textContent = state.cancels;
  state.kiteStateEl.textContent = state.cleanKites;
  state.dodgeStateEl.textContent = state.dodges;
  state.csStateEl.textContent = state.cs;
  state.scoreStateEl.textContent = Math.round(state.score);
  state.playerHpFill.style.width = `${state.playerHp}%`;
  state.playerHpText.textContent = `${Math.round(state.playerHp)} / ${state.playerMaxHp}`;
  if (state.activeTarget?.alive && state.activeTarget.group.visible) {
    state.targetNameEl.textContent = state.activeTarget.name;
    state.enemyHpFill.style.width = `${Math.max(0, state.activeTarget.hp / state.activeTarget.maxHp * 100)}%`;
    state.enemyHpText.textContent = `${Math.ceil(state.activeTarget.hp)} / ${state.activeTarget.maxHp}`;
  } else {
    state.targetNameEl.textContent = 'NO TARGET';
    state.enemyHpFill.style.width = '0%';
    state.enemyHpText.textContent = '—';
  }
  if (now > state.toastUntil) state.toastEl.className = '';
}
