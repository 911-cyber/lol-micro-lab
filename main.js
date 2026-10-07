import * as THREE from 'three';

const game = document.querySelector('#game');
const cameraStateEl = document.querySelector('#cameraState');
const zoomStateEl = document.querySelector('#zoomState');

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

// Camera calibration rationale:
// - Summoner's Rift uses a fixed angled perspective camera.
// - Public tooling that reconstructs the Rift uses ~56° as the default camera angle.
// - Riot described the modern Rift camera as a narrower FOV moved farther from the ground
//   to reduce edge distortion while preserving roughly the same playable area.
const CAMERA_FOV = 35;
const CAMERA_PITCH_DEG = 56;
const CAMERA_DISTANCE = 30;
const CAMERA_PAN_SPEED = 18;
const EDGE_SCROLL_PX = 14;

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
grid.material.opacity = 0.25;
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
for (const [x, z, s] of [[-24,-13,1.5],[-19,14,1],[20,-12,1.3],[27,14,1.6],[0,-22,1.1],[7,20,1.2],[-31,4,1.2],[32,-2,1]]) {
  addRock(x, z, s);
}

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

const destination = new THREE.Mesh(
  new THREE.RingGeometry(0.26, 0.34, 36),
  new THREE.MeshBasicMaterial({ color: 0x6ec6ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
);
destination.rotation.x = -Math.PI / 2;
destination.position.y = 0.06;
destination.visible = false;
scene.add(destination);

// Zoom = 1 is the normal competitive/max-out view.
// The wheel can zoom in, but cannot zoom farther out than the baseline view.
const cameraSettings = {
  zoom: 1,
  minZoom: 0.66,
  maxZoom: 1,
  edgeScroll: true,
};

const cameraFocus = player.position.clone();
let cameraLocked = false;
let spaceHeld = false;
let middleDragging = false;
let lastMiddle = new THREE.Vector2();
let pointerPx = new THREE.Vector2(innerWidth / 2, innerHeight / 2);
let pointerInside = true;
let moveTarget = player.position.clone();
let moving = false;
let lastTime = performance.now();

function clampFocus() {
  cameraFocus.x = THREE.MathUtils.clamp(cameraFocus.x, -34, 34);
  cameraFocus.z = THREE.MathUtils.clamp(cameraFocus.z, -25, 25);
}

function getCameraOffset() {
  const pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);
  const distance = CAMERA_DISTANCE * cameraSettings.zoom;
  const horizontal = Math.cos(pitch) * distance;
  const vertical = Math.sin(pitch) * distance;
  return new THREE.Vector3(0, vertical, horizontal);
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

function setMoveTarget(clientX, clientY) {
  const hit = screenToGround(clientX, clientY);
  if (!hit) return;
  hit.x = THREE.MathUtils.clamp(hit.x, -42, 42);
  hit.z = THREE.MathUtils.clamp(hit.z, -32, 32);
  moveTarget.copy(hit);
  moving = true;
  destination.position.set(hit.x, 0.06, hit.z);
  destination.visible = true;
}

function updatePlayer(dt) {
  if (!moving) return;
  const delta = new THREE.Vector3().subVectors(moveTarget, player.position);
  delta.y = 0;
  const dist = delta.length();
  if (dist < 0.08) {
    moving = false;
    destination.visible = false;
    return;
  }

  const speed = 7.2;
  const step = Math.min(dist, speed * dt);
  delta.normalize();
  player.position.addScaledVector(delta, step);
  player.lookAt(player.position.x + delta.x, player.position.y, player.position.z + delta.z);
}

function updateCameraMotion(dt) {
  // League-like behavior: locked camera and held Space track the champion directly,
  // without the floating/smoothed follow that made the previous build feel off.
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
  const velocity = new THREE.Vector3();
  velocity.addScaledVector(right, x);
  velocity.addScaledVector(forward, y);
  if (velocity.lengthSq() > 0) velocity.normalize();

  cameraFocus.addScaledVector(velocity, CAMERA_PAN_SPEED * cameraSettings.zoom * dt);
  clampFocus();
}

function updateHud() {
  cameraStateEl.textContent = cameraLocked ? 'LOCKED' : (spaceHeld ? 'CENTERED' : 'UNLOCKED');
  cameraStateEl.className = cameraLocked ? 'locked' : '';
  zoomStateEl.textContent = cameraSettings.zoom >= 0.995 ? 'MAX' : `${Math.round(cameraSettings.zoom * 100)}%`;
}

renderer.domElement.addEventListener('contextmenu', e => {
  e.preventDefault();
  setMoveTarget(e.clientX, e.clientY);
});

renderer.domElement.addEventListener('pointermove', e => {
  pointerPx.set(e.clientX, e.clientY);
  pointerInside = true;

  if (middleDragging) {
    const dx = e.clientX - lastMiddle.x;
    const dy = e.clientY - lastMiddle.y;
    lastMiddle.set(e.clientX, e.clientY);

    const { forward, right } = cameraBasisOnGround();
    const worldPerPixel = CAMERA_DISTANCE * cameraSettings.zoom / 1100;

    // Grip-world style drag: move the mouse as if physically pulling the map.
    cameraFocus.addScaledVector(right, -dx * worldPerPixel);
    cameraFocus.addScaledVector(forward, dy * worldPerPixel);
    clampFocus();
  }
});

renderer.domElement.addEventListener('pointerenter', () => { pointerInside = true; });
renderer.domElement.addEventListener('pointerleave', () => { pointerInside = false; });

renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button === 1) {
    e.preventDefault();
    middleDragging = true;
    lastMiddle.set(e.clientX, e.clientY);
    renderer.domElement.style.cursor = 'grabbing';
  }
});

renderer.domElement.addEventListener('auxclick', e => {
  if (e.button === 1) e.preventDefault();
});

function endMiddleDrag() {
  middleDragging = false;
  renderer.domElement.style.cursor = '';
}
window.addEventListener('pointerup', e => { if (e.button === 1) endMiddleDrag(); });
window.addEventListener('pointercancel', endMiddleDrag);
window.addEventListener('blur', endMiddleDrag);

renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 1.10 : 0.90;
  cameraSettings.zoom = THREE.MathUtils.clamp(
    cameraSettings.zoom * factor,
    cameraSettings.minZoom,
    cameraSettings.maxZoom
  );
  updateHud();
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
