import * as THREE from 'three';

const $ = s => document.querySelector(s);
const game = $('#game');
const cameraStateEl = $('#cameraState');
const orderStateEl = $('#orderState');
const hitsStateEl = $('#hitsState');
const cancelStateEl = $('#cancelState');
const kiteStateEl = $('#kiteState');
const dpsStateEl = $('#dpsState');
const scoreStateEl = $('#scoreState');
const enemyHpFill = $('#enemyHpFill');
const enemyHpText = $('#enemyHpText');
const playerHpFill = $('#playerHpFill');
const playerHpText = $('#playerHpText');
const modeBanner = $('#modeBanner');
const challengeBanner = $('#challengeBanner');
const toastEl = $('#toast');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08131b);
scene.fog = new THREE.FogExp2(0x08131b, 0.011);

const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
game.appendChild(renderer.domElement);

const CAMERA_FOV = 35;
const CAMERA_PITCH_DEG = 56;
const CAMERA_DISTANCE = 30;
const CAMERA_PAN_SPEED = 18;
const EDGE_SCROLL_PX = 14;

const LOL_MOVE_SPEED = 335;
const WORLD_UNITS_PER_LOL_UNIT = 0.01;
const MOVE_SPEED = LOL_MOVE_SPEED * WORLD_UNITS_PER_LOL_UNIT;
const HOLD_MOVE_INTERVAL_MS = 70;

const ATTACK_RANGE_LOL = 550;
const ATTACK_RANGE = ATTACK_RANGE_LOL * WORLD_UNITS_PER_LOL_UNIT;
const ATTACK_SPEED = 0.75;
const ATTACK_INTERVAL = 1 / ATTACK_SPEED;
const WINDUP_PERCENT = 0.22;
const WINDUP_TIME = ATTACK_INTERVAL * WINDUP_PERCENT;
const PROJECTILE_SPEED = 18;
const ATTACK_DAMAGE = 70;
const PLAYER_RADIUS = 0.72;
const DUMMY_RADIUS = 0.76;
const CENTER_ATTACK_DISTANCE = ATTACK_RANGE + PLAYER_RADIUS + DUMMY_RADIUS;

const camera = new THREE.PerspectiveCamera(CAMERA_FOV, innerWidth/innerHeight, 0.1, 220);
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
const pointerNdc = new THREE.Vector2();

scene.add(new THREE.HemisphereLight(0xbfdcff, 0x10200d, 2.4));
const sun = new THREE.DirectionalLight(0xfff2d2, 2.8);
sun.position.set(-18,28,8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-40; sun.shadow.camera.right=40; sun.shadow.camera.top=40; sun.shadow.camera.bottom=-40;
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(90,70), new THREE.MeshStandardMaterial({color:0x173025, roughness:1}));
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);

const lane = new THREE.Mesh(new THREE.PlaneGeometry(76,8), new THREE.MeshStandardMaterial({color:0x34423a, roughness:1}));
lane.rotation.x=-Math.PI/2; lane.rotation.z=-0.22; lane.position.y=0.015; scene.add(lane);

const river = new THREE.Mesh(new THREE.PlaneGeometry(13,76), new THREE.MeshStandardMaterial({color:0x183b4f, roughness:0.8}));
river.rotation.x=-Math.PI/2; river.rotation.z=0.48; river.position.y=0.02; scene.add(river);

const grid = new THREE.GridHelper(90,45,0x315442,0x213b30);
grid.position.y=0.035; grid.material.opacity=0.22; grid.material.transparent=true; scene.add(grid);

function addRock(x,z,s=1){
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1*s,0), new THREE.MeshStandardMaterial({color:0x465448,roughness:1}));
  rock.position.set(x,0.65*s,z);
  rock.scale.y=0.65;
  rock.rotation.set(0.2,x*0.07,0.1);
  rock.castShadow=true; rock.receiveShadow=true; scene.add(rock);
}
for(const [x,z,s] of [[-24,-13,1.5],[-19,14,1],[20,-12,1.3],[27,14,1.6],[0,-22,1.1],[7,20,1.2],[-31,4,1.2],[32,-2,1]]) addRock(x,z,s);

