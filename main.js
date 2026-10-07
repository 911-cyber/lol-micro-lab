import * as THREE from 'three';

const $ = s => document.querySelector(s);
const game = $('#game');
const modeStateEl = $('#modeState');
const orderStateEl = $('#orderState');
const hitsStateEl = $('#hitsState');
const cancelStateEl = $('#cancelState');
const kiteStateEl = $('#kiteState');
const dodgeStateEl = $('#dodgeState');
const csStateEl = $('#csState');
const scoreStateEl = $('#scoreState');
const enemyHpFill = $('#enemyHpFill');
const enemyHpText = $('#enemyHpText');
const targetNameEl = $('#targetName');
const playerHpFill = $('#playerHpFill');
const playerHpText = $('#playerHpText');
const modeBanner = $('#modeBanner');
const objectiveBanner = $('#objectiveBanner');
const toastEl = $('#toast');
const difficultyStateEl = $('#difficultyState');
const resultPanel = $('#resultPanel');
const resultGradeEl = $('#resultGrade');
const resultTitleEl = $('#resultTitle');
const resultScoreEl = $('#resultScore');
const resultStatsEl = $('#resultStats');
const resultDiagnosisEl = $('#resultDiagnosis');

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

// Camera v1.0 — locked from the approved pass.
const CAMERA_FOV = 35;
const CAMERA_PITCH_DEG = 56;
const CAMERA_DISTANCE = 30;
const CAMERA_PAN_SPEED = 18;
const EDGE_SCROLL_PX = 14;

const WORLD_UNITS_PER_LOL_UNIT = 0.01;
const MOVE_SPEED = 335 * WORLD_UNITS_PER_LOL_UNIT;
const HOLD_MOVE_INTERVAL_MS = 70;

// Combat values are placeholders to be tuned later as requested.
const ATTACK_RANGE = 550 * WORLD_UNITS_PER_LOL_UNIT;
const ATTACK_SPEED = 0.75;
const ATTACK_INTERVAL = 1 / ATTACK_SPEED;
const WINDUP_TIME = ATTACK_INTERVAL * 0.22;
const PROJECTILE_SPEED = 18;
const ATTACK_DAMAGE = 70;
const PLAYER_RADIUS = 0.72;

const MODE = Object.freeze({ FREE:'FREE', KITE:'KITE', TARGET:'TARGET', SPACING:'SPACING', DODGE:'DODGE', CS:'CS', COMBINED:'COMBINED' });
let mode = MODE.FREE;

const DIFFICULTIES = [
  {name:'EASY', kiteSpeed:2.10, kiteDamage:6, targetMotion:.78, spacingSpeed:1.55, spacingDamage:4, dodgeSpeed:7.2, dodgeSpawn:.96, csDrain:.82},
  {name:'NORMAL', kiteSpeed:2.45, kiteDamage:8, targetMotion:1.00, spacingSpeed:1.85, spacingDamage:6, dodgeSpeed:8.5, dodgeSpawn:.82, csDrain:1.00},
  {name:'HARD', kiteSpeed:2.85, kiteDamage:10, targetMotion:1.28, spacingSpeed:2.18, spacingDamage:8, dodgeSpeed:10.2, dodgeSpawn:.66, csDrain:1.18},
];
let difficultyIndex = 1;
const difficulty = () => DIFFICULTIES[difficultyIndex];

const camera = new THREE.PerspectiveCamera(CAMERA_FOV, innerWidth/innerHeight, 0.1, 220);
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
const pointerNdc = new THREE.Vector2();

scene.add(new THREE.HemisphereLight(0xbfdcff, 0x10200d, 2.4));
const sun = new THREE.DirectionalLight(0xfff2d2, 2.8);
sun.position.set(-18,28,8); sun.castShadow = true; sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-40; sun.shadow.camera.right=40; sun.shadow.camera.top=40; sun.shadow.camera.bottom=-40;
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(90,70), new THREE.MeshStandardMaterial({color:0x173025,roughness:1}));
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
const lane = new THREE.Mesh(new THREE.PlaneGeometry(76,8), new THREE.MeshStandardMaterial({color:0x34423a,roughness:1}));
lane.rotation.x=-Math.PI/2; lane.rotation.z=-0.22; lane.position.y=0.015; scene.add(lane);
const river = new THREE.Mesh(new THREE.PlaneGeometry(13,76), new THREE.MeshStandardMaterial({color:0x183b4f,roughness:.8}));
river.rotation.x=-Math.PI/2; river.rotation.z=.48; river.position.y=.02; scene.add(river);
const grid = new THREE.GridHelper(90,45,0x315442,0x213b30); grid.position.y=.035; grid.material.opacity=.18; grid.material.transparent=true; scene.add(grid);

function addRock(x,z,s=1){
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1*s,0), new THREE.MeshStandardMaterial({color:0x465448,roughness:1}));
  rock.position.set(x,.65*s,z); rock.scale.y=.65; rock.rotation.set(.2,x*.07,.1); rock.castShadow=true; rock.receiveShadow=true; scene.add(rock);
}
for(const [x,z,s] of [[-24,-13,1.5],[-19,14,1],[20,-12,1.3],[27,14,1.6],[0,-22,1.1],[7,20,1.2],[-31,4,1.2],[32,-2,1]]) addRock(x,z,s);

function makeChampion(color=0x4c91ff, shoulderColor=0x223b70){
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.58,.9,7,12), new THREE.MeshStandardMaterial({color,roughness:.5}));
  body.position.y=.78; body.castShadow=true; group.add(body);
  const shoulder = new THREE.Mesh(new THREE.ConeGeometry(.8,.45,8), new THREE.MeshStandardMaterial({color:shoulderColor,roughness:.55}));
  shoulder.position.y=1.28; shoulder.rotation.x=Math.PI; group.add(shoulder);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.72,.82,48), new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.y=.045; group.add(ring);
  return group;
}

