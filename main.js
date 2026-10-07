import * as THREE from 'three';

const game = document.querySelector('#game');
const cameraStateEl = document.querySelector('#cameraState');
const zoomStateEl = document.querySelector('#zoomState');
const edgeStateEl = document.querySelector('#edgeState');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08131b);
scene.fog = new THREE.FogExp2(0x08131b, 0.011);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
game.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 200);
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointerNdc = new THREE.Vector2();

scene.add(new THREE.HemisphereLight(0xbfdcff, 0x10200d, 2.4));
const sun = new THREE.DirectionalLight(0xfff2d2, 2.8);
sun.position.set(-18, 28, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), new THREE.MeshStandardMaterial({ color: 0x173025, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const lane = new THREE.Mesh(new THREE.PlaneGeometry(76, 8), new THREE.MeshStandardMaterial({ color: 0x34423a, roughness: 1 }));
lane.rotation.x = -Math.PI / 2;
lane.rotation.z = -0.22;
lane.position.y = 0.015;
scene.add(lane);

const river = new THREE.Mesh(new THREE.PlaneGeometry(13, 76), new THREE.MeshStandardMaterial({ color: 0x183b4f, roughness: .8 }));
river.rotation.x = -Math.PI / 2;
river.rotation.z = .48;
river.position.y = 0.02;
scene.add(river);

const grid = new THREE.GridHelper(90, 45, 0x315442, 0x213b30);
grid.position.y = 0.035;
grid.material.opacity = .25;
grid.material.transparent = true;
scene.add(grid);

function addRock(x, z, s = 1) {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1 * s, 0), new THREE.MeshStandardMaterial({ color: 0x465448, roughness: 1 }));
  rock.position.set(x, .65 * s, z);
  rock.scale.y = .65;
  rock.rotation.set(.2, x * .07, .1);
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);
}
for (const [x,z,s] of [[-24,-13,1.5],[-19,14,1],[20,-12,1.3],[27,14,1.6],[0,-22,1.1],[7,20,1.2],[-31,4,1.2],[32,-2,1]]) addRock(x,z,s);

function makeChampion(color = 0x4c91ff) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.58, .9, 7, 12), new THREE.MeshStandardMaterial({ color, roughness: .5 }));
  body.position.y = .78;
  body.castShadow = true;
  group.add(body);

  const shoulder = new THREE.Mesh(new THREE.ConeGeometry(.8, .45, 8), new THREE.MeshStandardMaterial({ color: 0x223b70, roughness: .55 }));
  shoulder.position.y = 1.28;
  shoulder.rotation.x = Math.PI;
  group.add(shoulder);

  const ring = new THREE.Mesh(new THREE.RingGeometry(.72, .82, 48), new THREE.MeshBasicMaterial({ color: 0x78b6ff, transparent: true, opacity: .75, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .045;
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

const destination = new THREE.Mesh(new THREE.RingGeometry(.26, .34, 36), new THREE.MeshBasicMaterial({ color: 0x6ec6ff, transparent: true, opacity: .9, side: THREE.DoubleSide }));
destination.rotation.x = -Math.PI / 2;
destination.position.y = .06;
destination.visible = false;
scene.add(destination);

const settings = { fov: 46, pitch: 55, distance: 22, panSpeed: 14, edgeSize: 18, edgeScroll: true, zoom: 1, minZoom: .78, maxZoom: 1.28 };

const cameraFocus = new THREE.Vector3(0, 0, 0);
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

function cameraOffset() {
  const pitch = THREE.MathUtils.degToRad(settings.pitch);
  const d = settings.distance * settings.zoom;
  const horizontal = Math.cos(pitch) * d;
  const vertical = Math.sin(pitch) * d;
  return new THREE.Vector3(0, vertical, horizontal);
}

function updateCamera() {
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
  camera.position.copy(cameraFocus).add(cameraOffset());
  camera.lookAt(cameraFocus.x, cameraFocus.y, cameraFocus.z - .8);
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
  destination.position.set(hit.x, .06, hit.z);
  destination.visible = true;
}

function updatePlayer(dt) {
  if (!moving) return;
  const delta = new THREE.Vector3().subVectors(moveTarget, player.position);
  delta.y = 0;
  const dist = delta.length();
  if (dist < .08) {
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
  if (cameraLocked || spaceHeld) {
    const target = player.position.clone();
    cameraFocus.lerp(target, 1 - Math.pow(.0005, dt));
    clampFocus();
    return;
  }
  if (!settings.edgeScroll || middleDragging || !pointerInside) return;

  let x = 0, y = 0;
  if (pointerPx.x <= settings.edgeSize) x = -1;
  else if (pointerPx.x >= innerWidth - settings.edgeSize) x = 1;
  if (pointerPx.y <= settings.edgeSize) y = 1;
  else if (pointerPx.y >= innerHeight - settings.edgeSize) y = -1;
  if (!x && !y) return;

  const { forward, right } = cameraBasisOnGround();
  const velocity = new THREE.Vector3();
  velocity.addScaledVector(right, x);
  velocity.addScaledVector(forward, y);
  if (velocity.lengthSq() > 0) velocity.normalize();
  cameraFocus.addScaledVector(velocity, settings.panSpeed * settings.zoom * dt);
  clampFocus();
}

function updateHud() {
  cameraStateEl.textContent = cameraLocked ? 'LOCKED' : (spaceHeld ? 'CENTERING' : 'UNLOCKED');
  cameraStateEl.className = cameraLocked ? 'locked' : '';
  zoomStateEl.textContent = `${Math.round(100 / settings.zoom)}%`;
  edgeStateEl.textContent = settings.edgeScroll ? 'ON' : 'OFF';
  edgeStateEl.className = settings.edgeScroll ? 'on' : '';
}

renderer.domElement.addEventListener('contextmenu', e => { e.preventDefault(); setMoveTarget(e.clientX, e.clientY); });
renderer.domElement.addEventListener('pointermove', e => {
  pointerPx.set(e.clientX, e.clientY);
  pointerInside = true;
  if (middleDragging) {
    const dx = e.clientX - lastMiddle.x;
    const dy = e.clientY - lastMiddle.y;
    lastMiddle.set(e.clientX, e.clientY);
    const { forward, right } = cameraBasisOnGround();
    const worldPerPixel = settings.distance * settings.zoom / 900;
    cameraFocus.addScaledVector(right, -dx * worldPerPixel);
    cameraFocus.addScaledVector(forward, dy * worldPerPixel);
    clampFocus();
  }
});
renderer.domElement.addEventListener('pointerenter', () => pointerInside = true);
renderer.domElement.addEventListener('pointerleave', () => pointerInside = false);
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button === 1) {
    e.preventDefault();
    middleDragging = true;
    lastMiddle.set(e.clientX, e.clientY);
    renderer.domElement.style.cursor = 'grabbing';
  }
});
window.addEventListener('pointerup', e => {
  if (e.button === 1) {
    middleDragging = false;
    renderer.domElement.style.cursor = '';
  }
});
renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 1.06 : 0.94;
  settings.zoom = THREE.MathUtils.clamp(settings.zoom * factor, settings.minZoom, settings.maxZoom);
  updateHud();
}, { passive: false });

