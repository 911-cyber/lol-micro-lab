import * as THREE from 'three';

const game = document.querySelector('#game');
const cameraStateEl = document.querySelector('#cameraState');
const moveStateEl = document.querySelector('#moveState');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08131b);
scene.fog = new THREE.FogExp2(0x08131b, 0.011);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.setAttribute('aria-label', 'LoL Micro Lab game view');
game.appendChild(renderer.domElement);

// Camera v1.0 — fixed from the previous pass.
const CAMERA_FOV = 35;
const CAMERA_PITCH_DEG = 56;
const CAMERA_DISTANCE = 30;
const CAMERA_PAN_SPEED = 18;
const EDGE_SCROLL_PX = 14;

// Movement scale: 1 LoL movement-speed point = 1 game unit / second.
// In this trainer, 100 LoL units = 1 Three.js world unit.
const LOL_MOVE_SPEED = 335;
const WORLD_UNITS_PER_LOL_UNIT = 0.01;
const MOVE_SPEED = LOL_MOVE_SPEED * WORLD_UNITS_PER_LOL_UNIT;
const HOLD_MOVE_INTERVAL_MS = 70;

const camera = new THREE.PerspectiveCamera(CAMERA_FOV, innerWidth / innerHeight, 0.1, 220);
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointerNdc = new THREE.Vector2();

scene.add(new THREE.HemisphereLight(0xbfdcff, 0x10200d, 2.4));
const sun = new THREE.DirectionalLight(0xfff2d2, 2.8);
sun.position.set(-18, 28, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 70),
  new THREE.MeshStandardMaterial({ color: 0x173025, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const lane = new THREE.Mesh(
  new THREE.PlaneGeometry(76, 8),
  new THREE.MeshStandardMaterial({ color: 0x34423a, roughness: 1 })
);
lane.rotation.x = -Math.PI / 2;
lane.rotation.z = -0.22;
lane.position.y = 0.015;
scene.add(lane);

const river = new THREE.Mesh(
  new THREE.PlaneGeometry(13, 76),
  new THREE.MeshStandardMaterial({ color: 0x183b4f, roughness: 0.8 })
);
river.rotation.x = -Math.PI / 2;
river.rotation.z = 0.48;
river.position.y = 0.02;
scene.add(river);

const grid = new THREE.GridHelper(90, 45, 0x315442, 0x213b30);
grid.position.y = 0.035;
grid.material.opacity = 0.22;
grid.material.transparent = true;
scene.add(grid);

function addRock(x, z, s = 1) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.1 * s, 0),
    new THREE.MeshStandardMaterial({ color: 0x465448, roughness: 1 })
  );
  rock.position.set(x, 0.65 * s, z);
  rock.scale.y = 0.65;
  rock.rotation.set(0.2, x * 0.07, 0.1);
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);
}
for (const [x, z, s] of [[-24,-13,1.5],[-19,14,1],[20,-12,1.3],[27,14,1.6],[0,-22,1.1],[7,20,1.2],[-31,4,1.2],[32,-2,1]]) addRock(x, z, s);