function makeChampion(color=0x4c91ff, shoulderColor=0x223b70){
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.58,0.9,7,12), new THREE.MeshStandardMaterial({color,roughness:0.5}));
  body.position.y=0.78; body.castShadow=true; group.add(body);
  const shoulder = new THREE.Mesh(new THREE.ConeGeometry(0.8,0.45,8), new THREE.MeshStandardMaterial({color:shoulderColor,roughness:0.55}));
  shoulder.position.y=1.28; shoulder.rotation.x=Math.PI; group.add(shoulder);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.72,0.82,48), new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.8,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.y=0.045; group.add(ring);
  return group;
}

const player = makeChampion();
player.position.set(-4,0,2); scene.add(player);

const dummy = makeChampion(0xd95762,0x69232b);
dummy.position.set(8,0,-2); dummy.scale.setScalar(1.05); scene.add(dummy);
const dummyHitbox = new THREE.Mesh(new THREE.SphereGeometry(1.25,16,12), new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
dummyHitbox.position.y=0.85; dummy.add(dummyHitbox);

const markerMaterial = new THREE.MeshBasicMaterial({color:0x55e36f, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide});
const orderMarker = new THREE.Mesh(new THREE.RingGeometry(0.25,0.39,40), markerMaterial);
orderMarker.rotation.x=-Math.PI/2; orderMarker.position.y=0.065; orderMarker.visible=false; scene.add(orderMarker);
let markerLife=0;

const rangeRing = new THREE.Mesh(new THREE.RingGeometry(ATTACK_RANGE+PLAYER_RADIUS-0.035, ATTACK_RANGE+PLAYER_RADIUS+0.035, 128), new THREE.MeshBasicMaterial({color:0xe3c56e,transparent:true,opacity:0.75,side:THREE.DoubleSide,depthWrite:false}));
rangeRing.rotation.x=-Math.PI/2; rangeRing.position.y=0.05; rangeRing.visible=false; scene.add(rangeRing);

const targetRing = new THREE.Mesh(new THREE.RingGeometry(0.92,1.04,56), new THREE.MeshBasicMaterial({color:0xff5966,transparent:true,opacity:0.0,side:THREE.DoubleSide,depthWrite:false}));
targetRing.rotation.x=-Math.PI/2; targetRing.position.y=0.055; scene.add(targetRing);
let targetFlash=0;

const projectiles=[];
const projectileGeom = new THREE.SphereGeometry(0.13,10,8);
const projectileMat = new THREE.MeshBasicMaterial({color:0xffe091});

const cameraSettings={zoom:1,minZoom:0.66,maxZoom:1,edgeScroll:true};
const cameraFocus=player.position.clone();
let cameraLocked=false, spaceHeld=false, middleDragging=false, rightMouseHeld=false;
let lastMiddle=new THREE.Vector2();
let pointerPx=new THREE.Vector2(innerWidth/2,innerHeight/2);
let pointerInside=true;
let lastMoveIssueMs=-Infinity;
let lastTime=performance.now();

let order={type:'idle',point:player.position.clone(),target:null};
let attackMoveArmed=false;
let attackState='idle';
let attackTarget=null;
let windupEnd=0;
let nextAttackReady=0;
let lastShotAt=-Infinity;
let awaitingKiteMove=false;

let enemyHp=700, enemyMaxHp=700, enemyAlive=true, enemyRespawnAt=0;
let playerHp=100, playerMaxHp=100;
let hits=0, cancels=0, cleanKites=0, totalDamage=0, firstDamageAt=0, score=0;
let toastUntil=0;

const challenge={active:false,time:30,maxTime:30,dummySpeed:2.65,dummyAttackRange:1.9,dummyAttackInterval:1.05,nextDummyAttack:0};

function clampFocus(){cameraFocus.x=THREE.MathUtils.clamp(cameraFocus.x,-34,34);cameraFocus.z=THREE.MathUtils.clamp(cameraFocus.z,-25,25);}
function getCameraOffset(){const pitch=THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);const d=CAMERA_DISTANCE*cameraSettings.zoom;return new THREE.Vector3(0,Math.sin(pitch)*d,Math.cos(pitch)*d);}
function updateCameraTransform(){camera.position.copy(cameraFocus).add(getCameraOffset());camera.lookAt(cameraFocus);}
function cameraBasisOnGround(){const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,camera.up).normalize();return {forward,right};}
function rayFromScreen(x,y){const r=renderer.domElement.getBoundingClientRect();pointerNdc.x=((x-r.left)/r.width)*2-1;pointerNdc.y=-((y-r.top)/r.height)*2+1;raycaster.setFromCamera(pointerNdc,camera);}
function screenToGround(x,y){rayFromScreen(x,y);const hit=new THREE.Vector3();return raycaster.ray.intersectPlane(groundPlane,hit)?hit:null;}
function pickEnemy(x,y){if(!enemyAlive)return null;rayFromScreen(x,y);return raycaster.intersectObject(dummy,true).length?dummy:null;}
function clampPoint(p){p.x=THREE.MathUtils.clamp(p.x,-42,42);p.z=THREE.MathUtils.clamp(p.z,-32,32);p.y=0;return p;}
function showMarker(point,color=0x55e36f){markerMaterial.color.setHex(color);orderMarker.position.set(point.x,0.065,point.z);orderMarker.scale.setScalar(0.82);markerMaterial.opacity=0.92;orderMarker.visible=true;markerLife=0.34;}
function flashTarget(){targetFlash=0.24;targetRing.position.set(dummy.position.x,0.055,dummy.position.z);targetRing.material.opacity=0.95;targetRing.visible=true;}
function toast(text,kind=''){toastEl.textContent=text;toastEl.className=`show ${kind}`.trim();toastUntil=performance.now()/1000+1.0;}
function edgeDistanceToDummy(){return Math.max(0,player.position.distanceTo(dummy.position)-PLAYER_RADIUS-DUMMY_RADIUS);}
function enemyInAttackRange(){return enemyAlive&&edgeDistanceToDummy()<=ATTACK_RANGE+0.001;}
function facePoint(p){player.lookAt(p.x,player.position.y,p.z);}

