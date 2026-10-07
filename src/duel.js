import * as THREE from 'three';
import { state } from './state.js';
import { createEnemy, createAlliedMinion, setEnemyAppearance } from './entities.js';
import { makeMinionHpBar, updateMinionHpBar, updateLaneMinion, updateMinionProjectiles, damageLaneUnit } from './minions.js';
import { resetAbilities, hurtPlayer, enemyMovement, createSkillBolt, groundCircle } from './abilities.js';
import { disposeObject } from './champions.js';
import { poseWindup, poseRelease } from './presentation.js';
import { damageEnemy } from './combat.js';

export const DUEL_ITEMS=[
 {id:'blade',name:'剣',detail:'通常攻撃の威力 +20%',damage:.2},
 {id:'bow',name:'弓',detail:'攻撃速度 +18%',speed:.18},
 {id:'boots',name:'ブーツ',detail:'移動速度 +10%',move:.1},
 {id:'armor',name:'鎧',detail:'受けるダメージ −15%',guard:.15}
];
const LEVELS=[{reaction:.5,error:.9,miss:.3,interval:5},{reaction:.3,error:.5,miss:.16,interval:4},{reaction:.18,error:.25,miss:.07,interval:3.4}];
const STYLES=['CS優先','積極的','慎重'];
export function duelBonuses(items=[]){return items.reduce((b,id)=>{const item=DUEL_ITEMS.find(i=>i.id===id);for(const key of ['damage','speed','move','guard'])b[key]+=item?.[key]||0;return b;},{damage:0,speed:0,move:0,guard:0});}
function remove(mesh){state.scene.remove(mesh);disposeObject(mesh);}
export function resetDuel(){
 const d=state.duel;if(d){for(const s of d.shots)remove(s.mesh);if(d.cast)remove(d.cast.warning);remove(d.blue.group);if(d.blue.hpBar)remove(d.blue.hpBar.root);}
 state.duel=null;state.player.visible=true;document.querySelector('#duelPanel').hidden=true;
}
function tower(team){
 const e=team==='enemy'?createEnemy('敵タワー',16,0,0xd95762,800,1.1,'tower'):createAlliedMinion('味方タワー',-16,0,800,1.1);
 if(team==='ally')state.alliedMinions.pop();e.type='tower';e.team=team;
 const hitbox=e.hitbox;if(hitbox)e.group.remove(hitbox);remove(e.group);
 e.group=new THREE.Group();e.group.position.set(team==='enemy'?16:-16,0,0);
 const mat=new THREE.MeshStandardMaterial({color:team==='enemy'?0xbc4a58:0x407bc4});
 const base=new THREE.Mesh(new THREE.CylinderGeometry(.8,1.2,3,8),mat);base.position.y=1.5;e.group.add(base);
 const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.7),new THREE.MeshBasicMaterial({color:team==='enemy'?0xff6576:0x66baff}));crystal.position.y=3.6;e.group.add(crystal);
 if(hitbox){hitbox.scale.set(1.1,2,1.1);e.group.add(hitbox);}state.scene.add(e.group);makeMinionHpBar(e);e.nextAttack=0;return e;
}
export function startDuel(){
 const bot=state.mainDummy;setEnemyAppearance(bot,'Ezreal');bot.type='duelist';bot.name='エズリアル BOT';bot.hp=bot.maxHp=100;bot.group.position.set(7,0,0);bot.alive=true;bot.group.visible=true;makeMinionHpBar(bot);
 state.player.position.set(-7,0,0);state.playerHp=100;state.rangeRing.visible=true;
 state.duel={bot,red:tower('enemy'),blue:tower('ally'),phase:'play',round:1,wins:[0,0],items:[],botItems:[],time:0,nextWave:0,shots:[],cast:null,think:0,nextQ:2,nextAA:0,aim:new THREE.Vector3(0,0,0),style:Math.floor(Math.random()*3),kills:[0,0],botCS:0,playerRespawn:0,botRespawn:0,aggressionUntil:0};
 state.objectiveBanner.textContent='タワー破壊で一本・二本先取。前に出てQを誘い、横へ避けて反撃。';
}
function clearUnits(){
 for(const e of state.enemies.slice(1)){remove(e.group);if(e.hpBar)remove(e.hpBar.root);}state.enemies.splice(1);
 for(const e of state.alliedMinions){remove(e.group);if(e.hpBar)remove(e.hpBar.root);}state.alliedMinions.length=0;
 for(const p of state.minionProjectiles)remove(p.mesh);state.minionProjectiles.length=0;
}
export function chooseDuelItem(id){
 const d=state.duel;if(!d||d.phase!=='items'||!DUEL_ITEMS.some(i=>i.id===id))return false;
 d.items.push(id);const botItem=state.playerHp<35?'blade':d.bot.hp<35?'armor':['bow','boots','blade'][Math.floor(Math.random()*3)];d.botItems.push(botItem);
 clearUnits();remove(d.blue.group);if(d.blue.hpBar)remove(d.blue.hpBar.root);
 for(const s of d.shots)remove(s.mesh);d.shots=[];if(d.cast)remove(d.cast.warning);d.cast=null;
 resetAbilities();state.projectiles.splice(0).forEach(p=>remove(p.mesh));
 d.round++;d.phase='play';d.bot.hp=100;d.bot.alive=true;d.bot.group.visible=true;d.bot.group.position.set(7,0,0);d.bot.rootUntil=0;d.bot.slowUntil=0;
 d.blue=tower('ally');d.red=tower('enemy');d.nextWave=d.time;d.nextQ=d.time+2;d.nextAA=d.time+1;d.think=0;d.playerRespawn=0;d.botRespawn=0;d.aggressionUntil=0;
 state.playerHp=100;state.player.position.set(-7,0,0);state.order={type:'idle',point:state.player.position.clone(),target:null};state.attackState='idle';state.attackTarget=null;state.nextAttackReady=0;state.reloadUntil=0;state.championShots=0;state.rightMouseHeld=false;
 document.querySelector('#duelPanel').hidden=true;state.renderer.domElement.focus?.({preventScroll:true});return true;
}
function finishRound(winner){
 const d=state.duel;if(d.phase!=='play')return;d.wins[winner]++;d.phase=d.wins[winner]>=2?'complete':'items';state.rightMouseHeld=false;
 document.querySelector('#duelPanel').hidden=false;
 document.querySelector('#duelTitle').textContent=d.phase==='complete'?(winner===0?'勝利！':'BOTの勝利'):(winner===0?'一本獲得！':'BOTが一本獲得');
 document.querySelector('#duelScore').textContent=`YOU ${d.wins[0]} — ${d.wins[1]} BOT · ${d.phase==='items'?'次のラウンドに持ち越す装備を一つ選択':'二本先取で決着'}`;
 document.querySelector('#duelItems').hidden=d.phase!=='items';document.querySelector('#duelRetry').hidden=d.phase!=='complete';
}
function wave(){
 const d=state.duel;d.nextWave=d.time+14;
 for(const team of ['ally','enemy']){
  const units=team==='ally'?state.alliedMinions:state.enemies.filter(e=>e.type==='minion');
  if(units.filter(e=>e.alive).length>=12)continue;
  for(let i=0;i<6;i++){const melee=i<3,unit=team==='ally'?createAlliedMinion('味方ミニオン',-13-(i%3)*.8-(melee?0:1.8),(i%3-1)*.8,melee?320:220,.45,melee?'melee':'caster'):createEnemy('敵ミニオン',13+(i%3)*.8+(melee?0:1.8),(i%3-1)*.8,0xb75a62,melee?320:220,.45,'minion');unit.minionClass=melee?'melee':'caster';makeMinionHpBar(unit);}
 }
 // Dispose old waves rather than accumulating scene objects in a long match.
 for(const list of [state.enemies,state.alliedMinions])for(let i=list.length-1;i>=0;i--){const e=list[i];if(e.type==='minion'&&!e.alive){remove(e.group);if(e.hpBar)remove(e.hpBar.root);list.splice(i,1);}}
}
function distance(a,b){return a.group.position.distanceTo(b.group.position);}
function move(unit,point,speed,dt){const dir=point.clone().sub(unit.group.position).setY(0),len=dir.length();if(len>.05){unit.group.position.addScaledVector(dir.normalize(),Math.min(len,speed*dt));unit.group.position.x=THREE.MathUtils.clamp(unit.group.position.x,-18,18);unit.group.position.z=THREE.MathUtils.clamp(unit.group.position.z,-6,6);unit.group.lookAt(point.x,0,point.z);}}
function bolt(origin,target,damage,team,kind='AA',direction=null){
 const mesh=createSkillBolt(team==='enemy'?0xffbe6c:0x7bcaff,.18,false,{id:'Ezreal',key:kind});mesh.position.copy(origin).setY(.8);state.scene.add(mesh);
 state.duel.shots.push({mesh,target,damage,team,kind,dir:direction,life:3,hit:false});
}
function take(target,amount,team,now){
 const d=state.duel;
 if(target.player){if(team==="enemy")d.botAggroUntil=d.time+3;hurtPlayer(amount,now);return;}
 if(target===d.bot){damageEnemy(target,amount/ .15,now,false);return;}
 if(target.type==='tower'){const escort=target.team==='ally'?state.enemies:state.alliedMinions;if(!escort.some(e=>e.type==='minion'&&e.alive&&distance(e,target)<7))amount*=.15;}
 const wasAlive=target.alive;damageLaneUnit(target,amount,now,team);if(wasAlive&&!target.alive&&target.type==='minion'&&team==='enemy')d.botCS++;
}
function shots(dt,now,player){
 const d=state.duel;
 for(let i=d.shots.length-1;i>=0;i--){const s=d.shots[i],before=s.mesh.position.clone();s.life-=dt;
  if(s.kind==='Q'){
   s.mesh.position.addScaledVector(s.dir,16*dt);
   const candidates=[...state.alliedMinions.filter(e=>e.alive),...(state.playerHp>0?[player]:[])].sort((a,b)=>before.distanceToSquared(a.group.position)-before.distanceToSquared(b.group.position));
   const segment=new THREE.Line3(before,s.mesh.position);
   for(const t of candidates){const point=t.group.position.clone().setY(.8);if(segment.closestPointToPoint(point,true,new THREE.Vector3()).distanceTo(point)<t.radius+.18){take(t,s.damage,'enemy',now);s.life=0;s.hit=true;if(t.player){state.skillshotsHit++;state.laneMetrics.hit++;}break;}}
  }else if(!s.target?.alive)s.life=0;
  else{const point=s.target.group.position.clone().setY(.8),dir=point.sub(s.mesh.position),len=dir.length();if(len<12*dt+.1){take(s.target,s.damage,s.team,now);s.life=0;}else s.mesh.position.addScaledVector(dir.normalize(),12*dt);}
  if(s.life<=0){if(s.kind==='Q'&&!s.hit&&s.mesh.position.distanceTo(state.player.position)>1&&state.playerHp>0){state.dodges++;}remove(s.mesh);d.shots.splice(i,1);}
 }
}
function botAI(dt,now,player){
 const d=state.duel,b=d.bot,c=LEVELS[state.difficultyIndex],bonus=duelBonuses(d.botItems);if(!b.alive)return;
 if(d.cast){if(d.time>=d.cast.until){const cast=d.cast;remove(cast.warning);d.cast=null;bolt(b.group.position,null,13,'enemy','Q',cast.dir);poseRelease(b.group,now,'Q');}return;}
 const range=distance(b,player),enemyMinions=state.alliedMinions.filter(e=>e.alive),low=enemyMinions.filter(e=>e.hp<=65&&distance(b,e)<7).sort((a,b)=>a.hp-b.hp)[0];
 if(d.time>=d.think){
  d.think=d.time+c.reaction+Math.random()*.18;
  const friendly=state.enemies.filter(e=>e.type==='minion'&&e.alive),escort=friendly.some(e=>e.group.position.x<-9);
  const safe=b.hp<28||(b.group.position.x<-8&&!escort);
  if(safe)d.aim.set(11,0,(Math.random()-.5)*3);
  else if(!enemyMinions.length&&escort&&(state.playerHp<=0||player.group.position.x<-13))d.aim.set(-11,0,1);
  else if(low)d.aim.copy(low.group.position).add(new THREE.Vector3(4.8,0,0));
  else{const preferred=d.style===1?5.8:d.style===2?7:6.4;d.aim.copy(player.group.position).add(new THREE.Vector3(preferred,0,(Math.random()-.5)*3));}
  // Read visible projectiles only at reaction ticks; no cursor or future-input access.
  const incoming=state.abilities.shots.find(s=>!s.visualOnly&&s.mesh.position.distanceTo(b.group.position)<4&&s.dir.dot(b.group.position.clone().sub(s.mesh.position))>0);
  if(incoming&&Math.random()>c.miss)d.aim.z=THREE.MathUtils.clamp(b.group.position.z+(Math.random()<.5?-2:2),-5,5);
  if(state.playerHp>0&&range<10&&range>2&&d.time>=d.nextQ&&Math.random()>c.miss){
   d.nextQ=d.time+c.interval+Math.random()*.8;
   const target=player.group.position.clone();target.z+=(Math.random()-.5)*c.error*2;
   const dir=target.sub(b.group.position).setY(0).normalize(),warning=groundCircle(b.group.position,.9,0xffb56c,.15);
   d.cast={dir,warning,until:d.time+.35};poseWindup(b.group,now,.35,'Q');state.skillshotsFired++;
  }
 }
 if(!d.cast)move(b,d.aim,3.25*(1+bonus.move)*enemyMovement(b,now),dt);
 const victim=low||(state.playerHp>0&&range<6.6&&b.hp>20?player:null)||enemyMinions.find(e=>distance(b,e)<6);
 if(victim&&d.time>=d.nextAA&&!d.cast){d.nextAA=d.time+1.5/(1+bonus.speed);if(Math.random()>c.miss){bolt(b.group.position,victim,victim.player?8*(1+bonus.damage):65*(1+bonus.damage),'enemy');poseRelease(b.group,now);}}
 if(!enemyMinions.length&&b.group.position.x<-9&&d.time>=d.nextAA){d.nextAA=d.time+1.5;bolt(b.group.position,d.blue,45*(1+bonus.damage),'enemy');}
}
export function updateDuel(dt,now){
 const d=state.duel;if(state.mode!=='DUEL'||!d||d.phase!=='play')return;d.time+=dt;
 const player={group:state.player,radius:state.PLAYER_RADIUS,player:true,get alive(){return state.playerHp>0;},get hp(){return state.playerHp;}};
 if(state.playerHp<=0&&!d.playerRespawn){d.playerRespawn=d.time+5;d.kills[1]++;state.order.type='idle';state.attackState='idle';state.player.visible=false;}
 if(d.playerRespawn&&d.time>=d.playerRespawn){state.playerHp=100;state.player.visible=true;state.player.position.set(-14,0,0);resetAbilities();d.playerRespawn=0;}
 if(!d.bot.alive&&!d.botRespawn){d.botRespawn=d.time+5;d.kills[0]++;}
 if(d.botRespawn&&d.time>=d.botRespawn){d.bot.alive=true;d.bot.group.visible=true;d.bot.hp=100;d.bot.group.position.set(14,0,0);d.botRespawn=0;d.bot.rootUntil=0;d.bot.slowUntil=0;}
 if(d.time>=d.nextWave)wave();
 const allies=state.alliedMinions.filter(e=>e.alive),enemies=state.enemies.filter(e=>e.type==='minion'&&e.alive);
 for(const a of allies)updateLaneMinion(a,enemies.length?enemies:[d.red],dt*1.8,now);
 for(const e of enemies)updateLaneMinion(e,allies.length?allies:[d.blue],dt*1.8,now);
 updateMinionProjectiles(dt,now);botAI(dt,now,player);shots(dt,now,player);
 for(const t of [d.blue,d.red]){
  const hostile=t.team==='ally'?enemies:allies,hero=t.team==='ally'?d.bot:player;
  const targets=hostile.filter(e=>distance(t,e)<7),aggro=t===d.red?d.aggressionUntil>d.time:d.botAggroUntil>d.time;
  const target=(aggro&&hero.alive&&distance(t,hero)<7?hero:null)||targets[0]||(hero.alive&&distance(t,hero)<7?hero:null);
  if(t.alive&&target&&now>=t.nextAttack){t.nextAttack=now+1;bolt(t.group.position,target,target.player||target.type==='duelist'?20:100,t.team);}
  updateMinionHpBar(t);
 }
 state.modeBanner.textContent=`MID 1v1 · YOU ${d.wins[0]} : ${d.wins[1]} BOT · ROUND ${d.round}`;
 const names=items=>items.map(id=>DUEL_ITEMS.find(i=>i.id===id).name).join('＋')||'なし';
 document.querySelector('#enemyCast').textContent=`${STYLES[d.style]} BOT · CS ${state.cs}:${d.botCS} · キル ${d.kills[0]}:${d.kills[1]} · タワー ${Math.ceil(d.blue.hp)}:${Math.ceil(d.red.hp)}${d.playerRespawn?' · 復帰まで '+Math.ceil(d.playerRespawn-d.time)+'秒':''}${d.items.length?' · 装備 YOU '+names(d.items)+' / BOT '+names(d.botItems):''}`;
 if(!d.red.alive||d.red.hp<=0)finishRound(0);else if(!d.blue.alive||d.blue.hp<=0)finishRound(1);
}
export function bindDuel(retry,menu){
 for(const item of DUEL_ITEMS)document.querySelector('#duel-'+item.id).addEventListener('click',()=>chooseDuelItem(item.id));
 document.querySelector('#duelRetry').addEventListener('click',retry);document.querySelector('#duelMenu').addEventListener('click',menu);
}
