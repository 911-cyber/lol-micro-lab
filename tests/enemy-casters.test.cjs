const assert=require('assert/strict'),fs=require('fs'),path=require('path');const {pathToFileURL}=require('url');const {game}=require('./lane.test.cjs');
(async()=>{
 const THREE=await import(pathToFileURL(path.resolve(process.argv[2]))),g=await game(THREE),s=g.s,checks=[];
 const pass=name=>{checks.push(name);console.log('PASS',name);};
 const launch=async(mode='DODGE',difficulty=0)=>{s.difficultyIndex=difficulty;s.lobbyChampion='Ezreal';s.lobbyMode=mode;await g.call('lobby','launchTraining');s.player.position.set(0,0,0);s.modeData.time=300;return s.opponents.casters[0];};
 for(let difficulty=0;difficulty<3;difficulty++){await launch('DODGE',difficulty);assert.equal(s.opponents.casters.length,difficulty+1);for(const e of s.opponents.casters){assert.equal(e.group.userData.profile,e.castProfile);assert(e.hpBar.root.visible);}}
 pass('easy/normal/hard spawn one/two/three real champion rigs with HP bars');
 for(const id of ['Ezreal','Ashe','Jinx','Varus','Caitlyn','Jhin','Kaisa','MissFortune','Lucian']){
  const e=await launch();e.castProfile=id;await g.call('entities','setEnemyAppearance',e,id);e.group.position.set(10,0,0);s.opponents.next=0;s.opponents.rotation=Infinity;g.tick();const warning=s.opponents.casts[0];assert(warning.warning);assert.equal(warning.id,id);assert(g.dom.get('#enemyCast').textContent.includes(warning.profile.key));
  // The target point is fixed during windup; moving sideways must evade each pattern.
  s.opponents.next=Infinity;s.player.position.z=6;g.tick(125);assert(s.dodges>=1,id+' dodge');assert.equal(s.skillshotsHit,0,id+' locked target');assert.equal(s.playerHp,100);
 }
 pass('nine champion spells telegraph from their actor and can be evaded by sideways movement');
 const e=await launch();e.castProfile='Ezreal';e.group.position.set(10,0,0);s.opponents.next=0;s.opponents.rotation=Infinity;g.tick(40);assert(s.skillshotsHit>0);assert(s.playerHp<100);pass('standing in an aimed spell causes damage and a recorded hit');
 await launch('DODGE',1);s.playerHp=100000;const seen=new Set();for(let i=0;i<1600;i++){g.tick();for(const e of s.opponents.casters)seen.add(e.castProfile);}assert(seen.size>=7);pass('champion rotation changes skill patterns throughout a session');
 const victim=s.opponents.casters[0];await g.call('combat','damageEnemy',victim,1000,g.now(),true);assert(!victim.alive);g.tick(60);assert(victim.alive);assert(victim.hpBar.root.visible);pass('killed casters return as a training opponent with a live HP bar');
 await launch('COMBINED',1);assert.equal(s.mainDummy.group.userData.profile,'Lucian');assert.equal(s.opponents.casters.length,1);g.tick(60);assert(s.skillshotsFired>0);pass('combined training retains a chasing champion and a separate spell caster');
 const previous=[...s.opponents.casters.map(e=>e.group),...s.opponents.casts.flatMap(c=>[c.warning,c.area,...c.shots.map(p=>p.mesh)].filter(Boolean))];s.lobbyMode='CS';await g.call('lobby','launchTraining');assert.equal(s.opponents,null);assert(previous.every(mesh=>!s.scene.children.includes(mesh)));assert.equal(s.alliedMinions.length,6);pass('mode switch removes opponents, warnings and projectiles without disturbing CS');
 fs.writeFileSync(path.join(__dirname,'../OPPONENT-TEST-RESULTS.json'),JSON.stringify({checks,patterns:9},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