function cancelWindup(reason='move'){
  if(attackState!=='windup')return false;
  attackState='idle';attackTarget=null;nextAttackReady=performance.now()/1000;cancels++;score=Math.max(0,score-25);
  toast(reason==='stop'?'AA cancelled by Stop':'AA cancelled — moved before release','bad');
  return true;
}
function notePostShotMove(){const now=performance.now()/1000;if(awaitingKiteMove&&now-lastShotAt<=0.46){awaitingKiteMove=false;cleanKites++;score+=35;toast('Clean kite: shot → move','good');}}
function issueMovePoint(point,show=true){point=clampPoint(point.clone());cancelWindup('move');notePostShotMove();order={type:'move',point,target:null};if(show)showMarker(point,0x55e36f);}
function issueMoveFromScreen(x,y,show=true){const hit=screenToGround(x,y);if(hit)issueMovePoint(hit,show);}
function issueStop(){cancelWindup('stop');order={type:'idle',point:player.position.clone(),target:null};rightMouseHeld=false;}
function issueAttack(target=dummy){if(!enemyAlive)return;if(attackState==='windup'&&attackTarget!==target)cancelWindup('move');order={type:'attack',point:target.position.clone(),target};flashTarget();}
function chooseAttackMoveTarget(){if(!enemyAlive||!enemyInAttackRange())return null;return dummy;}
function issueAttackMove(point){point=clampPoint(point.clone());cancelWindup('move');notePostShotMove();const target=chooseAttackMoveTarget();order={type:'attackMove',point,target};showMarker(point,0xe06469);if(target)flashTarget();}

function moveToward(point,dt,stopDistance=0){const delta=new THREE.Vector3().subVectors(point,player.position);delta.y=0;const dist=delta.length();if(dist<=stopDistance+0.025)return true;delta.normalize();const step=Math.min(Math.max(0,dist-stopDistance),MOVE_SPEED*dt);player.position.addScaledVector(delta,step);facePoint(player.position.clone().add(delta));return dist-step<=stopDistance+0.025;}
function moveTowardTarget(target,dt){const delta=new THREE.Vector3().subVectors(target.position,player.position);delta.y=0;const centerDist=delta.length();if(centerDist<=CENTER_ATTACK_DISTANCE)return true;delta.normalize();const step=Math.min(centerDist-CENTER_ATTACK_DISTANCE,MOVE_SPEED*dt);player.position.addScaledVector(delta,Math.max(0,step));facePoint(target.position);return centerDist-step<=CENTER_ATTACK_DISTANCE+0.01;}

