const assert=require('assert/strict'),fs=require('fs'),path=require('path');const {pathToFileURL}=require('url');const {game}=require('./lane.test.cjs');
(async()=>{
 const THREE=await import(pathToFileURL(path.resolve(process.argv[2]))),g=await game(THREE),s=g.s,checks=[];let stationary=0;
 const pass=name=>{checks.push(name);console.log('PASS',name);};
 const launch=async(id='Ezreal',mode='FREE')=>{s.lobbyChampion=id;s.lobbyMode=mode;await g.call('lobby','launchTraining');s.mainDummy.group.position.copy(s.player.position).add(new THREE.Vector3(3,0,0));s.mainDummy.hp=s.mainDummy.maxHp=100000;s.modeData.time=300;return s.mainDummy;};
 const cast=(key,point=s.mainDummy.group.position)=>g.call('abilities','castSkill',key,point,g.now());
 for(const id of ['Ashe','Caitlyn','Jinx','Jhin','Ezreal','Lucian','Vayne','MissFortune','Varus','Kaisa'])for(const key of 'QWER'){
  await launch(id);s.abilities.focus=4;s.mainDummy.plasma=2;const rule=await g.call('cast-rules','castRule',id,key);if(!rule.duration)continue;
  const position=s.player.position.clone(),destination=position.clone().add(new THREE.Vector3(0,0,6));await g.call('player','issueMovePoint',destination);assert(await cast(key),id+'.'+key);const until=s.abilities.cast.until,mana=s.abilities.mana,cd=s.abilities.cooldowns[key];
  assert.equal(s.abilities.shots.length,0);assert.equal(s.abilities.traps.length,0);assert.equal(s.mainDummy.hp,100000);assert.equal(await g.call('combat','startAttack',s.mainDummy,g.now()),false);assert.equal(await cast(key),false);assert.equal(s.abilities.mana,mana);assert.equal(s.abilities.cooldowns[key],cd);
  while(g.now()+.05<until-.00001){g.tick();assert.equal(s.player.position.distanceTo(position),0,id+'.'+key+' moving during cast');assert.equal(s.mainDummy.hp,100000);}
  g.tick(2);assert.equal(s.abilities.cast,null);if(!s.abilities.channel&&!s.abilities.dash){assert(s.player.position.distanceTo(position)>0,id+'.'+key+' buffered movement resumes');}
  stationary++;
 }
 pass(stationary+' stationary casts across all ten kits delay effects, block movement/AA and resume queued movement without double spending');
 for(const id of ['Vayne','Lucian']){
  const e=await launch(id),key=id==='Vayne'?'Q':'E';s.nextAttackReady=g.now()+5;const start=s.player.position.clone();await cast(key,start.clone().add(new THREE.Vector3(0,0,3)));assert(s.abilities.dash);assert.equal(s.player.position.distanceTo(start),0);assert.equal(await g.call('combat','startAttack',e,g.now()),false);g.tick(5);assert(!s.abilities.dash);assert(s.player.position.distanceTo(start)>2.9);assert(s.nextAttackReady<=g.now());assert(await g.call('combat','startAttack',e,g.now()));
 }
 pass('Vayne Q and Lucian E travel over time and reset AA only after the dash');
 await launch('Kaisa');await g.call('player','issueMovePoint',s.player.position.clone().add(new THREE.Vector3(0,0,6)));const start=s.player.position.clone();await cast('Q');g.tick(2);assert(s.player.position.distanceTo(start)>0);assert(!s.abilities.cast);
 await launch('Kaisa');const base=s.ATTACK_SPEED;await cast('E');await g.call('player','issueMovePoint',s.player.position.clone().add(new THREE.Vector3(0,0,6)));g.tick(4);assert.equal(s.ATTACK_SPEED,base);assert.equal(await g.call('combat','startAttack',s.mainDummy,g.now()),false);assert(s.player.position.z>2);g.tick(10);assert(s.ATTACK_SPEED>base);
 pass('Kaisa Q permits movement; E permits movement but disables AA and grants AS after charging');
 await launch('Lucian');await cast('R');const locked=s.abilities.channel.dir.clone();await g.call('player','issueMovePoint',s.player.position.clone().add(new THREE.Vector3(0,0,4)));g.tick(10);assert(s.abilities.channel);assert(s.player.position.z>2);assert(s.abilities.channel.dir.distanceTo(locked)<1e-9);await cast('E',s.player.position.clone().add(new THREE.Vector3(0,0,2)));g.tick(5);assert(s.abilities.channel);await g.call('combat','issueAttack',s.mainDummy);assert.equal(s.abilities.channel,null);
 for(const id of ['Caitlyn','Jhin','MissFortune']){await launch(id);await cast('R');g.tick(6);assert(s.abilities.channel);await g.call('combat','issueAttack',s.mainDummy);assert.equal(s.abilities.channel,null);}
 pass('Lucian R moves/dashes with fixed aim; AA cancels channels, including stationary Caitlyn/Jhin/MF R');
 await launch('Varus');await cast('Q');const position=s.player.position.clone();await g.call('player','issueMovePoint',position.clone().add(new THREE.Vector3(0,0,4)));g.tick(30);assert(s.abilities.charge);assert(s.player.position.distanceTo(position)>0);await g.call('abilities','releaseCharge',s.mainDummy.group.position,g.now());const releasePosition=s.player.position.clone();g.tick(3);assert.equal(s.player.position.distanceTo(releasePosition),0);g.tick(4);assert(!s.abilities.cast);assert(s.abilities.shots.length||s.abilities.hits);
 pass('Varus can move while holding Q beyond full power and stops briefly for release');
 for(const pair of [['Jhin','Q'],['Lucian','Q'],['MissFortune','Q'],['Vayne','E'],['Caitlyn','R']]){await launch(pair[0]);assert.equal(await cast(pair[1],s.player.position.clone().add(new THREE.Vector3(0,0,8))),false);assert.equal(s.abilities.casts,0);}
 await launch('Caitlyn');s.mainDummy.type='minion';assert.equal(await cast('R'),false);await launch('Kaisa');s.mainDummy.type='minion';s.mainDummy.plasma=2;assert.equal(await cast('R'),false);
 pass('targeted casts require an aimed unit in range; Caitlyn/Kaisa R reject minions without spending resources');
 await launch('Caitlyn');const victim=s.mainDummy;await cast('W');g.tick(30);assert.equal(victim.hp,100000);assert(victim.headshot);assert(victim.rootUntil>g.now());victim.group.position.copy(s.player.position).add(new THREE.Vector3(10,0,0));assert(await g.call('combat','enemyInAttackRange',victim));
 pass('Caitlyn trap does no direct damage and grants a doubled-range headshot');
 await launch('Jhin');const champ=s.mainDummy,minion=await g.call('entities','createEnemy','MINION',s.player.position.x+1.5,s.player.position.z,0xff0000,100000,.48,'minion');await cast('R');g.tick(6);assert(await cast('R'));g.tick(10);assert(minion.hp<100000);assert(champ.hp<100000);assert(!s.abilities.shots.length);
 pass('Jhin R damages and pierces a minion, then stops on the champion');
 for(const mode of ['FREE','KITE','TARGET','SPACING','DODGE','COMBINED','LANE','CS']){await launch('Ezreal',mode);g.tick();for(const e of s.enemies.filter(e=>e.alive&&e.group.visible)){assert(e.hpBar&&e.hpBar.root.visible,mode);const ratio=e.hpBar.fill.scale.x;e.group.position.z+=2;e.hp*=.5;g.tick();assert.equal(e.hpBar.root.position.z,e.group.position.z);assert(e.hpBar.fill.scale.x<ratio);assert.equal(e.hpBar.fillMat.color.getHex(),0xd93e4b);}}
 pass('all modes show fixed-red enemy overhead HP bars that follow positions and health');
 await launch('Ezreal');await cast('R');g.key('Escape');const until=s.abilities.cast.until;g.tick(20);assert.equal(s.abilities.cast.until,until);s.lobbyMode='FREE';await g.call('lobby','launchTraining');assert(!s.abilities.cast);assert(!s.abilities.dash);
 pass('menu pauses casts and restart clears pending casts/dashes');
 fs.writeFileSync(path.join(__dirname,'../CASTING-TEST-RESULTS.json'),JSON.stringify({checks,stationaryCasts:stationary,renderer:'stubbed renderer; actual Three.js scene graph/math'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
