import * as THREE from 'three';
import { state } from './state.js';
import { screenToGround, cameraBasisOnGround, clampFocus } from './camera.js';
import { issueMoveFromScreen, issueStop } from './player.js';
import { issueAttackMove, issueAttack } from './combat.js';
import { pickEnemy } from './entities.js';
import { cycleDifficulty, setMode } from './drills.js';
import { toast } from './ui.js';
export function bindInput() {
  state.renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
  state.renderer.domElement.addEventListener('pointerdown', e => {
    state.pointerPx.set(e.clientX, e.clientY);
    if (e.button === 2) {
      e.preventDefault();
      state.rightMouseHeld = true;
      state.lastMoveIssueMs = performance.now();
      const enemy = pickEnemy(e.clientX, e.clientY);
      if (e.shiftKey) {
        const hit = screenToGround(e.clientX, e.clientY);
        if (hit) issueAttackMove(hit);
      } else if (enemy) issueAttack(enemy);else issueMoveFromScreen(e.clientX, e.clientY, true);
    }
    if (e.button === 0 && state.attackMoveArmed) {
      e.preventDefault();
      state.attackMoveArmed = false;
      state.rangeRing.visible = state.mode !== state.MODE.FREE;
      const hit = screenToGround(e.clientX, e.clientY);
      if (hit) issueAttackMove(hit);
    }
    if (e.button === 1) {
      e.preventDefault();
      state.middleDragging = true;
      state.lastMiddle.set(e.clientX, e.clientY);
      state.renderer.domElement.style.cursor = 'grabbing';
    }
  });
  state.renderer.domElement.addEventListener('pointermove', e => {
    state.pointerPx.set(e.clientX, e.clientY);
    state.pointerInside = true;
    if (state.rightMouseHeld && performance.now() - state.lastMoveIssueMs >= state.HOLD_MOVE_INTERVAL_MS) {
      state.lastMoveIssueMs = performance.now();
      if (!pickEnemy(e.clientX, e.clientY)) issueMoveFromScreen(e.clientX, e.clientY, false);
    }
    if (state.middleDragging) {
      const dx = e.clientX - state.lastMiddle.x,
        dy = e.clientY - state.lastMiddle.y;
      state.lastMiddle.set(e.clientX, e.clientY);
      const {
        forward,
        right
      } = cameraBasisOnGround();
      const w = state.CAMERA_DISTANCE * state.cameraSettings.zoom / 1100;
      state.cameraFocus.addScaledVector(right, -dx * w);
      state.cameraFocus.addScaledVector(forward, dy * w);
      clampFocus();
    }
  });
  state.renderer.domElement.addEventListener('pointerenter', () => state.pointerInside = true);
  state.renderer.domElement.addEventListener('pointerleave', () => state.pointerInside = false);
  state.renderer.domElement.addEventListener('auxclick', e => {
    if (e.button === 1) e.preventDefault();
  });
  window.addEventListener('pointerup', e => {
    if (e.button === 2) state.rightMouseHeld = false;
    if (e.button === 1) {
      state.middleDragging = false;
      state.renderer.domElement.style.cursor = '';
    }
  });
  window.addEventListener('blur', () => {
    state.rightMouseHeld = false;
    state.middleDragging = false;
    state.renderer.domElement.style.cursor = '';
  });
  state.renderer.domElement.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.10 : .90;
    state.cameraSettings.zoom = THREE.MathUtils.clamp(state.cameraSettings.zoom * factor, state.cameraSettings.minZoom, state.cameraSettings.maxZoom);
  }, {
    passive: false
  });
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!state.spaceHeld) state.cameraFocus.copy(state.player.position);
      state.spaceHeld = true;
    }
    if (e.code === 'KeyY' && !e.repeat) {
      state.cameraLocked = !state.cameraLocked;
      if (state.cameraLocked) state.cameraFocus.copy(state.player.position);
    }
    if (e.code === 'KeyS' && !e.repeat) {
      e.preventDefault();
      issueStop();
    }
    if (e.code === 'KeyA' && !e.repeat) {
      e.preventDefault();
      state.attackMoveArmed = true;
      state.rangeRing.visible = true;
      toast('Attack Move armed', 'info');
    }
    if (e.code === 'KeyD' && !e.repeat) {
      e.preventDefault();
      cycleDifficulty();
    }
    if (e.code === 'KeyR' && !e.repeat && state.mode !== state.MODE.FREE) {
      e.preventDefault();
      setMode(state.mode);
    }
    if (!e.repeat) {
      if (e.code === 'Digit1' || e.code === 'KeyK') setMode(state.MODE.KITE);
      if (e.code === 'Digit2') setMode(state.MODE.TARGET);
      if (e.code === 'Digit3') setMode(state.MODE.SPACING);
      if (e.code === 'Digit4') setMode(state.MODE.DODGE);
      if (e.code === 'Digit5') setMode(state.MODE.CS);
      if (e.code === 'Digit6') setMode(state.MODE.COMBINED);
      if (e.code === 'Digit7') setMode(state.MODE.LANE);
      if (e.code === 'Escape') setMode(state.MODE.FREE);
    }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space') state.spaceHeld = false;
  });
}