function startAttack(target,now){if(!enemyAlive||now<nextAttackReady||attackState==='windup'||!enemyInAttackRange())return false;attackState='windup';attackTarget=target;windupEnd=now+WINDUP_TIME;nextAttackReady=now+ATTACK_INTERVAL;facePoint(target.position);return true;}
function launchProjectile(target,now){attackState='idle';attackTarget=null;lastShotAt=now;awaitingKiteMove=true;const mesh=new THREE.Mesh(projectileGeom,projectileMat.clone());mesh.position.copy(player.position).add(new THREE.Vector3(0,1.05,0));scene.add(mesh);projectiles.push({mesh,target});}
function damageDummy(amount,now){if(!enemyAlive)return;enemyHp=Math.max(0,enemyHp-amount);hits++;totalDamage+=amount;score+=100;if(!firstDamageAt)firstDamageAt=now;if(enemyHp<=0){enemyAlive=false;dummy.visible=false;targetRing.visible=false;enemyRespawnAt=now+0.75;score+=400;order.type=order.type==='attackMove'?'attackMove':'idle';toast('Dummy down +400','good');}}
function updateProjectiles(dt,now){for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];if(!p.target||!enemyAlive){scene.remove(p.mesh);projectiles.splice(i,1);continue;}const aim=p.target.position.clone().add(new THREE.Vector3(0,0.9,0));const delta=aim.sub(p.mesh.position);const dist=delta.length();const step=PROJECTILE_SPEED*dt;if(dist<=step+0.18){scene.remove(p.mesh);projectiles.splice(i,1);damageDummy(ATTACK_DAMAGE,now);}else{delta.normalize();p.mesh.position.addScaledVector(delta,step);}}}
function respawnDummy(now){if(enemyAlive||now<enemyRespawnAt)return;enemyAlive=true;enemyHp=enemyMaxHp;dummy.visible=true;const angle=Math.random()*Math.PI*2;const d=challenge.active?9.0:10.5;dummy.position.set(THREE.MathUtils.clamp(player.position.x+Math.cos(angle)*d,-30,30),0,THREE.MathUtils.clamp(player.position.z+Math.sin(angle)*d,-22,22));}

function updateOrder(dt,now){
  if(attackState==='windup'){facePoint(dummy.position);if(now>=windupEnd&&enemyAlive)launchProjectile(dummy,now);return;}
  if(order.type==='idle')return;
  if(order.type==='move'){if(moveToward(order.point,dt,0))order.type='idle';return;}
  if(order.type==='attack'){if(!enemyAlive){order.type='idle';return;}if(enemyInAttackRange())startAttack(dummy,now);else moveTowardTarget(dummy,dt);return;}
  if(order.type==='attackMove'){if(enemyAlive&&enemyInAttackRange()){order.target=dummy;startAttack(dummy,now);}else{order.target=null;if(moveToward(order.point,dt,0))order.type='idle';}}
}

function updateDummyAI(dt,now){if(!challenge.active||!enemyAlive)return;const delta=new THREE.Vector3().subVectors(player.position,dummy.position);delta.y=0;const dist=delta.length();dummy.lookAt(player.position.x,dummy.position.y,player.position.z);if(dist>challenge.dummyAttackRange){delta.normalize();dummy.position.addScaledVector(delta,Math.min(challenge.dummySpeed*dt,dist-challenge.dummyAttackRange));}else if(now>=challenge.nextDummyAttack){challenge.nextDummyAttack=now+challenge.dummyAttackInterval;playerHp=Math.max(0,playerHp-8);score=Math.max(0,score-20);toast('Hit by dummy — create space','bad');if(playerHp<=0)endChallenge('DOWN');}}
function resetMetrics(){hits=0;cancels=0;cleanKites=0;totalDamage=0;firstDamageAt=0;score=0;}
function startChallenge(){resetMetrics();challenge.active=true;challenge.time=challenge.maxTime;challenge.nextDummyAttack=0;playerHp=playerMaxHp;enemyHp=enemyMaxHp;enemyAlive=true;dummy.visible=true;order={type:'idle',point:player.position.clone(),target:null};attackState='idle';nextAttackReady=0;awaitingKiteMove=false;player.position.set(-4,0,2);dummy.position.set(5,0,-1);cameraFocus.copy(player.position);toast('30s Kiting Challenge','good');}
function endChallenge(reason='TIME'){if(!challenge.active)return;challenge.active=false;issueStop();toast(`${reason} — Score ${score}`,'good');}
function toggleChallenge(){challenge.active?endChallenge('STOPPED'):startChallenge();}

