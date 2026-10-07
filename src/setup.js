import * as THREE from 'three';
import { state } from './state.js';
import { createEnemy } from './entities.js';
import { addRock, makeChampion } from './scene.js';
export function initializeGame() {
  state.$ = s => document.querySelector(s);
  state.game = state.$('#game');
  state.modeStateEl = state.$('#modeState');
  state.orderStateEl = state.$('#orderState');
  state.hitsStateEl = state.$('#hitsState');
  state.cancelStateEl = state.$('#cancelState');
  state.kiteStateEl = state.$('#kiteState');
  state.dodgeStateEl = state.$('#dodgeState');
  state.csStateEl = state.$('#csState');
  state.scoreStateEl = state.$('#scoreState');
  state.enemyHpFill = state.$('#enemyHpFill');
  state.enemyHpText = state.$('#enemyHpText');
  state.targetNameEl = state.$('#targetName');
  state.playerHpFill = state.$('#playerHpFill');
  state.playerHpText = state.$('#playerHpText');
  state.modeBanner = state.$('#modeBanner');
  state.objectiveBanner = state.$('#objectiveBanner');
  state.toastEl = state.$('#toast');
  state.difficultyStateEl = state.$('#difficultyState');
  state.resultPanel = state.$('#resultPanel');
  state.resultGradeEl = state.$('#resultGrade');
  state.resultTitleEl = state.$('#resultTitle');
  state.resultScoreEl = state.$('#resultScore');
  state.resultStatsEl = state.$('#resultStats');
  state.resultDiagnosisEl = state.$('#resultDiagnosis');
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x08131b);
  state.scene.fog = new THREE.FogExp2(0x08131b, 0.011);
  state.renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'
  });
  state.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  state.renderer.setSize(innerWidth, innerHeight);
  state.renderer.shadowMap.enabled = true;
  state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  state.renderer.outputColorSpace = THREE.SRGBColorSpace;
  state.game.appendChild(state.renderer.domElement);
  state.CAMERA_FOV = 35;
  state.CAMERA_PITCH_DEG = 56;
  state.CAMERA_DISTANCE = 30;
  state.CAMERA_PAN_SPEED = 18;
  state.EDGE_SCROLL_PX = 14;
  state.WORLD_UNITS_PER_LOL_UNIT = 0.01;
  state.MOVE_SPEED = 335 * state.WORLD_UNITS_PER_LOL_UNIT;
  state.HOLD_MOVE_INTERVAL_MS = 70;
  state.ATTACK_RANGE = 550 * state.WORLD_UNITS_PER_LOL_UNIT;
  state.ATTACK_SPEED = 0.75;
  state.ATTACK_INTERVAL = 1 / state.ATTACK_SPEED;
  state.WINDUP_TIME = state.ATTACK_INTERVAL * 0.22;
  state.PROJECTILE_SPEED = 18;
  state.ATTACK_DAMAGE = 70;
  state.PLAYER_RADIUS = 0.72;
  state.MODE = Object.freeze({
    FREE: 'FREE',
    KITE: 'KITE',
    TARGET: 'TARGET',
    SPACING: 'SPACING',
    DODGE: 'DODGE',
    CS: 'CS',
    COMBINED: 'COMBINED',
    LANE: 'LANE'
  });
  state.mode = state.MODE.FREE;
  state.DIFFICULTIES = [{
    name: 'EASY',
    kiteSpeed: 2.10,
    kiteDamage: 6,
    targetMotion: .78,
    spacingSpeed: 1.55,
    spacingDamage: 4,
    dodgeSpeed: 7.2,
    dodgeSpawn: .96,
    csDrain: .82
  }, {
    name: 'NORMAL',
    kiteSpeed: 2.45,
    kiteDamage: 8,
    targetMotion: 1.00,
    spacingSpeed: 1.85,
    spacingDamage: 6,
    dodgeSpeed: 8.5,
    dodgeSpawn: .82,
    csDrain: 1.00
  }, {
    name: 'HARD',
    kiteSpeed: 2.85,
    kiteDamage: 10,
    targetMotion: 1.28,
    spacingSpeed: 2.18,
    spacingDamage: 8,
    dodgeSpeed: 10.2,
    dodgeSpawn: .66,
    csDrain: 1.18
  }];
  state.difficultyIndex = 1;
  state.difficulty = () => state.DIFFICULTIES[state.difficultyIndex];
  state.camera = new THREE.PerspectiveCamera(state.CAMERA_FOV, innerWidth / innerHeight, 0.1, 220);
  state.raycaster = new THREE.Raycaster();
  state.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  state.pointerNdc = new THREE.Vector2();
  state.scene.add(new THREE.HemisphereLight(0xbfdcff, 0x10200d, 2.4));
  state.sun = new THREE.DirectionalLight(0xfff2d2, 2.8);
  state.sun.position.set(-18, 28, 8);
  state.sun.castShadow = true;
  state.sun.shadow.mapSize.set(2048, 2048);
  state.sun.shadow.camera.left = -40;
  state.sun.shadow.camera.right = 40;
  state.sun.shadow.camera.top = 40;
  state.sun.shadow.camera.bottom = -40;
  state.scene.add(state.sun);
  state.ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), new THREE.MeshStandardMaterial({
    color: 0x173025,
    roughness: 1
  }));
  state.ground.rotation.x = -Math.PI / 2;
  state.ground.receiveShadow = true;
  state.scene.add(state.ground);
  state.lane = new THREE.Mesh(new THREE.PlaneGeometry(76, 8), new THREE.MeshStandardMaterial({
    color: 0x34423a,
    roughness: 1
  }));
  state.lane.rotation.x = -Math.PI / 2;
  state.lane.rotation.z = -0.22;
  state.lane.position.y = 0.015;
  state.scene.add(state.lane);
  state.river = new THREE.Mesh(new THREE.PlaneGeometry(13, 76), new THREE.MeshStandardMaterial({
    color: 0x183b4f,
    roughness: .8
  }));
  state.river.rotation.x = -Math.PI / 2;
  state.river.rotation.z = .48;
  state.river.position.y = .02;
  state.scene.add(state.river);
  state.grid = new THREE.GridHelper(90, 45, 0x315442, 0x213b30);
  state.grid.position.y = .035;
  state.grid.material.opacity = .18;
  state.grid.material.transparent = true;
  state.scene.add(state.grid);
  for (const [x, z, s] of [[-24, -13, 1.5], [-19, 14, 1], [20, -12, 1.3], [27, 14, 1.6], [0, -22, 1.1], [7, 20, 1.2], [-31, 4, 1.2], [32, -2, 1]]) addRock(x, z, s);
  state.player = makeChampion();
  state.player.position.set(-4, 0, 2);
  state.scene.add(state.player);
  state.enemyColors = [0xd95762, 0xe28b50, 0x9e62df, 0xd95762, 0x8a5a4b, 0x8a5a4b, 0x8a5a4b];
  state.enemies = [];
  state.alliedMinions = [];
  state.minionProjectiles = [];
  state.mainDummy = createEnemy('TRAINING DUMMY', 8, -2, state.enemyColors[0], 700, .76, 'dummy');
  state.activeTarget = state.mainDummy;
  state.markerMaterial = new THREE.MeshBasicMaterial({
    color: 0x55e36f,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  state.orderMarker = new THREE.Mesh(new THREE.RingGeometry(.25, .39, 40), state.markerMaterial);
  state.orderMarker.rotation.x = -Math.PI / 2;
  state.orderMarker.position.y = .065;
  state.orderMarker.visible = false;
  state.scene.add(state.orderMarker);
  state.markerLife = 0;
  state.rangeRing = new THREE.Mesh(new THREE.RingGeometry(state.ATTACK_RANGE + state.PLAYER_RADIUS - .035, state.ATTACK_RANGE + state.PLAYER_RADIUS + .035, 128), new THREE.MeshBasicMaterial({
    color: 0xe3c56e,
    transparent: true,
    opacity: .72,
    side: THREE.DoubleSide,
    depthWrite: false
  }));
  state.rangeRing.rotation.x = -Math.PI / 2;
  state.rangeRing.position.y = .05;
  state.rangeRing.visible = false;
  state.scene.add(state.rangeRing);
  state.dangerRing = new THREE.Mesh(new THREE.RingGeometry(4.0, 4.06, 128), new THREE.MeshBasicMaterial({
    color: 0xff5966,
    transparent: true,
    opacity: .55,
    side: THREE.DoubleSide,
    depthWrite: false
  }));
  state.dangerRing.rotation.x = -Math.PI / 2;
  state.dangerRing.position.y = .052;
  state.dangerRing.visible = false;
  state.scene.add(state.dangerRing);
  state.targetRing = new THREE.Mesh(new THREE.RingGeometry(.92, 1.04, 56), new THREE.MeshBasicMaterial({
    color: 0xff5966,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false
  }));
  state.targetRing.rotation.x = -Math.PI / 2;
  state.targetRing.position.y = .055;
  state.targetRing.visible = false;
  state.scene.add(state.targetRing);
  state.targetFlash = 0;
  state.projectiles = [];
  state.projectileGeom = new THREE.SphereGeometry(.13, 10, 8);
  state.projectileMat = new THREE.MeshBasicMaterial({
    color: 0xffe091
  });
  state.allyMinionProjectileMat = new THREE.MeshBasicMaterial({
    color: 0x79bfff
  });
  state.enemyMinionProjectileMat = new THREE.MeshBasicMaterial({
    color: 0xff737d
  });
  state.skillshots = [];
  state.laneData = null;
  state.laneMetrics = { fired: 0, hit: 0, dodged: 0, damage: 0 };
  state.skillGeom = new THREE.SphereGeometry(.22, 10, 8);
  state.skillMat = new THREE.MeshBasicMaterial({
    color: 0x79d8ff
  });
  state.cameraSettings = {
    zoom: 1,
    minZoom: .66,
    maxZoom: 1,
    edgeScroll: true
  };
  state.cameraFocus = state.player.position.clone();
  state.cameraLocked = false;
  state.spaceHeld = false;
  state.middleDragging = false;
  state.rightMouseHeld = false;
  state.lastMiddle = new THREE.Vector2();
  state.pointerPx = new THREE.Vector2(innerWidth / 2, innerHeight / 2);
  state.pointerInside = true;
  state.lastMoveIssueMs = -Infinity;
  state.lastTime = performance.now();
  state.order = {
    type: 'idle',
    point: state.player.position.clone(),
    target: null
  };
  state.attackMoveArmed = false;
  state.attackState = 'idle';
  state.attackTarget = null;
  state.windupEnd = 0;
  state.nextAttackReady = 0;
  state.lastShotAt = -Infinity;
  state.awaitingKiteMove = false;
  state.playerHp = 100;
  state.playerMaxHp = 100;
  state.hits = 0;
  state.cancels = 0;
  state.cleanKites = 0;
  state.dodges = 0;
  state.cs = 0;
  state.missedCs = 0;
  state.score = 0;
  state.toastUntil = 0;
  state.targetSwitches = 0;
  state.skillshotsFired = 0;
  state.skillshotsHit = 0;
  state.sessionDuration = 0;
  state.lastSelectedTarget = null;
  state.modeData = {
    time: 0,
    nextSpawn: 0,
    nextEnemyAttack: 0,
    spacingGoodTime: 0,
    spacingDangerTime: 0,
    wave: 0
  };
}
