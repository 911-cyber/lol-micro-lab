// Deterministic integration tests; actual Three.js math/scene objects, stubbed renderer/DOM.
// node --experimental-vm-modules tests/lane.test.cjs /path/to/three.module.js [baseline-main.js]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '..');

class Element {
  constructor() { this.handlers = {}; this.style = {}; this.textContent = ''; this.innerHTML = ''; this.className = ''; }
  addEventListener(type, f) { (this.handlers[type] ??= []).push(f); }
  dispatchEvent(e) { e.preventDefault ??= () => {}; for (const f of this.handlers[e.type] || []) f(e); }
  appendChild() {}
  setAttribute() {}
  focus() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 800 }; }
  get classList() { return { add: v => this.className = v, remove: () => this.className = '', contains: v => this.className === v }; }
}

async function game(THREE, baseline) {
  let time = 1000, frame, seed = 123456;
  const dom = new Map(), win = new Element();
  const math = Object.create(Math);
  math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const store = new Map();
  const context = vm.createContext({ console, Math: math, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    URL,AbortController,fetch:async()=>({ok:true,json:async()=>({connected:false})}),
    window: win, document: { querySelectorAll:()=>[],querySelector: s => { if (!dom.has(s)) dom.set(s, new Element()); return dom.get(s); } },
    performance: { now: () => time }, Date: { now: () => 1700000000000 + time },
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    requestAnimationFrame: f => frame = f, addEventListener: win.addEventListener.bind(win) });
  class Renderer { constructor() { this.domElement = new Element(); this.shadowMap = {}; } setPixelRatio() {} setSize() {} render(scene, camera) { scene.updateMatrixWorld(); camera.updateMatrixWorld(); } }
  const namespace = { ...THREE, WebGLRenderer: Renderer, MathUtils: { ...THREE.MathUtils, randFloat: (a,b) => a + math.random() * (b-a) } };
  const three = new vm.SyntheticModule(Object.keys(namespace), function() { for (const [k,v] of Object.entries(namespace)) this.setExport(k,v); }, { context });
  const cache = new Map();
  function load(file) { if (!cache.has(file)) cache.set(file, new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { context, identifier: file })); return cache.get(file); }
  const linker = (specifier, referencing) => specifier === 'three' ? three : load(path.resolve(path.dirname(referencing.identifier), specifier));
  let s;
  if (baseline) {
    const names = ['player','camera','cameraFocus','cameraLocked','spaceHeld','renderer','scene','order','mode','MODE','modeData','enemies','alliedMinions','projectiles','minionProjectiles','skillshots','hits','cancels','cs','missedCs','dodges','cleanKites','score','playerHp','difficultyIndex','attackState'];
    const entry = new vm.SourceTextModule(fs.readFileSync(baseline,'utf8')+'\nglobalThis.probe={'+names.map(n=>`get ${n}(){return ${n}}`).join(',')+'};', {context, identifier: path.join(root,'main.js')});
    await entry.link(linker); await entry.evaluate(); s = context.probe;
  } else {
    const entry = load(path.join(root,'main.js')); await entry.link(linker); await entry.evaluate(); s = load(path.join(root,'src/state.js')).namespace.state;
  }
  const api = { s, dom, store, now: () => time / 1000, key: code => win.dispatchEvent({type:'keydown',code}), tick(n=1) { for(let i=0;i<n;i++){time+=50;frame(time);} },
    pointer(world, button=2, shiftKey=false) { const screen=new THREE.Vector3(...world).project(s.camera);s.renderer.domElement.dispatchEvent({type:'pointerdown',clientX:(screen.x+1)*640,clientY:(1-screen.y)*400,button,shiftKey});win.dispatchEvent({type:'pointerup',button}); },
    release: code => win.dispatchEvent({type:'keyup',code}),
    async call(file, name, ...args) { const m = load(path.join(root,'src',file+'.js')); if(m.status==='unlinked')await m.link(linker); if(m.status==='linked')await m.evaluate(); return m.namespace[name](...args); } };
  if(!baseline)await api.call('lobby','launchTraining');
  api.tick(); return api;
}

