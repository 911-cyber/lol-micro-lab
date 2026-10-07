import * as THREE from 'three';
import { state } from './state.js';
export function clampFocus() {
  state.cameraFocus.x = THREE.MathUtils.clamp(state.cameraFocus.x, state.arenaBounds?.minX ?? -34, state.arenaBounds?.maxX ?? 34);
  state.cameraFocus.z = THREE.MathUtils.clamp(state.cameraFocus.z, state.arenaBounds?.minZ ?? -25, state.arenaBounds?.maxZ ?? 25);
}
export function getCameraOffset() {
  const p = THREE.MathUtils.degToRad(state.CAMERA_PITCH_DEG),
    d = state.CAMERA_DISTANCE * state.cameraSettings.zoom;
  const yaw=THREE.MathUtils.degToRad(-57);
  return new THREE.Vector3(Math.sin(yaw)*Math.cos(p)*d,Math.sin(p)*d,Math.cos(yaw)*Math.cos(p)*d);
}
export function updateCameraTransform() {
  state.camera.position.copy(state.cameraFocus).add(getCameraOffset());
  state.camera.lookAt(state.cameraFocus);
}
export function cameraBasisOnGround() {
  const forward = new THREE.Vector3();
  state.camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, state.camera.up).normalize();
  return {
    forward,
    right
  };
}
export function rayFromScreen(x, y) {
  const r = state.renderer.domElement.getBoundingClientRect();
  state.pointerNdc.x = (x - r.left) / r.width * 2 - 1;
  state.pointerNdc.y = -((y - r.top) / r.height) * 2 + 1;
  state.raycaster.setFromCamera(state.pointerNdc, state.camera);
}
export function screenToGround(x, y) {
  rayFromScreen(x, y);
  const hit = new THREE.Vector3();
  return state.raycaster.ray.intersectPlane(state.groundPlane, hit) ? hit : null;
}
export function updateCameraMotion(dt) {
  if (state.cameraLocked || state.spaceHeld) {
    state.cameraFocus.copy(state.player.position);
    clampFocus();
    return;
  }
  if(state.middleDragging)return;
  let x=(state.cameraKeys?.ArrowRight?1:0)-(state.cameraKeys?.ArrowLeft?1:0),y=(state.cameraKeys?.ArrowUp?1:0)-(state.cameraKeys?.ArrowDown?1:0);
  if (state.cameraSettings.edgeScroll&&state.pointerInside) {
  if (state.pointerPx.x <= state.EDGE_SCROLL_PX) x = -1;else if (state.pointerPx.x >= innerWidth - state.EDGE_SCROLL_PX) x = 1;
  if (state.pointerPx.y <= state.EDGE_SCROLL_PX) y = 1;else if (state.pointerPx.y >= innerHeight - state.EDGE_SCROLL_PX) y = -1;
  }
  if (!x && !y) return;
  const {
    forward,
    right
  } = cameraBasisOnGround();
  const v = new THREE.Vector3().addScaledVector(right, x).addScaledVector(forward, y);
  if (v.lengthSq()) v.normalize();
  state.cameraFocus.addScaledVector(v, state.CAMERA_PAN_SPEED * state.cameraSettings.zoom * dt);
  clampFocus();
}