function updateCameraMotion(dt){if(cameraLocked||spaceHeld){cameraFocus.copy(player.position);clampFocus();return;}if(!cameraSettings.edgeScroll||middleDragging||!pointerInside)return;let x=0,y=0;if(pointerPx.x<=EDGE_SCROLL_PX)x=-1;else if(pointerPx.x>=innerWidth-EDGE_SCROLL_PX)x=1;if(pointerPx.y<=EDGE_SCROLL_PX)y=1;else if(pointerPx.y>=innerHeight-EDGE_SCROLL_PX)y=-1;if(!x&&!y)return;const {forward,right}=cameraBasisOnGround();const v=new THREE.Vector3().addScaledVector(right,x).addScaledVector(forward,y);if(v.lengthSq())v.normalize();cameraFocus.addScaledVector(v,CAMERA_PAN_SPEED*cameraSettings.zoom*dt);clampFocus();}
function updateVisualEffects(dt,now){rangeRing.position.set(player.position.x,0.05,player.position.z);rangeRing.visible=attackMoveArmed;if(orderMarker.visible){markerLife-=dt;if(markerLife<=0)orderMarker.visible=false;else{const t=1-markerLife/0.34;markerMaterial.opacity=0.92*(1-t);orderMarker.scale.setScalar(0.82+t*0.55);}}if(targetFlash>0){targetFlash-=dt;targetRing.position.set(dummy.position.x,0.055,dummy.position.z);targetRing.material.opacity=Math.max(0,targetFlash/0.24);if(targetFlash<=0)targetRing.visible=false;}if(now>toastUntil)toastEl.className='';}
function updateHud(now){cameraStateEl.textContent=cameraLocked?'LOCKED':(spaceHeld?'CENTERED':'UNLOCKED');cameraStateEl.className=cameraLocked?'locked':'';const label=attackState==='windup'?'WINDUP':order.type.toUpperCase();orderStateEl.textContent=label==='ATTACKMOVE'?'ATTACK MOVE':label;orderStateEl.className=(attackState==='windup'||order.type==='attack'||order.type==='attackMove')?'attacking':(order.type==='move'?'moving':'');hitsStateEl.textContent=hits;cancelStateEl.textContent=cancels;kiteStateEl.textContent=cleanKites;scoreStateEl.textContent=score;const elapsed=firstDamageAt?Math.max(0.25,now-firstDamageAt):0;dpsStateEl.textContent=elapsed?Math.round(totalDamage/elapsed):0;enemyHpFill.style.width=`${enemyAlive?enemyHp/enemyMaxHp*100:0}%`;enemyHpText.textContent=`${Math.round(enemyHp)} / ${enemyMaxHp}`;playerHpFill.style.width=`${playerHp/playerMaxHp*100}%`;playerHpText.textContent=`${playerHp} / ${playerMaxHp}`;modeBanner.classList.toggle('show',attackMoveArmed);if(challenge.active){challengeBanner.className='active';challengeBanner.textContent=`KITING • ${challenge.time.toFixed(1)}s • SCORE ${score}`;}else{challengeBanner.className='';challengeBanner.textContent='K — START KITING CHALLENGE';}}

renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{
  pointerPx.set(e.clientX,e.clientY);
  if(e.button===2){e.preventDefault();if(e.shiftKey){const p=screenToGround(e.clientX,e.clientY);if(p)issueAttackMove(p);rightMouseHeld=false;}else{const target=pickEnemy(e.clientX,e.clientY);if(target){issueAttack(target);rightMouseHeld=false;}else{rightMouseHeld=true;lastMoveIssueMs=performance.now();issueMoveFromScreen(e.clientX,e.clientY,true);}}}
  if(e.button===1){e.preventDefault();middleDragging=true;lastMiddle.set(e.clientX,e.clientY);renderer.domElement.style.cursor='grabbing';}
  if(e.button===0&&attackMoveArmed){e.preventDefault();const target=pickEnemy(e.clientX,e.clientY);if(target)issueAttack(target);else{const p=screenToGround(e.clientX,e.clientY);if(p)issueAttackMove(p);}attackMoveArmed=false;renderer.domElement.style.cursor='';}
});
renderer.domElement.addEventListener('pointermove',e=>{pointerPx.set(e.clientX,e.clientY);pointerInside=true;if(rightMouseHeld&&performance.now()-lastMoveIssueMs>=HOLD_MOVE_INTERVAL_MS){lastMoveIssueMs=performance.now();issueMoveFromScreen(e.clientX,e.clientY,false);}if(middleDragging){const dx=e.clientX-lastMiddle.x,dy=e.clientY-lastMiddle.y;lastMiddle.set(e.clientX,e.clientY);const {forward,right}=cameraBasisOnGround();const worldPerPixel=CAMERA_DISTANCE*cameraSettings.zoom/1100;cameraFocus.addScaledVector(right,-dx*worldPerPixel);cameraFocus.addScaledVector(forward,dy*worldPerPixel);clampFocus();}});
renderer.domElement.addEventListener('pointerenter',()=>pointerInside=true);
renderer.domElement.addEventListener('pointerleave',()=>pointerInside=false);
renderer.domElement.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
function endPointerButton(button){if(button===2)rightMouseHeld=false;if(button===1){middleDragging=false;renderer.domElement.style.cursor=attackMoveArmed?'crosshair':'';}}
window.addEventListener('pointerup',e=>endPointerButton(e.button));
window.addEventListener('pointercancel',()=>{rightMouseHeld=false;middleDragging=false;renderer.domElement.style.cursor='';});
window.addEventListener('blur',()=>{rightMouseHeld=false;middleDragging=false;renderer.domElement.style.cursor='';});
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();const factor=e.deltaY>0?1.10:0.90;cameraSettings.zoom=THREE.MathUtils.clamp(cameraSettings.zoom*factor,cameraSettings.minZoom,cameraSettings.maxZoom);},{passive:false});

window.addEventListener('keydown',e=>{
  if(e.code==='Space'){e.preventDefault();if(!spaceHeld)cameraFocus.copy(player.position);spaceHeld=true;}
  if(e.code==='KeyY'&&!e.repeat){cameraLocked=!cameraLocked;if(cameraLocked)cameraFocus.copy(player.position);}
  if(e.code==='KeyS'&&!e.repeat){e.preventDefault();issueStop();}
  if(e.code==='KeyA'&&!e.repeat){e.preventDefault();attackMoveArmed=true;renderer.domElement.style.cursor='crosshair';}
  if(e.code==='Escape'&&attackMoveArmed){attackMoveArmed=false;renderer.domElement.style.cursor='';}
  if(e.code==='KeyK'&&!e.repeat){e.preventDefault();toggleChallenge();}
});
window.addEventListener('keyup',e=>{if(e.code==='Space')spaceHeld=false;});

function animate(ms){const now=ms/1000;const dt=Math.min(0.05,(ms-lastTime)/1000||0);lastTime=ms;if(challenge.active){challenge.time-=dt;if(challenge.time<=0){challenge.time=0;endChallenge('TIME');}}respawnDummy(now);updateOrder(dt,now);updateProjectiles(dt,now);updateDummyAI(dt,now);updateCameraMotion(dt);updateCameraTransform();updateVisualEffects(dt,now);updateHud(now);renderer.render(scene,camera);requestAnimationFrame(animate);}

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
updateCameraTransform();
updateHud(0);
requestAnimationFrame(animate);