const snapshot = g => JSON.parse(JSON.stringify({ mode:g.s.mode, order:g.s.order.type, player:g.s.player.position.toArray(), camera:g.s.camera.position.toArray(), hp:g.s.playerHp,
  stats:['hits','cancels','cs','missedCs','dodges','cleanKites','score','difficultyIndex','attackState'].map(k=>g.s[k]), modeData:g.s.modeData,
  units:[...g.s.enemies,...g.s.alliedMinions].map(e=>({hp:e.hp,alive:e.alive,pos:e.group.position.toArray(),visible:e.group.visible,bar:e.hpBar&&{visible:e.hpBar.root.visible,width:e.hpBar.fill.scale.x,color:e.hpBar.fillMat.color.getHex()}})),
  result:['#resultGrade','#resultTitle','#resultScore','#resultStats','#resultDiagnosis'].map(k=>({text:g.dom.get(k).textContent,html:g.dom.get(k).innerHTML})), history:g.store.get('lolMicroLabResults') }));

module.exports={game};
if(require.main===module)(async()=>{
  if (!process.argv[2]) throw Error('Pass a local Three.js 0.180.0 three.module.js path.');
  const THREE = await import(pathToFileURL(path.resolve(process.argv[2])));
  const checks=[];
  function pass(name){checks.push(name);console.log('PASS',name);}
  if(process.argv[3]){
    const before=await game(THREE,path.resolve(process.argv[3])),after=await game(THREE);
    for(const g of [before,after])g.pointer([0,0,4]);for(const g of [before,after])g.tick(15);assert.deepEqual(snapshot(after),snapshot(before));
    for(const g of [before,after]){g.key('KeyS');g.tick(5);g.pointer([8,.8,-2]);g.tick(65);}assert.deepEqual(snapshot(after),snapshot(before));assert(after.s.hits>0);
    for(const g of [before,after]){g.key('KeyA');g.pointer([8,.8,-2],0);g.tick(35);g.pointer([8,.8,-2],2,true);g.tick(35);g.key('Space');g.tick(2);g.release('Space');g.key('KeyY');g.tick(2);g.key('KeyY');g.key('KeyH');}assert.deepEqual(snapshot(after),snapshot(before));
    pass('RMB movement/AA, stop, both attack moves, Space/Y and difficulty match baseline');
    for(let mode=1;mode<=6;mode++) { for(const g of [before,after])g.key('Digit'+mode); for(let n=0;n<12;n++){for(const g of [before,after])g.tick(80);assert.deepEqual(snapshot(after),snapshot(before),`mode ${mode}, checkpoint ${n}`);} }
    pass('72 existing-mode state/result/HP-bar comparisons against baseline');
  }
  const g=await game(THREE),s=g.s;
  const start=()=>g.key('Digit7');
  start();assert.equal(s.mode,'LANE');assert.equal(s.enemies.filter(e=>e.type==='minion').length,6);assert.equal(s.alliedMinions.length,6);assert(s.mainDummy.hpBar.root.visible);assert.equal(s.modeData.time,45);pass('7 starts lane, champion and 6-v-6 minions with HP bars');
  g.tick(100);assert(s.enemies.slice(1).some(e=>e.hp<e.maxHp));assert(s.alliedMinions.some(e=>e.hp<e.maxHp));pass('both teams fight in Lane Phase');
  function warning(){s.player.position.set(0,0,0);s.mainDummy.group.position.set(7,0,0);s.laneData.nextAttack=0;g.tick();assert(s.laneData.warning);return s.laneData.warning;}
  start();let w=warning();const direction=w.direction.clone();s.player.position.z=3;g.tick(45);assert(s.laneMetrics.dodged>0);assert.equal(s.laneMetrics.hit,0);assert.equal(s.playerHp,100);assert(direction.z===0);pass('locked telegraph can be dodged by moving sideways');
  start();warning();g.tick(50);assert(s.laneMetrics.hit>0);assert(s.playerHp<100);pass('standing in aimed shot causes damage and hit count');
  for(let difficulty=0;difficulty<3;difficulty++){start();s.difficultyIndex=difficulty;w=warning();assert.equal(w.config.windup,[.75,.55,.4][difficulty]);assert.equal(w.config.damage,[8,10,12][difficulty]);}pass('difficulty changes only lane attack tuning');
  start();warning();const warningMesh=s.laneData.warning.mesh;g.key('KeyT');assert(!s.scene.children.includes(warningMesh));assert.equal(s.laneData.warning,null);assert.equal(s.laneMetrics.hit,0);pass('restart clears warning and counters');
  warning();g.tick(12);const shots=s.laneData.shots.map(p=>p.mesh),bar=s.mainDummy.hpBar.root;g.key('Digit5');assert.equal(s.laneData,null);assert(!s.scene.children.includes(bar));assert(shots.every(p=>!s.scene.children.includes(p)));assert.equal(s.enemies.filter(e=>e.type==='champion').length,0);pass('switching back to CS removes opponent HP bar and harass');
  start();const champ=s.mainDummy;await g.call('combat','damageEnemy',champ,700,g.now(),true);const wave=s.modeData.wave;for(const e of s.enemies.slice(1))e.alive=false;g.tick();assert.equal(s.modeData.wave,wave+1);assert.equal(champ.alive,false);assert.equal(s.enemies[0],champ);pass('wave respawn preserves opponent and does not revive minions');
  g.tick(65);assert(champ.alive);assert.equal(champ.hp,700);assert(champ.hpBar.root.visible);pass('opponent respawns with HP bar after a three-second respite');
  start();const target=s.enemies[1];target.hp=70;await g.call('combat','damageEnemy',target,70,1,true);assert.equal(s.cs,1);pass('lane last hits award CS');
  start();await g.call('minions','damageLaneUnit',s.enemies[1],320,g.now(),'ally');assert.equal(s.missedCs,1);assert.equal(s.cs,0);assert.equal(s.enemies[1].hpBar.root.visible,false);pass('allied minion kills count as missed CS');
  start();s.player.position.set(0,0,0);s.mainDummy.group.position.set(10,0,3);s.laneData.nextAttack=Infinity;const mesh=new THREE.Mesh(new THREE.SphereGeometry(.22),new THREE.MeshBasicMaterial());mesh.position.set(-1,.35,0);s.scene.add(mesh);s.laneData.shots.push({mesh,direction:new THREE.Vector3(1,0,0),config:{speed:40,damage:10},traveled:0});g.tick();assert.equal(s.playerHp,90);assert.equal(s.laneData.shots.length,0);pass('swept collision catches shots crossing the player on a slow frame');
  start();warning();s.playerHp=0;g.tick();assert.equal(s.mode,'FREE');assert(g.dom.get('#resultPanel').classList.contains('show'));assert.equal(g.dom.get('#resultTitle').textContent,'LANE');assert.equal(s.laneData,null);pass('death ends lane and shows result with cleanup');
  start();s.cs=8;s.missedCs=2;s.laneMetrics={fired:5,hit:1,dodged:4,damage:10};s.playerHp=90;s.modeData.time=.01;g.tick();assert.equal(s.mode,'FREE');assert(g.dom.get('#resultStats').innerHTML.includes('HARASS HIT'));assert(g.store.get('lolMicroLabResults').includes('LANE'));pass('timer completion saves lane-specific CS/harass/HP result');
  start();g.key('Escape');assert(s.menuOpen);const remaining=s.modeData.time;g.tick(100);assert.equal(s.modeData.time,remaining);await g.call('lobby','launchTraining');assert(!s.menuOpen);pass('Escape opens selection and pauses simulation; launch resets the session');
  // No-CS sessions cannot score highly by standing out of range.
  start();s.modeData.time=.01;g.tick();assert(g.dom.get('#resultScore').textContent.includes('PERFORMANCE 0/100'));pass('zero-CS session scores zero');
  fs.writeFileSync(path.join(root,'LANE-TEST-RESULTS.json'),JSON.stringify({checks,renderer:'stubbed; actual Three.js math and scene graph',passed:checks.length},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});

