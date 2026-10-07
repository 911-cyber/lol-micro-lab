const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {pathToFileURL}=require('url');const {game}=require('./lane.test.cjs');
(async()=>{
 const THREE=await import(pathToFileURL(path.resolve(process.argv[2]))),checks=[];
 let contexts=0,voices=0,stops=0;
 const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};
 class AudioContext {constructor(){contexts++;this.state='running';this.currentTime=1;}createOscillator(){return {frequency:param,connect(){},start(){voices++;},stop(){stops++;}};}createGain(){return {gain:param,connect(){}};}}
 const g=await game(THREE,null,{AudioContext}),s=g.s;
 const pass=name=>{checks.push(name);console.log('PASS',name);};
 const launch=async(id,mode='FREE')=>{s.lobbyChampion=id;s.lobbyMode=mode;await g.call('lobby','launchTraining');s.modeData.time=200;};
 assert.equal(contexts,0);await g.call('presentation','playCue','Ashe');assert.equal(voices,0);
 await g.call('presentation','unlockSound');assert.equal(contexts,1);await g.call('presentation','playCue','Ashe');assert.equal(voices,1);await g.call('presentation','playCue','Ashe');assert.equal(voices,1);
 g.dom.get('#soundToggle').dispatchEvent({type:'click'});await g.call('presentation','playCue','Ezreal');assert.equal(voices,1);assert.equal(g.dom.get('#soundToggle').textContent,'音 OFF');g.dom.get('#soundToggle').dispatchEvent({type:'click'});assert.equal(contexts,1);assert.equal(stops,voices);
 pass('sound waits for a gesture, limits duplicate fan cues, supports mute and schedules voice cleanup');
 for(const id of ['Ashe','Ezreal']){
  await launch(id);s.mainDummy.group.position.copy(s.player.position).add(new THREE.Vector3(3,0,0));
  const now=g.now(),interval=s.ATTACK_INTERVAL,windup=s.WINDUP_TIME;await g.call('combat','startAttack',s.mainDummy,now);
  assert.equal(s.player.userData.action.phase,'windup');assert.equal(s.windupEnd,now+windup);assert.equal(s.nextAttackReady,now+interval);g.tick();assert(s.player.userData.arms[0].rotation.x<-.5);
  await g.call('player','issueStop');assert.equal(s.player.userData.action,undefined);assert.equal(s.projectiles.length,0);assert.equal(s.cancels,1);
  await g.call('combat','issueAttack',s.mainDummy);for(let i=0;i<12&&!s.projectiles.length;i++)g.tick();assert.equal(s.player.userData.action.phase,'release');assert(s.projectiles[0].mesh.userData.signature);const releasedAt=s.lastShotAt;
  await g.call('player','issueMovePoint',s.player.position.clone().add(new THREE.Vector3(0,0,2)));assert.equal(s.cancels,1);assert.equal(s.cleanKites,1);g.tick(8);assert(s.hits>0);assert(s.lastShotAt===releasedAt);
 }
 pass('Ashe/Ezreal draw, release and cancel visuals follow real AA timing; moving after release preserves damage and clean kite');
 await launch('Ezreal');await g.call('abilities','castSkill','R',s.player.position.clone().add(new THREE.Vector3(5,0,0)),g.now());assert.equal(s.abilities.shots.length,0);assert.equal(s.player.userData.action.phase,'windup');g.tick(10);assert.equal(s.abilities.shots.length,0);g.tick(12);assert.equal(s.abilities.shots[0].mesh.visible,true);assert.equal(s.abilities.shots[0].mesh.userData.signature.key,'R');
 pass('Ezreal ultimate charges before its visible wave releases');
 await launch('Ashe');await g.call('abilities','castSkill','W',s.player.position.clone().add(new THREE.Vector3(5,0,0)),g.now());g.tick(6);assert.equal(s.abilities.shots.length,9);assert(s.abilities.shots.every(p=>p.mesh.userData.signature.key==='W'));g.tick(20);assert(!s.scene.children.some(e=>e.userData.transient));
 await g.call('presentation','burst',s.player.position,'Ashe');assert(s.scene.children.some(e=>e.userData.transient));await launch('Ezreal');assert(!s.scene.children.some(e=>e.userData.transient));
 pass('Ashe fan has distinct ice arrows; short effects expire and restart removes remaining effects');
 await launch('Ezreal','DODGE');s.opponents.next=Infinity;s.opponents.rotation=Infinity;const enemy=s.opponents.casters[0];enemy.group.position.copy(s.player.position).add(new THREE.Vector3(9,0,0));const before=enemy.group.position.clone();g.tick(5);assert(enemy.group.position.distanceTo(before)>.01);
 s.opponents.next=0;g.tick();s.opponents.next=Infinity;const cast=s.opponents.casts[0];assert(cast.warning);const origin=enemy.group.position.clone();g.tick(5);assert(enemy.group.position.distanceTo(origin)<1e-9);assert.equal(enemy.group.userData.action.phase,'windup');assert(cast.origin.clone().setY(0).distanceTo(origin)<1e-9);g.tick(15);assert(!cast.warning);assert(cast.shots.length>0);
 pass('opponents strafe between casts and plant their feet at the locked projectile origin during windup');
 fs.writeFileSync(path.join(__dirname,'../PRESENTATION-TEST-RESULTS.json'),JSON.stringify({checks,renderer:'stubbed renderer; real Three.js scene/math',audio:'mocked Web Audio scheduling; browser sound quality requires listening'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
