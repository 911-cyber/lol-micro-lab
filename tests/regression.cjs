const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const root=path.resolve(__dirname,'..');
const original=require('child_process').execFileSync('git',['show','f475a6618df3beb2b96bf3bceeaa5900ee4799d9:main.js'],{cwd:root,encoding:'utf8'});
const scratch=fs.mkdtempSync(path.join(require('os').tmpdir(),'lol-micro-regression-'));
console.log('Test artifacts:',scratch);
const names=['player','renderer','scene','camera','cameraFocus','cameraSettings','order','modeData','enemies','alliedMinions','projectiles','minionProjectiles','skillshots','mode','difficultyIndex','attackState','windupEnd','nextAttackReady','hits','cancels','cleanKites','dodges','cs','missedCs','score','playerHp','targetSwitches','skillshotsFired','skillshotsHit','sessionDuration','cameraLocked','spaceHeld','rightMouseHeld','attackMoveArmed','markerLife','targetFlash'];
const server=http.createServer((req,res)=>{
 const u=decodeURIComponent(req.url);let body,type='text/javascript';
 if(u.startsWith('/three/'))body=fs.readFileSync(path.join(scratch,path.basename(u)));
 else{const match=u.match(/^\/(before|after)\/lol-micro-lab\/(.*)$/);if(!match){res.writeHead(404);return res.end();}const [,version,file]=match;
  if(file==='main.js'&&version==='before')body=original+'\nglobalThis.__probe={'+names.map(n=>`get ${n}(){return ${n}}`).join(',')+'};';
  else{const p=path.join(root,file||'index.html');if(!fs.existsSync(p)){res.writeHead(404);return res.end();}body=fs.readFileSync(p);}
  if(file==='main.js'&&version==='after')body+='\nimport {state} from "./src/state.js";globalThis.__probe=state;';
  if(file.endsWith('.html')){type='text/html';body=body.toString().replace('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js','/three/three.module.js');}
  if(file.endsWith('.css'))type='text/css';
 }res.setHeader('Content-Type',type);res.end(body);
});
(async()=>{
 for(const name of ['three.module.js','three.core.js']){const response=await fetch('https://cdn.jsdelivr.net/npm/three@0.180.0/build/'+name);if(!response.ok)throw Error('Three download: '+response.status);fs.writeFileSync(path.join(scratch,name),await response.text());}
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true,args:['--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
 const pages=[];const errors=[];
 for(const version of ['before','after']){const p=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});p.on('pageerror',e=>errors.push(version+': '+e.message));p.on('response',r=>{if(r.status()>=400)errors.push(version+': HTTP '+r.status()+' '+r.url());});
 await p.addInitScript(()=>{let seed=123456;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};globalThis.__time=1000;performance.now=()=>__time;Date.now=()=>1700000000000+__time;requestAnimationFrame=f=>(globalThis.__frame=f,1);});
 await p.goto(`http://127.0.0.1:${port}/${version}/lol-micro-lab/index.html`);await p.waitForFunction(()=>globalThis.__probe&&globalThis.__frame);
 await p.evaluate(()=>{const s=__probe;globalThis.__render=s.renderer.render.bind(s.renderer);s.renderer.render=(scene,camera)=>{scene.updateMatrixWorld();camera.updateMatrixWorld();};});pages.push(p);}
 const snapshots=[];
 async function both(fn,arg){for(const p of pages)await p.evaluate(fn,arg);}
 async function tick(n){await both(n=>{for(let i=0;i<n;i++){__time+=50;__frame(__time);}},n);}
 async function key(code,up=false){await both(({code,up})=>window.dispatchEvent(new KeyboardEvent(up?'keyup':'keydown',{code,bubbles:true,cancelable:true})),{code,up});}
 async function mouse(spec){await both(spec=>{const s=__probe;let x=spec.x,y=spec.y;if(spec.world||spec.enemy){const v=spec.enemy?(spec.enemy==='living'?s.enemies.find(e=>e.type==='minion'&&e.alive):s.enemies[spec.enemy-1]).group.position.clone().setY(.8):s.player.position.clone().set(...spec.world);v.project(s.camera);x=(v.x+1)*innerWidth/2;y=(1-v.y)*innerHeight/2;}s.renderer.domElement.dispatchEvent(new PointerEvent(spec.type||'pointerdown',{clientX:x,clientY:y,button:spec.button??2,shiftKey:!!spec.shift,bubbles:true,cancelable:true}));if(!spec.hold)window.dispatchEvent(new PointerEvent('pointerup',{button:spec.button??2,bubbles:true}));},spec);}
 async function check(label,visual=false){const values=[];for(const p of pages)values.push(await p.evaluate(()=>{
 const s=__probe;const vec=v=>v&&v.toArray();const unit=u=>({name:u.name,hp:u.hp,maxHp:u.maxHp,alive:u.alive,position:vec(u.group.position),rotation:u.group.rotation.toArray(),visible:u.group.visible,nextAttack:u.nextAttack,hpBar:u.hpBar&&{visible:u.hpBar.root.visible,pos:vec(u.hpBar.root.position),scale:vec(u.hpBar.fill.scale),offset:vec(u.hpBar.fill.position),color:u.hpBar.fillMat.color.getHex()},indicator:u.lastHitIndicator&&u.lastHitIndicator.visible});
 const scalars={};for(const n of ['mode','difficultyIndex','attackState','windupEnd','nextAttackReady','hits','cancels','cleanKites','dodges','cs','missedCs','score','playerHp','targetSwitches','skillshotsFired','skillshotsHit','sessionDuration','cameraLocked','spaceHeld','rightMouseHeld','attackMoveArmed','markerLife','targetFlash'])scalars[n]=s[n];
 return {scalars,player:vec(s.player.position),rotation:s.player.rotation.toArray(),camera:vec(s.camera.position),focus:vec(s.cameraFocus),zoom:s.cameraSettings.zoom,order:{type:s.order.type,point:vec(s.order.point),target:s.order.target?.name},modeData:{...s.modeData},enemies:s.enemies.map(unit),allies:s.alliedMinions.map(unit),projectiles:s.projectiles.map(p=>({pos:vec(p.mesh.position),target:p.target.name})),minionProjectiles:s.minionProjectiles.map(p=>({pos:vec(p.mesh.position),target:p.target.name,damage:p.damage})),skillshots:s.skillshots.map(p=>({pos:vec(p.mesh.position),vel:vec(p.vel),life:p.life})),hud:document.querySelector('#hud').innerHTML,history:localStorage.getItem('lolMicroLabResults')};
 }));assert.deepStrictEqual(values[1],values[0],label);snapshots.push(label);
 if(visual){await both(()=>__render(__probe.scene,__probe.camera));const imgs=[];for(let i=0;i<pages.length;i++)imgs.push(PNG.sync.read(await pages[i].screenshot({animations:'disabled',style:'* { transition: none !important; animation: none !important; }',path:path.join(scratch,`${label}-${i}.png`)})));let max=0;for(let i=0;i<imgs[0].data.length;i++)max=Math.max(max,Math.abs(imgs[0].data[i]-imgs[1].data[i]));assert(max<=1,label+' screenshot mismatch, maximum channel delta '+max);}console.log('PASS',label);}
 await tick(1);await check('initial',true);
 await mouse({world:[0,0,4]});await tick(15);await check('RMB-movement');await key('KeyS');await tick(5);await check('S-stop');
 await mouse({enemy:1});await tick(65);await check('AA-projectile-hit');
 await key('KeyA');await mouse({enemy:1,button:0});await tick(35);await check('A-LMB-attack-move');
 await mouse({enemy:1,shift:true});await tick(35);await check('shift-RMB-attack-move');
 await key('Space');await tick(2);await check('Space-camera');await key('Space',true);await key('KeyY');await tick(2);await check('Y-lock');await key('KeyY');
 await mouse({x:0,y:400,type:'pointermove',button:0});await tick(10);await check('edge-scroll');
 await mouse({x:600,y:400,button:1,hold:true});await mouse({x:650,y:440,type:'pointermove',button:1});await tick(1);await check('middle-drag');
 await both(()=>__probe.renderer.domElement.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,cancelable:true})));await tick(1);await check('wheel-zoom');
 for(let i=0;i<3;i++){await key('KeyD');await tick(1);await check('difficulty-'+i);}
 for(let mode=1;mode<=6;mode++){await key('Digit'+mode);await tick(1);await check('mode-'+mode+'-start',true);await tick(80);await check('mode-'+mode+'-combat');
 if(mode===5){for(const p of pages)assert(await p.evaluate(()=>__probe.enemies.slice(1).some(e=>e.hp<e.maxHp)&&__probe.alliedMinions.some(e=>e.hp<e.maxHp)),'Minions must damage both teams');
 await both(()=>{const s=__probe,e=s.enemies.find(e=>e.type==='minion'&&e.alive);for(const u of [...s.enemies,...s.alliedMinions])if(u!==e)u.group.position.set(20,0,15);e.group.position.set(0,0,0);s.player.position.set(-2,0,0);s.cameraFocus.copy(s.player.position);e.hp=70;for(const u of [...s.enemies,...s.alliedMinions])u.nextAttack=Infinity;s.minionProjectiles.splice(0).forEach(p=>s.scene.remove(p.mesh));});await tick(1);await mouse({enemy:'living'});await tick(20);await check('CS-player-last-hit',true);for(const p of pages)assert(await p.evaluate(()=>__probe.cs>0),'Player last hit must count');}
 await key('KeyR');await tick(1);await check('mode-'+mode+'-restart');await tick(mode===5?902:mode===6?802:602);await check('mode-'+mode+'-result',true);}
 await key('Escape');await tick(1);await check('escape-free');
 assert.deepStrictEqual(errors,[]);fs.writeFileSync(path.join(scratch,'verification.json'),JSON.stringify({checks:snapshots,errors,visual:'Screenshots at initial, six mode starts, six results and CS last hit; maximum allowed channel difference 1/255 (browser compositing rounding); CSS transitions disabled only during capture.',base:'f475a66',method:'Same seeded random values, 50ms simulated frames, DOM input events, exact runtime state and HUD comparison. Actual Three.js 0.180.0; rendering at screenshot checkpoints, matrix updates on intermediate frames.'},null,2));
 await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1)});




