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

async function game(THREE, baseline, options = {}) {
  let time = 1000, frame, seed = 123456;
  const dom = new Map(), win = new Element();
  if(options.AudioContext)win.AudioContext=options.AudioContext;
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
  const api = { s, dom, store, now: () => time / 1000, key: (code,options={}) => win.dispatchEvent({type:'keydown',code,...options}), tick(n=1) { for(let i=0;i<n;i++){time+=50;frame(time);} },
    pointer(world, button=2, shiftKey=false) { const screen=new THREE.Vector3(...world).project(s.camera);s.renderer.domElement.dispatchEvent({type:'pointerdown',clientX:(screen.x+1)*640,clientY:(1-screen.y)*400,button,shiftKey});win.dispatchEvent({type:'pointerup',button}); },
    release: (code,options={}) => win.dispatchEvent({type:'keyup',code,...options}), event: e=>win.dispatchEvent(e),
    async call(file, name, ...args) { const m = load(path.join(root,'src',file+'.js')); if(m.status==='unlinked')await m.link(linker); if(m.status==='linked')await m.evaluate(); return m.namespace[name](...args); } };
  if(!baseline)await api.call('lobby','launchTraining');
  api.tick(); return api;
}


module.exports={game};