function makeChampion(color = 0x4c91ff) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.58, 0.9, 7, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
  );
  body.position.y = 0.78;
  body.castShadow = true;
  group.add(body);

  const shoulder = new THREE.Mesh(
    new THREE.ConeGeometry(0.8, 0.45, 8),
    new THREE.MeshStandardMaterial({ color: 0x223b70, roughness: 0.55 })
  );
  shoulder.position.y = 1.28;
  shoulder.rotation.x = Math.PI;
  group.add(shoulder);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 0.82, 48),
    new THREE.MeshBasicMaterial({ color: 0x78b6ff, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.045;
  group.add(ring);
  return group;
}

const player = makeChampion();
player.position.set(-4, 0, 2);
scene.add(player);

const dummy = makeChampion(0xd95762);
dummy.position.set(9, 0, -3);
dummy.scale.setScalar(1.05);
scene.add(dummy);

// Short-lived green move indicator, similar to LoL's Move Click feedback.
const markerMaterial = new THREE.MeshBasicMaterial({
  color: 0x55e36f,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const moveMarker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.39, 40), markerMaterial);
moveMarker.rotation.x = -Math.PI / 2;
moveMarker.position.y = 0.065;
moveMarker.visible = false;
scene.add(moveMarker);
let markerLife = 0;

const cameraSettings = { zoom: 1, minZoom: 0.66, maxZoom: 1, edgeScroll: true };
const cameraFocus = player.position.clone();
let cameraLocked = false;
let spaceHeld = false;
let middleDragging = false;
let rightMouseHeld = false;
let lastMiddle = new THREE.Vector2();
let pointerPx = new THREE.Vector2(innerWidth / 2, innerHeight / 2);
let pointerInside = true;
let moveTarget = player.position.clone();
let moving = false;
let lastMoveIssueMs = -Infinity;
let lastTime = performance.now();

function clampFocus() {
  cameraFocus.x = THREE.MathUtils.clamp(cameraFocus.x, -34, 34);
  cameraFocus.z = THREE.MathUtils.clamp(cameraFocus.z, -25, 25);
}

function getCameraOffset() {
  const pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);
  const distance = CAMERA_DISTANCE * cameraSettings.zoom;
  return new THREE.Vector3(0, Math.sin(pitch) * distance, Math.cos(pitch) * distance);
}

function updateCameraTransform() {
  camera.position.copy(cameraFocus).add(getCameraOffset());
  camera.lookAt(cameraFocus);
}

function cameraBasisOnGround() {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  return { forward, right };
}

function screenToGround(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const hit = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, hit) ? hit : null;
}

function showMoveMarker(hit) {
  moveMarker.position.set(hit.x, 0.065, hit.z);
  moveMarker.scale.setScalar(0.82);
  markerMaterial.opacity = 0.92;
  moveMarker.visible = true;
  markerLife = 0.34;
}

function issueMoveCommand(clientX, clientY, showMarker = true) {
  const hit = screenToGround(clientX, clientY);
  if (!hit) return;
  hit.x = THREE.MathUtils.clamp(hit.x, -42, 42);
  hit.z = THREE.MathUtils.clamp(hit.z, -32, 32);
  moveTarget.copy(hit);
  moving = player.position.distanceToSquared(moveTarget) > 0.0064;
  if (showMarker) showMoveMarker(hit);
}

function stopCommand() {
  moving = false;
  moveTarget.copy(player.position);
  moveMarker.visible = false;
  markerLife = 0;
}

function updatePlayer(dt) {
  if (!moving) return;

  const direction = new THREE.Vector3().subVectors(moveTarget, player.position);
  direction.y = 0;
  const distance = direction.length();
  if (distance <= 0.06) {
    moving = false;
    return;
  }

  direction.normalize();
  const step = Math.min(distance, MOVE_SPEED * dt);
  player.position.addScaledVector(direction, step);

  // League has no slow character-turn animation before a move order takes effect.
  player.lookAt(
    player.position.x + direction.x,
    player.position.y,
    player.position.z + direction.z
  );
}

function updateMoveMarker(dt) {
  if (!moveMarker.visible) return;
  markerLife -= dt;
  if (markerLife <= 0) {
    moveMarker.visible = false;
    return;
  }
  const t = 1 - markerLife / 0.34;
  markerMaterial.opacity = 0.92 * (1 - t);
  moveMarker.scale.setScalar(0.82 + t * 0.55);
}

function updateCameraMotion(dt) {
  if (cameraLocked || spaceHeld) {
    cameraFocus.copy(player.position);
    clampFocus();
    return;
  }
  if (!cameraSettings.edgeScroll || middleDragging || !pointerInside) return;

  let x = 0;
  let y = 0;
  if (pointerPx.x <= EDGE_SCROLL_PX) x = -1;
  else if (pointerPx.x >= innerWidth - EDGE_SCROLL_PX) x = 1;
  if (pointerPx.y <= EDGE_SCROLL_PX) y = 1;
  else if (pointerPx.y >= innerHeight - EDGE_SCROLL_PX) y = -1;
  if (!x && !y) return;

  const { forward, right } = cameraBasisOnGround();
  const velocity = new THREE.Vector3()
    .addScaledVector(right, x)
    .addScaledVector(forward, y);
  if (velocity.lengthSq() > 0) velocity.normalize();
  cameraFocus.addScaledVector(velocity, CAMERA_PAN_SPEED * cameraSettings.zoom * dt);
  clampFocus();
}