const player = makeChampion(); player.position.set(-4,0,2); scene.add(player);

const enemyColors = [0xd95762,0xe28b50,0x9e62df,0xd95762,0x8a5a4b,0x8a5a4b,0x8a5a4b];
const enemies = [];
function createEnemy(name,x,z,color=0xd95762,maxHp=700,radius=.76,type='dummy'){
  const group = makeChampion(color,0x69232b); group.position.set(x,0,z); group.scale.setScalar(type==='minion'?.62:1.05); scene.add(group);
  const hitbox = new THREE.Mesh(new THREE.SphereGeometry(type==='minion'?.85:1.25,14,10), new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  hitbox.position.y=.85; group.add(hitbox);
  const e={name,group,hitbox,hp:maxHp,maxHp,radius,type,alive:true,respawnAt:0,velocity:new THREE.Vector3(),aiClock:Math.random()*4,lastHitIndicator:null,hpBar:null};
  enemies.push(e); return e;
}

const mainDummy = createEnemy('TRAINING DUMMY',8,-2,enemyColors[0],700,.76,'dummy');
let activeTarget = mainDummy;

const markerMaterial = new THREE.MeshBasicMaterial({color:0x55e36f,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
const orderMarker = new THREE.Mesh(new THREE.RingGeometry(.25,.39,40),markerMaterial); orderMarker.rotation.x=-Math.PI/2; orderMarker.position.y=.065; orderMarker.visible=false; scene.add(orderMarker);
let markerLife=0;

const rangeRing = new THREE.Mesh(new THREE.RingGeometry(ATTACK_RANGE+PLAYER_RADIUS-.035,ATTACK_RANGE+PLAYER_RADIUS+.035,128),new THREE.MeshBasicMaterial({color:0xe3c56e,transparent:true,opacity:.72,side:THREE.DoubleSide,depthWrite:false}));
rangeRing.rotation.x=-Math.PI/2; rangeRing.position.y=.05; rangeRing.visible=false; scene.add(rangeRing);
const dangerRing = new THREE.Mesh(new THREE.RingGeometry(4.0,4.06,128),new THREE.MeshBasicMaterial({color:0xff5966,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));
dangerRing.rotation.x=-Math.PI/2; dangerRing.position.y=.052; dangerRing.visible=false; scene.add(dangerRing);

const targetRing = new THREE.Mesh(new THREE.RingGeometry(.92,1.04,56),new THREE.MeshBasicMaterial({color:0xff5966,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
targetRing.rotation.x=-Math.PI/2; targetRing.position.y=.055; targetRing.visible=false; scene.add(targetRing);
let targetFlash=0;

const projectiles=[];
const projectileGeom=new THREE.SphereGeometry(.13,10,8);
const projectileMat=new THREE.MeshBasicMaterial({color:0xffe091});
const skillshots=[];
const skillGeom=new THREE.SphereGeometry(.22,10,8);
const skillMat=new THREE.MeshBasicMaterial({color:0x79d8ff});

const cameraSettings={zoom:1,minZoom:.66,maxZoom:1,edgeScroll:true};
const cameraFocus=player.position.clone();
let cameraLocked=false,spaceHeld=false,middleDragging=false,rightMouseHeld=false;
let lastMiddle=new THREE.Vector2(),pointerPx=new THREE.Vector2(innerWidth/2,innerHeight/2),pointerInside=true;
let lastMoveIssueMs=-Infinity,lastTime=performance.now();

let order={type:'idle',point:player.position.clone(),target:null};
let attackMoveArmed=false,attackState='idle',attackTarget=null,windupEnd=0,nextAttackReady=0,lastShotAt=-Infinity,awaitingKiteMove=false;
let playerHp=100,playerMaxHp=100,hits=0,cancels=0,cleanKites=0,dodges=0,cs=0,missedCs=0,score=0,toastUntil=0;
let targetSwitches=0,skillshotsFired=0,skillshotsHit=0,sessionDuration=0,lastSelectedTarget=null;

const modeData={time:0,nextSpawn:0,nextEnemyAttack:0,spacingGoodTime:0,spacingDangerTime:0,wave:0};

function clampFocus(){cameraFocus.x=THREE.MathUtils.clamp(cameraFocus.x,-34,34);cameraFocus.z=THREE.MathUtils.clamp(cameraFocus.z,-25,25);}
function getCameraOffset(){const p=THREE.MathUtils.degToRad(CAMERA_PITCH_DEG),d=CAMERA_DISTANCE*cameraSettings.zoom;return new THREE.Vector3(0,Math.sin(p)*d,Math.cos(p)*d);}
function updateCameraTransform(){camera.position.copy(cameraFocus).add(getCameraOffset());camera.lookAt(cameraFocus);}
function cameraBasisOnGround(){const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,camera.up).normalize();return{forward,right};}
function rayFromScreen(x,y){const r=renderer.domElement.getBoundingClientRect();pointerNdc.x=((x-r.left)/r.width)*2-1;pointerNdc.y=-((y-r.top)/r.height)*2+1;raycaster.setFromCamera(pointerNdc,camera);}
function screenToGround(x,y){rayFromScreen(x,y);const hit=new THREE.Vector3();return raycaster.ray.intersectPlane(groundPlane,hit)?hit:null;}
function livingEnemies(){return enemies.filter(e=>e.alive&&e.group.visible);}
function pickEnemy(x,y){rayFromScreen(x,y);let best=null,bestDist=Infinity;for(const e of livingEnemies()){const hits=raycaster.intersectObject(e.group,true);if(hits.length&&hits[0].distance<bestDist){best=e;bestDist=hits[0].distance;}}return best;}
function clampPoint(p){p.x=THREE.MathUtils.clamp(p.x,-42,42);p.z=THREE.MathUtils.clamp(p.z,-32,32);p.y=0;return p;}
function showMarker(point,color=0x55e36f){markerMaterial.color.setHex(color);orderMarker.position.set(point.x,.065,point.z);orderMarker.scale.setScalar(.82);markerMaterial.opacity=.92;orderMarker.visible=true;markerLife=.34;}
function flashTarget(e){if(!e)return;if(mode===MODE.TARGET&&lastSelectedTarget&&lastSelectedTarget!==e)targetSwitches++;if(mode===MODE.TARGET)lastSelectedTarget=e;activeTarget=e;targetFlash=.24;targetRing.position.set(e.group.position.x,.055,e.group.position.z);targetRing.material.opacity=.95;targetRing.visible=true;}
function toast(text,kind=''){toastEl.textContent=text;toastEl.className=`show ${kind}`.trim();toastUntil=performance.now()/1000+1.0;}
function edgeDistance(e){return Math.max(0,player.position.distanceTo(e.group.position)-PLAYER_RADIUS-e.radius);}
function enemyInAttackRange(e){return e?.alive&&edgeDistance(e)<=ATTACK_RANGE+.001;}
function facePoint(p){player.lookAt(p.x,player.position.y,p.z);}

function cancelWindup(reason='move'){
  if(attackState!=='windup')return false;
  attackState='idle';attackTarget=null;nextAttackReady=performance.now()/1000;cancels++;score=Math.max(0,score-20);toast(reason==='stop'?'AA cancelled by Stop':'AA cancelled — moved before release','bad');return true;
}
function notePostShotMove(){const now=performance.now()/1000;if(awaitingKiteMove&&now-lastShotAt<=.46){awaitingKiteMove=false;cleanKites++;score+=30;toast('Clean kite: shot → move','good');}}
function issueMovePoint(point,show=true){point=clampPoint(point.clone());cancelWindup('move');notePostShotMove();order={type:'move',point,target:null};if(show)showMarker(point);}
function issueMoveFromScreen(x,y,show=true){const hit=screenToGround(x,y);if(hit)issueMovePoint(hit,show);}
function issueStop(){cancelWindup('stop');order={type:'idle',point:player.position.clone(),target:null};rightMouseHeld=false;}
function issueAttack(target){if(!target?.alive)return;order={type:'attack',point:target.group.position.clone(),target};flashTarget(target);}
function nearestEnemyToPoint(point,rangeOnly=true){let best=null,bestD=Infinity;for(const e of livingEnemies()){if(rangeOnly&&!enemyInAttackRange(e))continue;const d=e.group.position.distanceToSquared(point);if(d<bestD){bestD=d;best=e;}}return best;}
function issueAttackMove(point){point=clampPoint(point.clone());cancelWindup('move');notePostShotMove();const target=nearestEnemyToPoint(point,true);order={type:'attackMove',point,target};showMarker(point,0xe06469);if(target)flashTarget(target);}

function moveToward(point,dt,stopDistance=0){const delta=new THREE.Vector3().subVectors(point,player.position);delta.y=0;const dist=delta.length();if(dist<=stopDistance+.025)return true;delta.normalize();const step=Math.min(Math.max(0,dist-stopDistance),MOVE_SPEED*dt);player.position.addScaledVector(delta,step);facePoint(player.position.clone().add(delta));return dist-step<=stopDistance+.025;}
function moveTowardTarget(e,dt){const stop=ATTACK_RANGE+PLAYER_RADIUS+e.radius;const delta=new THREE.Vector3().subVectors(e.group.position,player.position);delta.y=0;const dist=delta.length();if(dist<=stop)return true;delta.normalize();const step=Math.min(dist-stop,MOVE_SPEED*dt);player.position.addScaledVector(delta,Math.max(0,step));facePoint(e.group.position);return dist-step<=stop+.01;}
function startAttack(e,now){if(!e?.alive||now<nextAttackReady||attackState==='windup'||!enemyInAttackRange(e))return false;attackState='windup';attackTarget=e;windupEnd=now+WINDUP_TIME;nextAttackReady=now+ATTACK_INTERVAL;facePoint(e.group.position);return true;}
function launchProjectile(e,now){attackState='idle';attackTarget=null;lastShotAt=now;awaitingKiteMove=true;const mesh=new THREE.Mesh(projectileGeom,projectileMat.clone());mesh.position.copy(player.position).add(new THREE.Vector3(0,1.05,0));scene.add(mesh);projectiles.push({mesh,target:e});}
function killEnemy(e,now,fromPlayer=true){e.alive=false;e.group.visible=false;if(e.hpBar)e.hpBar.root.visible=false;e.respawnAt=now+.8;if(fromPlayer){score+=e.type==='minion'?45:250;if(e.type==='minion')cs++;}}
function damageEnemy(e,amount,now,fromPlayer=true){if(!e?.alive)return;e.hp=Math.max(0,e.hp-amount);if(fromPlayer){hits++;score+=60;}if(e.hp<=0)killEnemy(e,now,fromPlayer);}
function updateProjectiles(dt,now){for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i],e=p.target;if(!e?.alive){scene.remove(p.mesh);projectiles.splice(i,1);continue;}const aim=e.group.position.clone().add(new THREE.Vector3(0,.9,0));const delta=aim.sub(p.mesh.position),dist=delta.length(),step=PROJECTILE_SPEED*dt;if(dist<=step+.18){scene.remove(p.mesh);projectiles.splice(i,1);damageEnemy(e,ATTACK_DAMAGE,now,true);}else{p.mesh.position.addScaledVector(delta.normalize(),step);}}}

function updateOrder(dt,now){
  if(attackState==='windup'){
    if(!attackTarget?.alive){attackState='idle';attackTarget=null;return;}
    facePoint(attackTarget.group.position);
    if(now>=windupEnd)launchProjectile(attackTarget,now);
    return;
  }
  if(order.type==='idle')return;
  if(order.type==='move'){if(moveToward(order.point,dt))order.type='idle';return;}
  if(order.type==='attack'){
    const e=order.target;if(!e?.alive){order.type='idle';return;}
    if(enemyInAttackRange(e)){facePoint(e.group.position);startAttack(e,now);}else moveTowardTarget(e,dt);return;
  }
  if(order.type==='attackMove'){
    if(order.target?.alive&&enemyInAttackRange(order.target)){startAttack(order.target,now);return;}
    const target=nearestEnemyToPoint(order.point,true);if(target){order.target=target;flashTarget(target);startAttack(target,now);return;}
    if(moveToward(order.point,dt))order.type='idle';
  }
}

function resetEntities(){
  for(const e of enemies){if(e!==mainDummy){scene.remove(e.group);if(e.lastHitIndicator)scene.remove(e.lastHitIndicator);if(e.hpBar)scene.remove(e.hpBar.root);}}
  enemies.splice(1);
  mainDummy.alive=true;mainDummy.group.visible=true;mainDummy.hp=mainDummy.maxHp=700;mainDummy.type='dummy';mainDummy.name='TRAINING DUMMY';mainDummy.radius=.76;mainDummy.group.scale.setScalar(1.05);mainDummy.group.position.set(8,0,-2);mainDummy.velocity.set(0,0,0);mainDummy.lastHitIndicator=null;mainDummy.hpBar=null;
  activeTarget=mainDummy;dangerRing.visible=false;rangeRing.visible=false;
}
function resetStats(){hits=0;cancels=0;cleanKites=0;dodges=0;cs=0;missedCs=0;score=0;playerHp=100;targetSwitches=0;skillshotsFired=0;skillshotsHit=0;sessionDuration=0;lastSelectedTarget=null;modeData.time=0;modeData.nextSpawn=0;modeData.nextEnemyAttack=0;modeData.spacingGoodTime=0;modeData.spacingDangerTime=0;modeData.wave=0;}
function hideResult(){resultPanel.classList.remove('show');}
function clamp100(v){return Math.max(0,Math.min(100,Math.round(v)));}
function gradeFor(v){return v>=92?'S':v>=80?'A':v>=68?'B':v>=55?'C':'D';}
function resultHistory(){try{return JSON.parse(localStorage.getItem('lolMicroLabResults')||'[]');}catch{return[];}}
function recordResult(modeName,performance){const rows=resultHistory();rows.push({mode:modeName,performance,time:Date.now(),difficulty:difficulty().name});try{localStorage.setItem('lolMicroLabResults',JSON.stringify(rows.slice(-40)));}catch{}}
function weakestHistoryText(){const rows=resultHistory();const buckets={};for(const r of rows){(buckets[r.mode]??=[]).push(r.performance);}const entries=Object.entries(buckets).filter(([,v])=>v.length);if(entries.length<2)return'';entries.sort((a,b)=>a[1].reduce((x,y)=>x+y,0)/a[1].length-b[1].reduce((x,y)=>x+y,0)/b[1].length);const [name,vals]=entries[0];const avg=Math.round(vals.reduce((x,y)=>x+y,0)/vals.length);return` 過去の平均では ${name} (${avg}) が今の弱点。`;}
function statCard(label,value){return`<div class="result-stat"><span>${label}</span><b>${value}</b></div>`;}
function showResult(finished){
  let performance=0,diagnosis='',stats=[];
  const hpRate=playerHp/playerMaxHp;
  if(finished===MODE.KITE){const clean=cleanKites/Math.max(1,hits),cancel=cancels/Math.max(1,hits+cancels);performance=clamp100(Math.min(1,hits/12)*35+clean*30+hpRate*25+(1-cancel)*10);stats=[['HITS',hits],['CLEAN',cleanKites],['HP',`${Math.round(playerHp)}%`]];diagnosis=cancel>.22?'AAキャンセルが多め。弾が出る瞬間を確認してから移動しよう。':clean<.55?'AA後に止まる時間が長い。発射直後の右クリックをもっと早く。':hpRate<.65?'火力は出ているけど近づかれすぎ。AA射程の外側を使おう。':'AA→移動のリズムはかなり安定。次は敵を見ながら同じ精度を維持。';}
  if(finished===MODE.TARGET){const cancel=cancels/Math.max(1,hits+cancels);performance=clamp100(Math.min(1,targetSwitches/8)*45+Math.min(1,hits/14)*35+(1-cancel)*20);stats=[['SWITCHES',targetSwitches],['HITS',hits],['CANCELS',cancels]];diagnosis=targetSwitches<5?'同じ敵を殴り続けがち。A→クリックで次の標的へ視線とカーソルを先に移そう。':cancel>.2?'切り替えはできている。次はAAの発射前キャンセルを減らそう。':'ターゲット変更は良好。次は移動を混ぜながら同じ速さを維持。';}
  if(finished===MODE.SPACING){const good=modeData.spacingGoodTime/Math.max(1,sessionDuration),danger=modeData.spacingDangerTime/Math.max(1,sessionDuration);performance=clamp100(good*105-danger*65+hpRate*20);stats=[['GOOD',`${modeData.spacingGoodTime.toFixed(1)}s`],['DANGER',`${modeData.spacingDangerTime.toFixed(1)}s`],['HP',`${Math.round(playerHp)}%`]];diagnosis=danger>.22?'敵の危険範囲に入りすぎ。攻撃より先に「相手の届く距離」を意識しよう。':good<.45?'安全すぎて自分の射程も活かせていない。黄色リングの内側ギリギリへ。':'距離管理は安定。次はAAを混ぜてもこの間合いを崩さない練習へ。';}
  if(finished===MODE.DODGE){const total=dodges+skillshotsHit,rate=dodges/Math.max(1,total);performance=clamp100(rate*85+hpRate*15);stats=[['DODGED',dodges],['HIT',skillshotsHit],['RATE',`${Math.round(rate*100)}%`]];diagnosis=rate<.7?'被弾が多め。弾を見てから大きく逃げるより、細かい横移動を増やそう。':rate<.88?'回避は良い。次は移動先を毎回変えて予測されにくくしよう。':'かなり安定して避けられている。複合練習に進めるレベル。';}
  if(finished===MODE.COMBINED){const total=dodges+skillshotsHit,dodgeRate=dodges/Math.max(1,total),clean=cleanKites/Math.max(1,hits),cancel=cancels/Math.max(1,hits+cancels);performance=clamp100(dodgeRate*35+clean*30+hpRate*25+(1-cancel)*10);stats=[['CLEAN',cleanKites],['DODGE',`${Math.round(dodgeRate*100)}%`],['HP',`${Math.round(playerHp)}%`]];diagnosis=dodgeRate<.72?'AAに集中するとスキルショットを見失っている。攻撃後に敵ではなく画面全体を見る時間を作ろう。':clean<.5?'回避はできているけどAA→移動のリズムが崩れ気味。発射直後だけ移動する意識を戻そう。':hpRate<.55?'操作はできているが敵との距離が近い。カイト方向を後ろだけでなく斜めにも散らそう。':'攻撃と回避の同時処理が安定。実戦に近い複合ミクロができている。';}
  if(finished===MODE.CS){const total=cs+missedCs,rate=cs/Math.max(1,total);performance=clamp100(rate*90+Math.min(1,cs/12)*10);stats=[['CS',cs],['MISS',missedCs],['RATE',`${Math.round(rate*100)}%`]];diagnosis=rate<.6?'HPバーを見て「自分の1発で倒せる瞬間」まで待とう。早撃ちを減らすのが最優先。':rate<.82?'タイミングは掴めてきた。複数ミニオンのHPを同時に見る癖をつけよう。':'ラストヒット精度は良好。次は移動やハラスを混ぜたCSへ。';}
  recordResult(finished,performance);
  resultGradeEl.textContent=gradeFor(performance);resultTitleEl.textContent=finished;resultScoreEl.textContent=`PERFORMANCE ${performance}/100 • SCORE ${Math.round(score)} • ${difficulty().name}`;resultStatsEl.innerHTML=stats.map(([a,b])=>statCard(a,b)).join('');resultDiagnosisEl.textContent=diagnosis+weakestHistoryText();resultPanel.classList.add('show');
}
function cycleDifficulty(){difficultyIndex=(difficultyIndex+1)%DIFFICULTIES.length;difficultyStateEl.textContent=difficulty().name;toast(`DIFFICULTY — ${difficulty().name}`,'info');}
function setMode(next,opts={}){
  const keepStats=!!opts.keepStats,keepResult=!!opts.keepResult;
  mode=next;resetEntities();if(!keepStats)resetStats();if(!keepResult)hideResult();order={type:'idle',point:player.position.clone(),target:null};attackState='idle';attackTarget=null;projectiles.splice(0).forEach(p=>scene.remove(p.mesh));skillshots.splice(0).forEach(s=>scene.remove(s.mesh));player.position.set(-4,0,2);
  if(mode===MODE.FREE){modeBanner.textContent=opts.complete?`${opts.complete} COMPLETE`:'FREE MODE';objectiveBanner.textContent=opts.complete?'リザルトを確認。1〜6で次の練習を開始':'1 KITE • 2 TARGET • 3 SPACE • 4 DODGE • 5 CS • 6 COMBO';return;}
  if(mode===MODE.KITE){modeBanner.textContent='KITING — 30s';objectiveBanner.textContent='AAを出した直後に移動。追いつかれないように削る';mainDummy.group.position.set(8,0,-1);modeData.time=30;sessionDuration=30;rangeRing.visible=true;}
  if(mode===MODE.TARGET){modeBanner.textContent='TARGET SWITCH — 30s';objectiveBanner.textContent='A→クリックでカーソルに近い敵を素早く切り替える';mainDummy.group.position.set(6,0,-3);createEnemy('ORANGE DUMMY',10,2,enemyColors[1],420,.76);createEnemy('PURPLE DUMMY',5,5,enemyColors[2],420,.76);mainDummy.hp=mainDummy.maxHp=420;modeData.time=30;sessionDuration=30;rangeRing.visible=true;}
  if(mode===MODE.SPACING){modeBanner.textContent='SPACING — 30s';objectiveBanner.textContent='黄色い自分の射程内、赤い敵の危険範囲外を維持';mainDummy.group.position.set(5.7,0,-1);modeData.time=30;sessionDuration=30;rangeRing.visible=true;dangerRing.visible=true;}
  if(mode===MODE.DODGE){modeBanner.textContent='DODGE — 30s';objectiveBanner.textContent='青いスキルショットを避ける。被弾でHPとスコア減';mainDummy.group.visible=false;mainDummy.alive=false;modeData.time=30;sessionDuration=30;modeData.nextSpawn=.45;}
  if(mode===MODE.CS){modeBanner.textContent='CS / LAST HIT — 45s';objectiveBanner.textContent='頭上HPバーを見てラストヒット。白リングは補助';mainDummy.group.visible=false;mainDummy.alive=false;modeData.time=45;sessionDuration=45;spawnWave();}
  if(mode===MODE.COMBINED){modeBanner.textContent='KITE + DODGE — 40s';objectiveBanner.textContent='AA→移動を維持しながら青いスキルショットも避ける';mainDummy.group.position.set(8,0,-1);modeData.time=40;sessionDuration=40;modeData.nextSpawn=.65;rangeRing.visible=true;}
  toast(`${mode} START — ${difficulty().name}`,'info');
}

function updateKiteMode(dt,now){if((mode!==MODE.KITE&&mode!==MODE.COMBINED)||!mainDummy.alive)return;const delta=new THREE.Vector3().subVectors(player.position,mainDummy.group.position);delta.y=0;const dist=delta.length();if(dist>1.55){delta.normalize();mainDummy.group.position.addScaledVector(delta,difficulty().kiteSpeed*dt);}if(dist<1.95&&now>=modeData.nextEnemyAttack){modeData.nextEnemyAttack=now+1.0;playerHp=Math.max(0,playerHp-difficulty().kiteDamage);score=Math.max(0,score-40);toast('Too close — hit by dummy','bad');}}

function updateTargetMode(dt){if(mode!==MODE.TARGET)return;for(const e of livingEnemies()){e.aiClock+=dt;const center=e===mainDummy?new THREE.Vector3(6,0,-3):e.name.startsWith('ORANGE')?new THREE.Vector3(10,0,2):new THREE.Vector3(5,0,5);e.group.position.x=center.x+Math.sin(e.aiClock*.9*difficulty().targetMotion)*1.2;e.group.position.z=center.z+Math.cos(e.aiClock*.7*difficulty().targetMotion)*1.0;}}

function updateSpacingMode(dt,now){
  if(mode!==MODE.SPACING||!mainDummy.alive)return;
  dangerRing.position.set(mainDummy.group.position.x,.052,mainDummy.group.position.z);
  const dist=edgeDistance(mainDummy);
  const dir=new THREE.Vector3().subVectors(player.position,mainDummy.group.position);dir.y=0;if(dir.lengthSq())dir.normalize();
  if(dist>3.85)mainDummy.group.position.addScaledVector(dir,difficulty().spacingSpeed*dt);
  if(dist<3.9){modeData.spacingDangerTime+=dt;score=Math.max(0,score-8*dt);if(now>=modeData.nextEnemyAttack){modeData.nextEnemyAttack=now+.8;playerHp=Math.max(0,playerHp-difficulty().spacingDamage);}}
  if(dist>=4.1&&dist<=ATTACK_RANGE){modeData.spacingGoodTime+=dt;score+=12*dt;}
}

function spawnSkillshot(){
  const side=Math.floor(Math.random()*4);const bounds={x:18,z:12};let start=new THREE.Vector3();
  if(side===0)start.set(-bounds.x,0.35,THREE.MathUtils.randFloat(-bounds.z,bounds.z));
  if(side===1)start.set(bounds.x,0.35,THREE.MathUtils.randFloat(-bounds.z,bounds.z));
  if(side===2)start.set(THREE.MathUtils.randFloat(-bounds.x,bounds.x),0.35,-bounds.z);
  if(side===3)start.set(THREE.MathUtils.randFloat(-bounds.x,bounds.x),0.35,bounds.z);
  const aim=player.position.clone();aim.x+=THREE.MathUtils.randFloat(-.8,.8);aim.z+=THREE.MathUtils.randFloat(-.8,.8);const vel=aim.sub(start).setY(0).normalize().multiplyScalar(difficulty().dodgeSpeed);
  const mesh=new THREE.Mesh(skillGeom,skillMat.clone());mesh.position.copy(start);scene.add(mesh);skillshots.push({mesh,vel,life:5,scored:false});skillshotsFired++;
}
function updateDodgeMode(dt){
  if(mode!==MODE.DODGE&&mode!==MODE.COMBINED)return;
  modeData.nextSpawn-=dt;if(modeData.nextSpawn<=0){spawnSkillshot();modeData.nextSpawn=Math.max(.34,difficulty().dodgeSpawn-modeData.time*.002);}
  for(let i=skillshots.length-1;i>=0;i--){const s=skillshots[i];s.life-=dt;s.mesh.position.addScaledVector(s.vel,dt);const d=s.mesh.position.distanceTo(player.position.clone().setY(.35));if(d<.72){skillshotsHit++;playerHp=Math.max(0,playerHp-14);score=Math.max(0,score-70);toast('Skillshot hit','bad');scene.remove(s.mesh);skillshots.splice(i,1);continue;}if(s.life<=0||Math.abs(s.mesh.position.x)>24||Math.abs(s.mesh.position.z)>18){dodges++;score+=35;scene.remove(s.mesh);skillshots.splice(i,1);}}
}

function makeMinionHpBar(e){
  const root=new THREE.Group();
  const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x101820,transparent:true,opacity:.96,depthTest:false,depthWrite:false}));
  const fillMat=new THREE.SpriteMaterial({color:0x54d66f,transparent:true,opacity:1,depthTest:false,depthWrite:false});
  const fill=new THREE.Sprite(fillMat);
  bg.scale.set(1.55,.18,1);fill.scale.set(1.42,.105,1);bg.renderOrder=30;fill.renderOrder=31;root.add(bg,fill);scene.add(root);e.hpBar={root,bg,fill,fillMat};updateMinionHpBar(e);
}
function updateMinionHpBar(e){
  if(!e.hpBar)return;const ratio=Math.max(0,Math.min(1,e.hp/e.maxHp));const y=e.maxHp===320?1.82:1.68;e.hpBar.root.position.set(e.group.position.x,y,e.group.position.z);e.hpBar.root.visible=mode===MODE.CS&&e.alive&&e.group.visible;e.hpBar.fill.scale.x=1.42*ratio;e.hpBar.fill.position.x=-.71*(1-ratio);e.hpBar.fillMat.color.setHex(ratio>.55?0x53d66e:ratio>.28?0xe0b94f:0xd94b52);
}

function makeLastHitIndicator(e){const ring=new THREE.Mesh(new THREE.RingGeometry(.62,.73,36),new THREE.MeshBasicMaterial({color:0xf5f0d0,transparent:true,opacity:.78,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.06;scene.add(ring);e.lastHitIndicator=ring;}
function spawnWave(){
  modeData.wave++;
  const xs=[2.0,3.5,5.0,7.2,8.6,10.0];
  for(let i=0;i<6;i++){const melee=i<3;const e=createEnemy(`${melee?'MELEE':'CASTER'} MINION`,xs[i],0,(melee?0xb45a52:0x9b6ec7),melee?320:220,melee?.48:.42,'minion');e.group.position.z=(i%2?1.2:-.9)+(i>=3?1.4:0);e.group.scale.setScalar(melee?.62:.55);e.hp=e.maxHp;makeLastHitIndicator(e);makeMinionHpBar(e);}
}
function updateCsMode(dt,now){
  if(mode!==MODE.CS)return;
  const minions=livingEnemies().filter(e=>e.type==='minion');
  if(!minions.length&&modeData.time>1){spawnWave();return;}
  for(const e of minions){
    // Simulated allied damage creates a last-hit timing window; not a full SR wave simulation yet.
    const drain=(e.maxHp===320?20:17)*difficulty().csDrain*dt*(.75+Math.sin(now*1.7+e.group.position.x)*.18);
    e.hp=Math.max(0,e.hp-drain);
    if(e.lastHitIndicator){e.lastHitIndicator.position.set(e.group.position.x,.06,e.group.position.z);e.lastHitIndicator.visible=e.hp>0&&e.hp<=ATTACK_DAMAGE;}updateMinionHpBar(e);
    if(e.hp<=0&&e.alive){missedCs++;killEnemy(e,now,false);score=Math.max(0,score-18);}
  }
}

function updateModeTimer(dt){
  if(mode===MODE.FREE)return;
  modeData.time=Math.max(0,modeData.time-dt);
  const label=mode===MODE.CS?`CS ${cs} • MISS ${missedCs} • ${modeData.time.toFixed(1)}s`:`${mode} • ${modeData.time.toFixed(1)}s`;
  modeBanner.textContent=label;
  if(modeData.time<=0){const finished=mode;showResult(finished);setMode(MODE.FREE,{keepStats:true,keepResult:true,complete:finished});toast(`${finished} COMPLETE`,'good');}
}

function respawnEnemies(now){
  if(mode===MODE.CS)return;
  for(const e of enemies){if(e.alive||now<e.respawnAt)continue;e.alive=true;e.group.visible=true;e.hp=e.maxHp;if(mode===MODE.TARGET){e.group.position.x=THREE.MathUtils.randFloat(4,11);e.group.position.z=THREE.MathUtils.randFloat(-4,6);}else if(e===mainDummy){e.group.position.set(8,0,-2);}}
}

function updateVisuals(dt){
  rangeRing.position.set(player.position.x,.05,player.position.z);
  markerLife-=dt;if(orderMarker.visible){if(markerLife<=0)orderMarker.visible=false;else{const t=1-markerLife/.34;markerMaterial.opacity=.92*(1-t);orderMarker.scale.setScalar(.82+t*.55);}}
  targetFlash-=dt;if(targetRing.visible){if(activeTarget?.alive)targetRing.position.set(activeTarget.group.position.x,.055,activeTarget.group.position.z);if(targetFlash<=0)targetRing.material.opacity=Math.max(.2,targetRing.material.opacity-dt*2.5);}
}

function updateCameraMotion(dt){if(cameraLocked||spaceHeld){cameraFocus.copy(player.position);clampFocus();return;}if(!cameraSettings.edgeScroll||middleDragging||!pointerInside)return;let x=0,y=0;if(pointerPx.x<=EDGE_SCROLL_PX)x=-1;else if(pointerPx.x>=innerWidth-EDGE_SCROLL_PX)x=1;if(pointerPx.y<=EDGE_SCROLL_PX)y=1;else if(pointerPx.y>=innerHeight-EDGE_SCROLL_PX)y=-1;if(!x&&!y)return;const {forward,right}=cameraBasisOnGround();const v=new THREE.Vector3().addScaledVector(right,x).addScaledVector(forward,y);if(v.lengthSq())v.normalize();cameraFocus.addScaledVector(v,CAMERA_PAN_SPEED*cameraSettings.zoom*dt);clampFocus();}

function updateHud(now){
  modeStateEl.textContent=mode;difficultyStateEl.textContent=difficulty().name;
  orderStateEl.textContent=attackState==='windup'?'WINDUP':order.type.toUpperCase();orderStateEl.className=attackState==='windup'?'attacking':order.type==='move'?'moving':'';
  hitsStateEl.textContent=hits;cancelStateEl.textContent=cancels;kiteStateEl.textContent=cleanKites;dodgeStateEl.textContent=dodges;csStateEl.textContent=cs;scoreStateEl.textContent=Math.round(score);
  playerHpFill.style.width=`${playerHp}%`;playerHpText.textContent=`${Math.round(playerHp)} / ${playerMaxHp}`;
  if(activeTarget?.alive&&activeTarget.group.visible){targetNameEl.textContent=activeTarget.name;enemyHpFill.style.width=`${Math.max(0,activeTarget.hp/activeTarget.maxHp*100)}%`;enemyHpText.textContent=`${Math.ceil(activeTarget.hp)} / ${activeTarget.maxHp}`;}else{targetNameEl.textContent='NO TARGET';enemyHpFill.style.width='0%';enemyHpText.textContent='—';}
  if(now>toastUntil)toastEl.className='';
}

renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{
  pointerPx.set(e.clientX,e.clientY);
  if(e.button===2){e.preventDefault();rightMouseHeld=true;lastMoveIssueMs=performance.now();const enemy=pickEnemy(e.clientX,e.clientY);if(e.shiftKey){const hit=screenToGround(e.clientX,e.clientY);if(hit)issueAttackMove(hit);}else if(enemy)issueAttack(enemy);else issueMoveFromScreen(e.clientX,e.clientY,true);}
  if(e.button===0&&attackMoveArmed){e.preventDefault();attackMoveArmed=false;rangeRing.visible=mode!==MODE.FREE;const hit=screenToGround(e.clientX,e.clientY);if(hit)issueAttackMove(hit);}
  if(e.button===1){e.preventDefault();middleDragging=true;lastMiddle.set(e.clientX,e.clientY);renderer.domElement.style.cursor='grabbing';}
});
renderer.domElement.addEventListener('pointermove',e=>{pointerPx.set(e.clientX,e.clientY);pointerInside=true;if(rightMouseHeld&&performance.now()-lastMoveIssueMs>=HOLD_MOVE_INTERVAL_MS){lastMoveIssueMs=performance.now();if(!pickEnemy(e.clientX,e.clientY))issueMoveFromScreen(e.clientX,e.clientY,false);}if(middleDragging){const dx=e.clientX-lastMiddle.x,dy=e.clientY-lastMiddle.y;lastMiddle.set(e.clientX,e.clientY);const {forward,right}=cameraBasisOnGround();const w=CAMERA_DISTANCE*cameraSettings.zoom/1100;cameraFocus.addScaledVector(right,-dx*w);cameraFocus.addScaledVector(forward,dy*w);clampFocus();}});
renderer.domElement.addEventListener('pointerenter',()=>pointerInside=true);renderer.domElement.addEventListener('pointerleave',()=>pointerInside=false);renderer.domElement.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
window.addEventListener('pointerup',e=>{if(e.button===2)rightMouseHeld=false;if(e.button===1){middleDragging=false;renderer.domElement.style.cursor='';}});
window.addEventListener('blur',()=>{rightMouseHeld=false;middleDragging=false;renderer.domElement.style.cursor='';});
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();const factor=e.deltaY>0?1.10:.90;cameraSettings.zoom=THREE.MathUtils.clamp(cameraSettings.zoom*factor,cameraSettings.minZoom,cameraSettings.maxZoom);},{passive:false});

window.addEventListener('keydown',e=>{
  if(e.code==='Space'){e.preventDefault();if(!spaceHeld)cameraFocus.copy(player.position);spaceHeld=true;}
  if(e.code==='KeyY'&&!e.repeat){cameraLocked=!cameraLocked;if(cameraLocked)cameraFocus.copy(player.position);}
  if(e.code==='KeyS'&&!e.repeat){e.preventDefault();issueStop();}
  if(e.code==='KeyA'&&!e.repeat){e.preventDefault();attackMoveArmed=true;rangeRing.visible=true;toast('Attack Move armed','info');}
  if(e.code==='KeyD'&&!e.repeat){e.preventDefault();cycleDifficulty();}
  if(e.code==='KeyR'&&!e.repeat&&mode!==MODE.FREE){e.preventDefault();setMode(mode);}
  if(!e.repeat){if(e.code==='Digit1'||e.code==='KeyK')setMode(MODE.KITE);if(e.code==='Digit2')setMode(MODE.TARGET);if(e.code==='Digit3')setMode(MODE.SPACING);if(e.code==='Digit4')setMode(MODE.DODGE);if(e.code==='Digit5')setMode(MODE.CS);if(e.code==='Digit6')setMode(MODE.COMBINED);if(e.code==='Escape')setMode(MODE.FREE);}
});
window.addEventListener('keyup',e=>{if(e.code==='Space')spaceHeld=false;});

function animate(ms){
  const now=ms/1000,dt=Math.min(.05,(ms-lastTime)/1000||0);lastTime=ms;
  updateOrder(dt,now);updateProjectiles(dt,now);respawnEnemies(now);updateKiteMode(dt,now);updateTargetMode(dt);updateSpacingMode(dt,now);updateDodgeMode(dt);updateCsMode(dt,now);updateModeTimer(dt);updateVisuals(dt);updateCameraMotion(dt);updateCameraTransform();updateHud(now);renderer.render(scene,camera);requestAnimationFrame(animate);
}

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
updateCameraTransform();updateHud(0);requestAnimationFrame(animate);