window.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); spaceHeld = true; }
  if (e.code === 'KeyY' && !e.repeat) cameraLocked = !cameraLocked;
  updateHud();
});
window.addEventListener('keyup', e => { if (e.code === 'Space') spaceHeld = false; updateHud(); });

const controls = { fov: document.querySelector('#fov'), pitch: document.querySelector('#pitch'), distance: document.querySelector('#distance'), pan: document.querySelector('#pan'), edge: document.querySelector('#edge') };
function bindRange(el, out, key, format = v => v) {
  const output = document.querySelector(out);
  const sync = () => { settings[key] = Number(el.value); output.value = format(el.value); };
  el.addEventListener('input', sync); sync();
}
bindRange(controls.fov, '#fovOut', 'fov');
bindRange(controls.pitch, '#pitchOut', 'pitch', v => `${v}°`);
bindRange(controls.distance, '#distanceOut', 'distance', v => Number(v).toFixed(1));
bindRange(controls.pan, '#panOut', 'panSpeed');
bindRange(controls.edge, '#edgeOut', 'edgeSize', v => `${v}px`);

document.querySelector('#edgeToggle').addEventListener('click', e => {
  settings.edgeScroll = !settings.edgeScroll;
  e.currentTarget.textContent = `Edge Scroll: ${settings.edgeScroll ? 'ON' : 'OFF'}`;
  updateHud();
});
document.querySelector('#resetCamera').addEventListener('click', () => {
  cameraLocked = false; spaceHeld = false; settings.zoom = 1;
  cameraFocus.set(player.position.x, 0, player.position.z);
  updateHud();
});
document.querySelector('#togglePanel').addEventListener('click', e => {
  const body = document.querySelector('#tuningBody');
  body.classList.toggle('hidden');
  e.currentTarget.textContent = body.classList.contains('hidden') ? '+' : '−';
});

function animate(now) {
  const dt = Math.min(.05, (now - lastTime) / 1000 || 0);
  lastTime = now;
  updatePlayer(dt);
  updateCameraMotion(dt);
  updateCamera();
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

cameraFocus.copy(player.position);
updateCamera();
updateHud();
requestAnimationFrame(animate);
