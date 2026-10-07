import * as THREE from 'three';
import { state } from './state.js';
import { createEnemy, setEnemyAppearance } from './entities.js';
import { makeMinionHpBar, updateMinionHpBar } from './minions.js';
import { championById } from './roster.js';
import { ABILITY_DATA } from './ability-data.js';
import { createSkillBolt, groundCircle, hurtPlayer, enemyMovement } from './abilities.js';
import { disposeObject } from './champions.js';
import { clampPoint } from './player.js';
import { toast } from './ui.js';
import { poseWindup, poseRelease, cancelPose, burst, playCue } from './presentation.js';

import { noteEvade } from './micro.js';
const POOL=['Ezreal','Ashe','Jinx','Varus','Caitlyn','Jhin','Kaisa','MissFortune','Lucian'];
const SPELLS={
 Ezreal:{key:'Q',shape:'line',width:.28,speed:14,damage:10},
 Ashe:{key:'W',shape:'fan',width:.18,speed:12,damage:8},
 Jinx:{key:'W',shape:'line',width:.2,speed:17,damage:11},
 Varus:{key:'Q',shape:'line',width:.4,speed:16,damage:12},
 Caitlyn:{key:'Q',shape:'line',width:.7,speed:14,damage:11},
 Jhin:{key:'W',shape:'line',width:.16,speed:20,damage:11},
 Kaisa:{key:'W',shape:'line',width:.5,speed:15,damage:12},
 MissFortune:{key:'E',shape:'area',width:2.1,speed:0,damage:5},
 Lucian:{key:'W',shape:'line',width:.45,speed:15,damage:10}
};
function remove(mesh){state.scene.remove(mesh);disposeObject(mesh);}
export function resetOpponents(){
 if(state.opponents)for(const cast of state.opponents.casts){if(cast.warning)remove(cast.warning);for(const shot of cast.shots)remove(shot.mesh);if(cast.area)remove(cast.area);}
 state.opponents=null;document.querySelector('#enemyCast').textContent='';
}
function assign(enemy,id){setEnemyAppearance(enemy,id);enemy.name=championById(id).name;enemy.type='caster';enemy.radius=.76;enemy.alive=true;enemy.group.visible=true;enemy.hp=enemy.maxHp=650;enemy.castProfile=id;enemy.rootUntil=0;enemy.slowUntil=0;enemy.microOpeningUntil=0;enemy.recoverUntil=0;}
export function startOpponents(mode){
 if(!['DODGE','COMBINED'].includes(mode))return;
 const count=mode==='COMBINED'?(state.difficultyIndex===2?2:1):state.difficultyIndex+1;
 const first=Math.floor(Math.random()*POOL.length),data={casters:[],casts:[],next:performance.now()/1000+1.2,turn:0,rotation:performance.now()/1000+10,pool:(first+count-1)%POOL.length};state.opponents=data;
 for(let i=0;i<count;i++){const p=clampPoint(state.player.position.clone().add(new THREE.Vector3(9+i*2,0,(i-1)*5)));const enemy=createEnemy('',p.x,p.z);assign(enemy,POOL[(first+i)%POOL.length]);makeMinionHpBar(enemy);data.casters.push(enemy);}
 if(mode==='COMBINED'){setEnemyAppearance(state.mainDummy,'Lucian');state.mainDummy.name='ルシアン · 追跡役';}
}
function warning(enemy,now){
 const profile=SPELLS[enemy.castProfile],origin=enemy.group.position.clone().setY(1),point=state.player.position.clone().setY(0),dir=point.clone().sub(origin).setY(0).normalize(),angle=Math.atan2(dir.x,dir.z),range=24;
 const windup=[.9,.7,.55][state.difficultyIndex]+(enemy.castProfile==='Varus'?.4:0);
 let mesh;
 if(profile.shape==='area')mesh=groundCircle(point,profile.width,0xffae6b,.2);
 else{mesh=new THREE.Group();const count=profile.shape==='fan'?5:1;for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*.16;const line=new THREE.Mesh(new THREE.PlaneGeometry(profile.width*2,range),new THREE.MeshBasicMaterial({color:0xffad77,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));line.rotation.set(-Math.PI/2,0,a);line.position.copy(origin).add(new THREE.Vector3(Math.sin(a),0,Math.cos(a)).multiplyScalar(range/2)).setY(.08);mesh.add(line);}state.scene.add(mesh);}
 enemy.group.lookAt(point.x,0,point.z);state.skillshotsFired++;
 poseWindup(enemy.group,now,windup,profile.key);enemy.microOpeningUntil=now+windup+.35;
 const cast={enemy,id:enemy.castProfile,profile,origin,point,dir,angle,warning:mesh,release:now+windup,shots:[],area:null,life:6,hit:false,resolved:false,nextTick:0,near:Infinity,evadeNoted:false};state.opponents.casts.push(cast);
 document.querySelector('#enemyCast').textContent=`${championById(cast.id).name} ${profile.key} — ${ABILITY_DATA[cast.id][profile.key].name}`;
}
function release(cast,now){
 cast.enemy.recoverUntil=now+.35;
 remove(cast.warning);cast.warning=null;
 poseRelease(cast.enemy.group,now,cast.profile.key);
 if(cast.profile.shape==='area'){cast.area=groundCircle(cast.point,cast.profile.width,championById(cast.id).color,.4);cast.life=1.5;return;}
 const count=cast.profile.shape==='fan'?5:1;
 for(let i=0;i<count;i++){const angle=cast.angle+(i-(count-1)/2)*.16,dir=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle));const mesh=createSkillBolt(championById(cast.id).color,cast.profile.width,['Ashe','Varus'].includes(cast.id),{id:cast.id,key:cast.profile.key});mesh.position.copy(cast.origin);mesh.lookAt(cast.origin.clone().add(dir));state.scene.add(mesh);cast.shots.push({mesh,dir,traveled:0});}
}
function hit(cast,now){
 state.micro?.windows.delete(cast.enemy);
 if(!cast.hit){cast.hit=true;state.skillshotsHit++;toast(`${championById(cast.id).name} ${cast.profile.key} 被弾 — 予告を横へ避けよう`,'bad');state.score=Math.max(0,state.score-50);}
 hurtPlayer(cast.profile.damage,now);state.playerSlowUntil=now+.45;state.playerSlowFactor=.8;
 burst(state.player.position.clone().setY(.3),cast.id);playCue(cast.id,'impact');
}
export function updateOpponents(dt,now){
 const data=state.opponents;if(!data)return;
 for(let i=0;i<data.casters.length;i++){const enemy=data.casters[i];if(!enemy.alive){if(now>enemy.respawnAt+2){data.pool=(data.pool+1)%POOL.length;assign(enemy,POOL[data.pool]);enemy.group.position.copy(clampPoint(state.player.position.clone().add(new THREE.Vector3(10,0,(i-.5)*6))));}updateMinionHpBar(enemy);continue;}
  const delta=state.player.position.clone().sub(enemy.group.position).setY(0),distance=delta.length(),casting=data.casts.some(c=>c.enemy===enemy&&c.warning);
  if(!casting&&now>=enemy.recoverUntil&&distance>0){const direction=delta.normalize(),speed=enemyMovement(enemy,now);if(distance>11)enemy.group.position.addScaledVector(direction,1.8*dt*speed);else if(distance<8)enemy.group.position.addScaledVector(direction,-1.4*dt*speed);else enemy.group.position.addScaledVector(new THREE.Vector3(-direction.z,0,direction.x),Math.sin(now*.65+i*2)*.85*dt*speed);clampPoint(enemy.group.position);enemy.group.lookAt(state.player.position.x,0,state.player.position.z);}
  updateMinionHpBar(enemy);
 }
 if(now>=data.rotation){data.rotation=now+10;const enemy=data.casters[data.turn%data.casters.length];if(enemy.alive&&!data.casts.some(c=>c.enemy===enemy&&c.warning)){data.pool=(data.pool+1)%POOL.length;assign(enemy,POOL[data.pool]);}}
 if(now>=data.next){data.next=now+[2.6,2.0,1.6][state.difficultyIndex];const available=data.casters.filter(e=>e.alive&&enemyMovement(e,now)>0&&e.group.position.distanceTo(state.player.position)<22);if(available.length){const enemy=available[data.turn++%available.length];warning(enemy,now);}}
 for(let i=data.casts.length-1;i>=0;i--){const cast=data.casts[i];cast.life-=dt;
  if(cast.warning){if(!cast.enemy.alive||cast.enemy.rootUntil>now){cancelPose(cast.enemy.group);remove(cast.warning);data.casts.splice(i,1);continue;}if(now>=cast.release)release(cast,now);else continue;}
  if(cast.area){cast.nextTick-=dt;if(cast.nextTick<=0){cast.nextTick=.4;if(state.player.position.distanceTo(cast.point)<cast.profile.width+.3)hit(cast,now);}}
  for(let j=cast.shots.length-1;j>=0;j--){const shot=cast.shots[j],previous=shot.mesh.position.clone(),step=cast.profile.speed*dt;shot.mesh.position.addScaledVector(shot.dir,step);shot.traveled+=step;const player=state.player.position.clone().setY(1),segment=new THREE.Line3(previous,shot.mesh.position);
   const separation=segment.closestPointToPoint(player,true,new THREE.Vector3()).distanceTo(player);cast.near=Math.min(cast.near,separation);
   const collision=!cast.hit&&separation<.5+cast.profile.width;
   if(collision){hit(cast,now);remove(shot.mesh);cast.shots.splice(j,1);}else if(shot.traveled>=24){remove(shot.mesh);cast.shots.splice(j,1);}
  }
  if(!cast.hit&&!cast.evadeNoted&&!cast.area&&cast.near<2.5&&cast.shots.every(s=>s.mesh.position.clone().sub(state.player.position).setY(0).dot(s.dir)>1.5)){cast.evadeNoted=true;noteEvade(cast.enemy,now);}
  if(cast.life<=0||!cast.area&&!cast.shots.length){if(!cast.hit){state.dodges++;state.score+=35;}if(cast.area)remove(cast.area);for(const shot of cast.shots)remove(shot.mesh);data.casts.splice(i,1);}
 }
 const pending=data.casts.find(c=>c.warning);if(!pending)document.querySelector('#enemyCast').textContent=data.casters.filter(e=>e.alive).map(e=>`${e.name} ${SPELLS[e.castProfile].key}`).join(' / ');
}