function updateHud() {
  cameraStateEl.textContent = cameraLocked ? 'LOCKED' : (spaceHeld ? 'CENTERED' : 'UNLOCKED');
  cameraStateEl.className = cameraLocked ? 'locked' : '';
  moveStateEl.textContent = moving ? 'MOVING' : 'IDLE';
  moveStateEl.className = moving ? 'moving' : '';
}

renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

renderer.domElement.addEventListener('pointerdown', e => {
  pointerPx.set(e.clientX, e.clientY);

  if (e.button === 2) {
    e.preventDefault();
    rightMouseHeld = true;
    lastMoveIssueMs = performance.now();
    issueMoveCommand(e.clientX, e.clientY, true);
  }

  if (e.button === 1) {
    e.preventDefault();
    middleDragging = true;
    lastMiddle.set(e.clientX, e.clientY);
    renderer.domElement.style.cursor = 'grabbing';
  }
});

renderer.domElement.addEventListener('pointermove', e => {
  pointerPx.set(e.clientX, e.clientY);
  pointerInside = true;

  if (rightMouseHeld && performance.now() - lastMoveIssueMs >= HOLD_MOVE_INTERVAL_MS) {
    lastMoveIssueMs = performance.now();
    issueMoveCommand(e.clientX, e.clientY, false);
  }

  if (middleDragging) {
    const dx = e.clientX - lastMiddle.x;
    const dy = e.clientY - lastMiddle.y;
    lastMiddle.set(e.clientX, e.clientY);
    const { forward, right } = cameraBasisOnGround();
    const worldPerPixel = CAMERA_DISTANCE * cameraSettings.zoom / 1100;
    cameraFocus.addScaledVector(right, -dx * worldPerPixel);
    cameraFocus.addScaledVector(forward, dy * worldPerPixel);
    clampFocus();
  }
});

renderer.domElement.addEventListener('pointerenter', () => { pointerInside = true; });
renderer.domElement.addEventListener('pointerleave', () => { pointerInside = false; });
renderer.domElement.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });

function endPointerButton(button) {
  if (button === 2) rightMouseHeld = false;
  if (button === 1) {
    middleDragging = false;
    renderer.domElement.style.cursor = '';
  }
}
window.addEventListener('pointerup', e => endPointerButton(e.button));
window.addEventListener('pointercancel', () => { rightMouseHeld = false; middleDragging = false; renderer.domElement.style.cursor = ''; });
window.addEventListener('blur', () => { rightMouseHeld = false; middleDragging = false; renderer.domElement.style.cursor = ''; });

renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 1.10 : 0.90;
  cameraSettings.zoom = THREE.MathUtils.clamp(cameraSettings.zoom * factor, cameraSettings.minZoom, cameraSettings.maxZoom);
}, { passive: false });

window.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (!spaceHeld) cameraFocus.copy(player.position);
    spaceHeld = true;
  }

  if (e.code === 'KeyY' && !e.repeat) {
    cameraLocked = !cameraLocked;
    if (cameraLocked) cameraFocus.copy(player.position);
  }

  if (e.code === 'KeyS' && !e.repeat) {
    e.preventDefault();
    stopCommand();
  }

  updateHud();
});

window.addEventListener('keyup', e => {
  if (e.code === 'Space') spaceHeld = false;
  updateHud();
});

function animate(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
  lastTime = now;
  updatePlayer(dt);
  updateMoveMarker(dt);
  updateCameraMotion(dt);
  updateCameraTransform();
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

updateCameraTransform();
updateHud();
requestAnimationFrame(animate);
