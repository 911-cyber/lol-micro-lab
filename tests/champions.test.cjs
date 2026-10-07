// Run with node --experimental-vm-modules and the cached Three.js module path.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {pathToFileURL}=require('url');const {game}=require('./lane.test.cjs');
(async()=>{
 const THREE=await import(pathToFileURL(path.resolve(process.argv[2])));
 const g=await game(THREE),s=g.s,checks=[];
 const pass=name=>{checks.push(name);console.log('PASS',name);};
 const ids=['Ashe','Caitlyn','Jinx','Jhin','Ezreal','Lucian','Vayne','MissFortune','Varus','Kaisa'];
 for(const id of ids){
  s.lobbyChampion=id;s.lobbyMode='FREE';await g.call('lobby','launchTraining');
  assert.equal(s.player.userData.profile,id);assert.equal(s.ATTACK_RANGE,s.selectedChampion.range*.01);
  assert.equal(s.ATTACK_INTERVAL,1/s.selectedChampion.as);
  s.mainDummy.group.position.copy(s.player.position).add(new THREE.Vector3(3,0,0));
  await g.call('combat','issueAttack',s.mainDummy);g.tick(30);
  assert(s.hits>0,id+' launches a real AA');assert(s.mainDummy.hp<700);
  assert.equal(g.dom.get('#playChampion').textContent,s.selectedChampion.name);
 }
 pass('all ten selected champions render rigs, apply profiles and land real AA damage');
 s.lobbyChampion='Jhin';await g.call('lobby','launchTraining');
 s.mainDummy.group.position.copy(s.player.position).add(new THREE.Vector3(3,0,0));
 await g.call('combat','issueAttack',s.mainDummy);
 for(let i=0;i<300&&s.championShots<4;i++)g.tick();
 assert.equal(s.championShots,4);assert.equal(s.projectiles.at(-1).damage,61*1.5);
 const shots=s.championShots;g.tick(40);assert.equal(s.championShots,shots);assert(s.reloadUntil>g.now());
 g.tick(25);assert(s.championShots>4);pass('Jhin fourth shot, 2.5-second reload and resumed firing');
 for(const id of ids)for(const mode of ['KITE','TARGET','SPACING','DODGE','CS','COMBINED','LANE']){
  s.lobbyChampion=id;s.lobbyMode=mode;await g.call('lobby','launchTraining');assert.equal(s.mode,mode);
  g.tick(20);assert(s.arenaBounds);assert(Number.isFinite(s.player.position.x));
  if(mode==='CS'||mode==='LANE'){assert.equal(s.alliedMinions.length,6);assert.equal(s.enemies.filter(e=>e.type==='minion').length,6);assert(s.enemies.find(e=>e.type==='minion').hpBar.root.visible);}
  s.modeData.time=.01;g.tick();assert.equal(s.mode,'FREE');assert(s.resultPanel.classList.contains('show'));assert.equal(g.dom.get('#resultTitle').textContent,mode);
 }
 pass('70 champion/mode combinations start, simulate and finish with results; CS retains 6-v-6 and HP bars');
 s.lobbyChampion='Ashe';s.lobbyMode='FREE';await g.call('lobby','launchTraining');
 const original=s.player.position.clone();g.pointer([0,0,4]);g.tick(12);assert(s.player.position.distanceTo(original)>.5);
 g.key('KeyS');assert.equal(s.order.type,'idle');
 s.mainDummy.group.position.copy(s.player.position).add(new THREE.Vector3(3,0,0));
 g.key('KeyA');g.pointer(s.mainDummy.group.position.toArray(),0);g.tick(30);assert(s.hits>0);
 g.pointer(s.mainDummy.group.position.toArray(),2,true);assert.equal(s.order.type,'attackMove');
 g.key('Space');assert(s.spaceHeld);g.release('Space');assert(!s.spaceHeld);
 const lock=s.cameraLocked;g.key('KeyY');assert.equal(s.cameraLocked,!lock);
 const difficulty=s.difficultyIndex;g.key('KeyD');assert.equal(s.difficultyIndex,(difficulty+1)%3);
 pass('RMB movement, stop, A+LMB, Shift+RMB, Space/Y and difficulty work with champion rigs');
 await g.call('player','issueMovePoint',new THREE.Vector3(100,0,100));g.tick(400);
 assert(s.player.position.x<=s.arenaBounds.maxX);assert(s.player.position.z<=s.arenaBounds.maxZ);
 pass('arena walls contain movement');
 s.lobbyMode='KITE';await g.call('lobby','launchTraining');g.key('KeyR');assert.equal(s.modeData.time,30);
 g.key('Escape');const hp=s.playerHp,time=s.modeData.time;g.tick(500);assert.equal(s.playerHp,hp);assert.equal(s.modeData.time,time);
 await g.call('lobby','launchTraining');assert(!s.menuOpen);assert.equal(s.modeData.time,30);
 pass('restart, paused menu and launching a fresh session');
 s.coachEnabled=true;s.cancels=4;s.hits=2;assert((await g.call('coach','coachingAdvice')).includes('4回'));
 s.menuOpen=true;s.lobbyChampion='Caitlyn';s.lobbyMode='CS';const context=await g.call('coach','coachContext');assert.equal(context.champion,'Caitlyn');assert.equal(context.range,650);assert.equal(context.mode,'CS');assert.equal(context.hits,undefined);
 pass('local advice uses actual counters; lobby AI context uses selection, not previous play');
 fs.writeFileSync(path.join(__dirname,'../CHAMPION-TEST-RESULTS.json'),JSON.stringify({checks,combinations:70,champions:10,renderer:'stubbed renderer; actual Three.js math and scene graph'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
