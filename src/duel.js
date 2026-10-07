import { separateMinions, minionRoute } from './minion-spacing.js';
import { animateMinions } from './minion-model.js';
import * as THREE from 'three';
import { state } from './state.js';
import { createEnemy, createAlliedMinion, setEnemyAppearance } from './entities.js';
import { makeMinionHpBar, updateMinionHpBar, damageLaneUnit, laneUnitStats } from './minions.js';
import { resetAbilities, hurtPlayer, enemyMovement, createSkillBolt, groundCircle } from './abilities.js';
import { disposeObject } from './champions.js';
import { poseWindup, poseRelease } from './presentation.js';
import { noteEvade } from './micro.js';
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
 state.player.position.set(-7,0,0);state.playerHp=100;state.rangeRing.visible=false;
 state.duel={bot,red:tower('enemy'),blue:tower('ally'),phase:'play',round:1,wins:[0,0],items:[],botItems:[],time:0,nextWave:0,shots:[],cast:null,think:0,nextQ:2,nextW:3,nextE:0,nextR:10,botMana:375,nextAA:0,botAttack:null,aim:new THREE.Vector3(0,0,0),style:Math.floor(Math.random()*3),kills:[0,0],botCS:0,playerRespawn:0,botRespawn:0,aggressionUntil:0};
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
 state.navigation=null;state.cancelAim?.();resetAbilities();state.projectiles.splice(0).forEach(p=>remove(p.mesh));
 d.round++;d.phase='play';d.bot.hp=100;d.bot.alive=true;d.bot.group.visible=true;d.bot.group.position.set(7,0,0);d.bot.rootUntil=0;d.bot.stunUntil=0;d.bot.slowUntil=0;
 d.blue=tower('ally');d.red=tower('enemy');d.nextWave=d.time;d.nextQ=d.time+2;d.nextW=d.time+3;d.nextE=d.time;d.nextR=d.time+10;d.botMana=375;d.botAttack=null;d.nextAA=d.time+1;d.think=0;d.playerRespawn=0;d.botRespawn=0;d.aggressionUntil=0;
 state.playerHp=100;state.player.visible=true;state.player.position.set(-7,0,0);state.order={type:'idle',point:state.player.position.clone(),target:null};state.attackState='idle';state.attackTarget=null;state.nextAttackReady=0;state.reloadUntil=0;state.championShots=0;state.rightMouseHeld=false;
 document.querySelector('#duelPanel').hidden=true;state.renderer.domElement.focus?.({preventScroll:true});return true;
}
function finishRound(winner){
 const d=state.duel;if(d.phase!=='play')return;d.wins[winner]++;d.phase=d.wins[winner]>=2?'complete':'items';state.rightMouseHeld=false;
 document.querySelector('#duelPanel').hidden=false;
 document.querySelector('#duelTitle').textContent=d.phase==='complete'?(winner===0?'勝利！':'BOTの勝利'):(winner===0?'一本獲得！':'BOTが一本獲得');
 document.querySelector('#duelScore').textContent=`YOU ${d.wins[0]} — ${d.wins[1]} BOT · ${d.phase==='items'?'次のラウンドに持ち越す装備を一つ選択':'二本先取で決着'}`;
 document.querySelector('#duelCoaching').hidden=!state.coachEnabled;document.querySelector('#duelCoaching').textContent=`CS ${state.cs} / 取り逃し ${state.missedCs} · 被弾 ${state.skillshotsHit} · AAキャンセル ${state.cancels}。`+(state.cancels>2?'発射を確認してから移動しよう。':state.skillshotsHit>3?'ミニオンを盾にし、敵の詠唱が始まったら横へ動こう。':'次は敵がスキルを外した直後の反撃を狙おう。');
 document.querySelector('#duelItems').hidden=d.phase!=='items';document.querySelector('#duelRetry').hidden=d.phase!=='complete';
}
function wave(){
 const d=state.duel;d.nextWave=d.time+30;
 for(const team of ['ally','enemy']){
  const units=team==='ally'?state.alliedMinions:state.enemies.filter(e=>e.type==='minion');
  if(units.filter(e=>e.alive).length+6>12)continue;
  for(let i=0;i<6;i++){const melee=i<3,slot=i%3-1,side=team==='ally'?-1:1,x=side*(31+(melee?0:4.8)+(i%3)*.3),z=slot*1.7,unit=team==='ally'?createAlliedMinion('味方'+(melee?'前衛':'後衛'),x,z,melee?320:220,.45,melee?'melee':'caster'):createEnemy('敵'+(melee?'前衛':'後衛'),x,z,0xb75a62,melee?320:220,.45,'minion');unit.minionClass=melee?'melee':'caster';unit.laneSlot=slot;makeMinionHpBar(unit);}
 }
 // Dispose old waves rather than accumulating scene objects in a long match.
 for(const list of [state.enemies,state.alliedMinions])for(let i=list.length-1;i>=0;i--){const e=list[i];if(e.type==='minion'&&!e.alive){remove(e.group);if(e.hpBar)remove(e.hpBar.root);list.splice(i,1);}}
}
function distance(a,b){return a.group.position.distanceTo(b.group.position);}
function move(unit,point,speed,dt){const dir=point.clone().sub(unit.group.position).setY(0),len=dir.length();if(len>.05){unit.group.position.addScaledVector(dir.normalize(),Math.min(len,speed*dt));unit.group.position.x=THREE.MathUtils.clamp(unit.group.position.x,unit.type==='minion'?state.arenaBounds.minX:-18,unit.type==='minion'?state.arenaBounds.maxX:18);unit.group.position.z=THREE.MathUtils.clamp(unit.group.position.z,unit.type==='minion'?state.arenaBounds.minZ:-6,unit.type==='minion'?state.arenaBounds.maxZ:6);unit.group.lookAt(point.x,0,point.z);}}
function bolt(origin,target,damage,team,kind='AA',direction=null){
 const mesh=createSkillBolt(team==='enemy'?0xffbe6c:0x7bcaff,.18,false,{id:'Ezreal',key:kind});mesh.position.copy(origin).setY(.8);state.scene.add(mesh);
 state.duel.shots.push({mesh,target,damage,team,kind,dir:direction,life:kind==='Q'?11.5/20:kind==='W'?11.5/17:3,hit:false});
}
function take(target,amount,team,now){
 const d=state.duel;
 if(target.player){hurtPlayer(amount,now);return;}
 if(target===d.bot){damageEnemy(target,amount/ .15,now,false);return;}
 if(target.type==='tower'){const escort=target.team==='ally'?state.enemies:state.alliedMinions;if(!escort.some(e=>e.type==='minion'&&e.alive&&distance(e,target)<7))amount*=.15;}
 const wasAlive=target.alive;damageLaneUnit(target,amount,now,team);if(wasAlive&&!target.alive&&target.type==='minion'&&team==='enemy')d.botCS++;
}
function shots(dt,now,player){
 const d=state.duel;
 for(let i=d.shots.length-1;i>=0;i--){const s=d.shots[i],before=s.mesh.position.clone();s.life-=dt;
  if(['Q','W','R'].includes(s.kind)){
   s.mesh.position.addScaledVector(s.dir,(s.kind==='W'?17:s.kind==='R'?20:20)*dt);
   const candidates=[...(s.kind==='W'?[]:state.alliedMinions.filter(e=>e.alive)),...(state.playerHp>0?[player]:[])].sort((a,b)=>before.distanceToSquared(a.group.position)-before.distanceToSquared(b.group.position));
   const segment=new THREE.Line3(before,s.mesh.position);
   for(const t of candidates){const point=t.group.position.clone().setY(.8);if(segment.closestPointToPoint(point,true,new THREE.Vector3()).distanceTo(point)<t.radius+(s.kind==='R'?.65:.18)){if(s.hitTargets?.has(t.group))continue;
 if(s.kind==='W'){if(t.player)d.playerMarkUntil=now+4;}else{take(t,s.damage+(t.player&&d.playerMarkUntil>now?12:0),'enemy',now);if(t.player&&d.playerMarkUntil>now)d.playerMarkUntil=0;}
 s.hit=true;if(t.player){state.skillshotsHit++;state.laneMetrics.hit++;}if(s.kind==='R'){(s.hitTargets??=new Set()).add(t.group);}else{s.life=0;break;}}}
  }else if(!s.target?.alive)s.life=0;
  else{const point=s.target.group.position.clone().setY(.8),dir=point.sub(s.mesh.position),len=dir.length();if(len<12*dt+.1){take(s.target,s.damage+(s.target.player&&d.playerMarkUntil>now&&s.kind!=='TOWER'&&s.kind!=='MINION'?12:0),s.team,now);if(s.target.player&&s.kind!=='TOWER'&&s.kind!=='MINION')d.playerMarkUntil=0;s.life=0;}else s.mesh.position.addScaledVector(dir.normalize(),12*dt);}
  if(s.life<=0){if(s.kind==='Q'&&!s.hit&&s.mesh.position.distanceTo(state.player.position)>1&&state.playerHp>0){state.dodges++;noteEvade(d.bot,now);}remove(s.mesh);d.shots.splice(i,1);}
 }
}
function beginBotCast(key,point,now,duration){
 const d=state.duel,b=d.bot,origin=b.group.position.clone(),dir=point.clone().sub(origin).setY(0).normalize();
 d.cast={key,dir,origin,point:point.clone(),warning:groundCircle(origin,key==='R'?1.2:.7,0xffb56c,.12),until:d.time+duration};poseWindup(b.group,now,duration,key);if(key!=='E')state.skillshotsFired++;
}
function botAI(dt,now,player){
 const d=state.duel,b=d.bot,c=LEVELS[state.difficultyIndex],bonus=duelBonuses(d.botItems);if(!b.alive)return;d.botMana=Math.min(375,d.botMana+dt*1.7);
 if(b.stunUntil>now){if(d.cast){remove(d.cast.warning);d.cast=null;}d.botAttack=null;return;}
 if(d.cast){if(d.time>=d.cast.until){const cast=d.cast;remove(cast.warning);d.cast=null;
  if(cast.key==='E'){b.group.position.copy(cast.point);if(player.alive&&distance(b,player)<7)bolt(b.group.position,player,8,'enemy','E');}
  else bolt(cast.origin,null,cast.key==='R'?25:cast.key==='W'?0:13,'enemy',cast.key,cast.dir);poseRelease(b.group,now,cast.key);
 }return;}
 if(d.botAttack){if(d.time>=d.botAttack.until){const attack=d.botAttack;d.botAttack=null;if(attack.target.alive){bolt(b.group.position,attack.target,attack.damage,'enemy');poseRelease(b.group,now);}}return;}
 const range=distance(b,player),minions=state.alliedMinions.filter(e=>e.alive),low=minions.filter(e=>e.hp<=65&&distance(b,e)<7).sort((a,b)=>a.hp-b.hp)[0];
 if(d.time>=d.think){
  d.think=d.time+c.reaction+Math.random()*.18;const friendly=state.enemies.filter(e=>e.type==='minion'&&e.alive),escort=friendly.some(e=>e.group.position.x<-9),safe=b.hp<28||(b.group.position.x<-8&&!escort);
  if(safe)d.aim.set(11,0,(Math.random()-.5)*3);
  else if(!minions.length&&escort&&(!player.alive||player.group.position.x<-13))d.aim.set(-11,0,1);
  else if(low)d.aim.copy(low.group.position).add(new THREE.Vector3(4.8,0,0));
  else d.aim.copy(player.group.position).add(new THREE.Vector3(d.style===1?5.8:d.style===2?7:6.4,0,(Math.random()-.5)*3));
  const incoming=state.abilities.shots.find(s=>!s.visualOnly&&s.mesh.position.distanceTo(b.group.position)<4&&s.dir.dot(b.group.position.clone().sub(s.mesh.position))>0);
  if(incoming&&Math.random()>c.miss)d.aim.z=THREE.MathUtils.clamp(b.group.position.z+(Math.random()<.5?-2:2),-5,5);
  if(player.alive&&d.time>=d.nextE&&d.botMana>=70&&!(b.rootUntil>now)&&(range<3||incoming&&b.hp<40)){
   d.nextE=d.time+26;d.botMana-=70;const away=b.group.position.clone().sub(player.group.position).setY(0).normalize().multiplyScalar(4.75).add(b.group.position);away.x=THREE.MathUtils.clamp(away.x,-18,18);away.z=THREE.MathUtils.clamp(away.z,-6,6);beginBotCast('E',away,now,.25);return;
  }
  if(player.alive&&range<18&&range>6&&state.playerHp<35&&d.time>=d.nextR&&d.botMana>=100){d.nextR=d.time+120;d.botMana-=100;beginBotCast('R',player.group.position,now,1);return;}
  if(player.alive&&range<11.5&&range>2&&Math.random()>c.miss){const point=player.group.position.clone();point.z+=(Math.random()-.5)*c.error*2;
   if(d.time>=d.nextW&&d.botMana>=78&&!low){d.nextW=d.time+8;d.botMana-=50;beginBotCast('W',point,now,.25);return;}
   if(d.time>=d.nextQ&&d.botMana>=28){d.nextQ=d.time+Math.max(5.5,c.interval)+Math.random()*.8;d.botMana-=28;beginBotCast('Q',point,now,.25);return;}
  }
 }
 move(b,d.aim,3.25*(1+bonus.move)*enemyMovement(b,now),dt);
 const victim=low||(player.alive&&range<6.6&&b.hp>20?player:null)||minions.find(e=>distance(b,e)<6)||(!minions.length&&b.group.position.x<-9?d.blue:null);
 if(victim&&d.time>=d.nextAA){d.nextAA=d.time+1.5/(1+bonus.speed);if(Math.random()>c.miss){d.botAttack={target:victim,damage:(victim.player?8:victim.type==='tower'?45:65)*(1+bonus.damage),until:d.time+.2};poseWindup(b.group,now,.2);if(victim.player)d.botAggroUntil=d.time+3;}}
}
function duelMinion(unit,opponents,hero,tower,dt,now){
 if(!unit.alive)return;const st=laneUnitStats(unit),d=state.duel,aggro=unit.team==='enemy'?d.aggressionUntil>d.time:d.botAggroUntil>d.time;
 const target=aggro&&hero.alive&&distance(unit,hero)<4.5?hero:opponents.slice().sort((a,b)=>(distance(unit,a)+Math.abs((unit.laneSlot||0)-(a.laneSlot||0))*1.3)-(distance(unit,b)+Math.abs((unit.laneSlot||0)-(b.laneSlot||0))*1.3))[0]||tower;
 if(!target?.alive)return;const gap=distance(unit,target);
 const range=st.range+unit.radius+target.radius;
 if(gap>range)move(unit,minionRoute(unit,target.group.position),st.move*1.8*enemyMovement(unit,now),dt);
 else if(now>=unit.nextAttack){unit.nextAttack=now+st.interval;const amount=st.damage*((target.player||target.type==='duelist')?.15:1);if(unit.minionClass==='caster')bolt(unit.group.position,target,amount,unit.team,'MINION');else take(target,amount,unit.team,now);}
}
export function updateDuel(dt,now){
 const d=state.duel;if(state.mode!=='DUEL'||!d||d.phase!=='play')return;d.time+=dt;
 const player={group:state.player,radius:state.PLAYER_RADIUS,player:true,get alive(){return state.playerHp>0;},get hp(){return state.playerHp;}};
 if(state.playerHp<=0&&!d.playerRespawn){d.playerRespawn=d.time+5;d.kills[1]++;state.order.type='idle';state.attackState='idle';state.player.visible=false;}
 if(d.playerRespawn&&d.time>=d.playerRespawn){state.playerHp=100;state.player.visible=true;state.player.position.set(-14,0,0);resetAbilities();d.playerRespawn=0;}
 if(!d.bot.alive&&!d.botRespawn){d.botRespawn=d.time+5;d.kills[0]++;}
 if(d.botRespawn&&d.time>=d.botRespawn){d.bot.alive=true;d.bot.group.visible=true;d.bot.hp=100;d.botMana=375;d.bot.stunUntil=0;d.bot.group.position.set(14,0,0);d.botRespawn=0;d.bot.rootUntil=0;d.bot.slowUntil=0;}
 if(d.time>=d.nextWave)wave();
 const allies=state.alliedMinions.filter(e=>e.alive),enemies=state.enemies.filter(e=>e.type==='minion'&&e.alive);
 for(const a of allies)duelMinion(a,enemies,d.bot,d.red,dt,now);
 for(const e of enemies)duelMinion(e,allies,player,d.blue,dt,now);
 separateMinions([...allies,...enemies]);animateMinions([...allies,...enemies],now);
 botAI(dt,now,player);shots(dt,now,player);
 for(const t of [d.blue,d.red]){
  const hostile=t.team==='ally'?enemies:allies,hero=t.team==='ally'?d.bot:player;
  const targets=hostile.filter(e=>distance(t,e)<7),aggro=t===d.red?d.aggressionUntil>d.time:d.botAggroUntil>d.time;
  const target=(aggro&&hero.alive&&distance(t,hero)<7?hero:null)||targets[0]||(hero.alive&&distance(t,hero)<7?hero:null);
  if(t.alive&&target&&now>=t.nextAttack){t.nextAttack=now+1;bolt(t.group.position,target,target.player||target.type==='duelist'?20:100,t.team,'TOWER');}
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

