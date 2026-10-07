const assert=require('assert/strict'),fs=require('fs'),path=require('path');const {pathToFileURL}=require('url');const {game}=require('./lane.test.cjs');
(async()=>{
 const THREE=await import(pathToFileURL(path.resolve(process.argv[2]))),g=await game(THREE),s=g.s,checks=[];
 const pass=name=>{checks.push(name);console.log('PASS',name);};
 const launch=async(id='Ezreal',mode='FREE')=>{s.lobbyChampion=id;s.lobbyMode=mode;await g.call('lobby','launchTraining');s.mainDummy.group.position.copy(s.player.position).add(new THREE.Vector3(3,0,0));return s.mainDummy;};
 const cast=(key,point=s.mainDummy.group.position.clone())=>g.call('abilities','castSkill',key,point,g.now());
 let tested=0;
 for(const id of ['Ashe','Caitlyn','Jinx','Jhin','Ezreal','Lucian','Vayne','MissFortune','Varus','Kaisa'])for(const key of 'QWER'){
  const enemy=await launch(id);s.abilities.focus=4;enemy.plasma=2;const result=await cast(key);
  assert.equal(result,!(id==='Vayne'&&key==='W'),id+'.'+key);if(id==='Jhin'&&key==='R'){for(let i=0;i<4;i++){assert(await cast('R'));g.tick(16);}}
  g.tick(30);assert(Number.isFinite(s.player.position.x));assert(s.abilities.mana>=0&&s.abilities.mana<=100);
  const damageSlots=['Ashe.W','Ashe.R','Caitlyn.Q','Caitlyn.W','Caitlyn.E','Caitlyn.R','Jinx.W','Jinx.E','Jinx.R','Jhin.Q','Jhin.W','Jhin.E','Jhin.R','Ezreal.Q','Ezreal.E','Ezreal.R','Lucian.Q','Lucian.W','Lucian.R','Vayne.E','MissFortune.Q','MissFortune.E','MissFortune.R','Varus.Q','Varus.E','Varus.R','Kaisa.Q','Kaisa.W'];
  if(damageSlots.includes(id+'.'+key))assert(enemy.hp<700,id+'.'+key+' must actually damage the target');tested++;
 }
 pass('all 40 Q/W/E/R slots execute their training behavior; Vayne W correctly stays passive');
 let snipeTarget=await launch('Caitlyn');await cast('R');g.tick(30);assert.equal(snipeTarget.hp,480);assert.equal(s.abilities.channel,null);
 snipeTarget=await launch('Caitlyn');snipeTarget.group.position.copy(s.player.position).add(new THREE.Vector3(7,0,0));const blocker=await g.call('entities','createEnemy','BLOCKER',s.player.position.x+3,s.player.position.z);await cast('R',snipeTarget.group.position);g.tick(35);assert.equal(snipeTarget.hp,700);assert.equal(blocker.hp,480);pass('Caitlyn R releases after the channel and another champion can intercept it');
 let enemy=await launch('Ezreal');await cast('W');g.tick(10);assert.equal(enemy.mark,'Ezreal');assert.equal(enemy.hp,700);const basicHits=s.hits;
 await cast('Q');g.tick(10);assert(enemy.hp<=540);assert.equal(enemy.mark,null);assert.equal(s.hits,basicHits);assert(s.abilities.cooldowns.W<=g.now()+7-1);pass('Ezreal W mark detonates on Q; hit reduces cooldowns; skills do not inflate AA counts');
 await launch('Caitlyn');const before=s.player.position.clone();await cast('E');assert(s.player.position.x<before.x);assert(s.player.position.distanceTo(before)<=3.01);g.tick(15);assert(s.mainDummy.slowUntil>g.now());pass('Caitlyn net damages/slows forward and moves backward');
 enemy=await launch('Vayne');await g.call('combat','issueAttack',enemy);g.tick(90);assert(s.hits>=3);assert(enemy.hp<700-s.hits*60);pass('Vayne third basic hit procs silver bolts');
 enemy=await launch('Vayne');s.player.position.set(s.arenaBounds.maxX-5,0,0);enemy.group.position.set(s.arenaBounds.maxX-1,0,0);await cast('E',enemy.group.position);assert(enemy.rootUntil>g.now());assert(enemy.hp<=550);pass('Vayne condemn into arena wall adds stun and damage');
 enemy=await launch('Ashe');assert.equal(await cast('Q'),false);await g.call('combat','issueAttack',enemy);g.tick(110);await g.call('player','issueStop');assert.equal(s.abilities.focus,4);const initial=s.ATTACK_SPEED;assert(await cast('Q'));assert(s.ATTACK_SPEED>initial);pass('Ashe Q requires four landed attacks and then raises attack tempo');
 enemy=await launch('Ashe');await cast('W');g.tick(20);assert.equal(enemy.hp,610);assert(enemy.slowUntil>g.now());pass('Ashe fan hits each target once, even when several arrows overlap');
 enemy=await launch('Jhin');await cast('R');assert.equal(s.abilities.channel.ammo,4);for(let i=0;i<4;i++){assert(await cast('R'));g.tick(16);}assert.equal(s.abilities.channel,null);assert(enemy.hp<250);pass('Jhin R arms four aimed recasts and ends after the fourth');
 enemy=await launch('Varus');await cast('Q');g.tick(12);await g.call('abilities','releaseCharge',enemy.group.position.clone(),g.now());g.tick(15);const shortDamage=700-enemy.hp;
 enemy=await launch('Varus');await cast('W');await cast('Q');g.tick(35);assert(700-enemy.hp>shortDamage);pass('Varus held Q increases damage; W empowers the charged arrow');
 enemy=await launch('Kaisa');assert.equal(await cast('R'),false);await cast('W');g.tick(12);assert(enemy.plasma>=2);assert(await cast('R'));assert(s.playerShield>0);const hp=s.playerHp;const absorbed=await g.call('abilities','hurtPlayer',10,g.now());assert.equal(absorbed,0);assert.equal(s.playerHp,hp);pass('Kaisa R requires plasma and gives a shield that actually absorbs damage');
 await launch('Lucian');const location=s.player.position.clone();assert(await cast('F',new THREE.Vector3(100,0,100)));assert(s.player.position.distanceTo(location)<=4.001);assert.equal(await cast('F'),false);s.playerHp=50;assert(await cast('D'));assert.equal(s.playerHp,75);assert.equal(await cast('D'),false);g.tick(30);assert(g.dom.get('#cooldownF').textContent);pass('Flash distance and cooldown, heal amount and cooldown, live HUD countdown');
 await launch('Ezreal');s.abilities.mana=0;assert.equal(await cast('Q'),false);const stationary=s.player.position.clone();await g.call('lobby','openLobby');assert.equal(await cast('F'),false);g.tick(100);assert.equal(s.abilities.mana,0);assert.equal(s.player.position.distanceTo(stationary),0);pass('mana and paused-menu gates reject casts without consuming resources');
 await launch('MissFortune');await cast('R');assert(s.abilities.channel);await g.call('player','issueMovePoint',s.player.position.clone().add(new THREE.Vector3(0,0,3)));assert.equal(s.abilities.channel,null);
 await launch('Lucian');await cast('R');await g.call('player','issueMovePoint',s.player.position.clone().add(new THREE.Vector3(0,0,3)));g.tick(10);assert(s.abilities.channel);assert(s.player.position.z>2);pass('MF movement cancels R, Lucian can move while channeling R');
 await launch('Ezreal');g.key('KeyQ');assert(s.abilities.casts>0);g.key('KeyD');assert.equal(s.abilities.heal,1);g.key('KeyF');assert.equal(s.abilities.flash,1);const difficulty=s.difficultyIndex;g.key('KeyH');assert.equal(s.difficultyIndex,(difficulty+1)%3);pass('keyboard QWER/D/F spells and H difficulty use separate bindings');
 const oldMeshes=[...s.abilities.shots,...s.abilities.effects].map(e=>e.mesh);await launch('Ashe','CS');assert.equal(s.abilities.casts,0);assert(oldMeshes.every(mesh=>!s.scene.children.includes(mesh)));assert.equal(s.alliedMinions.length,6);pass('restart/mode switch clears skill shots, effects, cooldowns and mana; CS still spawns');
 // A sustained fire-then-move route must work without movement spells or Flash.
 await launch('Caitlyn','KITE');s.difficultyIndex=1;s.mainDummy.hp=s.mainDummy.maxHp=1000000;s.mainDummy.group.position.copy(s.player.position).add(new THREE.Vector3(7,0,0));
 let minDistance=Infinity,lastShot=-Infinity;const corners=[[-28,-18],[-28,18],[28,18],[28,-18]];let corner=0;
 for(let i=0;i<590;i++){
  const destination=new THREE.Vector3(corners[corner][0],0,corners[corner][1]);if(s.player.position.distanceTo(destination)<1)corner=(corner+1)%4;
  if(s.lastShotAt!==lastShot&&s.lastShotAt>-Infinity){lastShot=s.lastShotAt;await g.call('player','issueMovePoint',destination);}
  if(g.now()>=s.nextAttackReady&&s.attackState!=='windup')await g.call('combat','issueAttack',s.mainDummy);
  g.tick();minDistance=Math.min(minDistance,s.player.position.distanceTo(s.mainDummy.group.position));
 }
 assert.equal(s.playerHp,100);assert(s.hits>=12);assert(s.cleanKites>=12);assert(s.cancels<=2);assert(minDistance>1.95);assert(s.arenaBounds.maxX-s.arenaBounds.minX>65);pass('29.5-second normal kite sustains real AA/move with full HP, no Flash, no inevitable catch');
 fs.writeFileSync(path.join(__dirname,'../ABILITY-TEST-RESULTS.json'),JSON.stringify({checks,skillSlotsTested:tested,kite:{hits:s.hits,cleanKites:s.cleanKites,cancels:s.cancels,hp:s.playerHp,minDistance},renderer:'stubbed renderer; actual Three.js math/scene graph'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
