import * as THREE from 'three';
import { state } from './state.js';
import { ABILITY_DATA } from './ability-data.js';
import { livingEnemies, pickEnemy } from './entities.js';
import { damageEnemy, cancelWindup, issueAttack } from './combat.js';
import { clampPoint, issueStop } from './player.js';
import { disposeObject } from './champions.js';
import { screenToGround } from './camera.js';
import { toast } from './ui.js';
import { signatureProjectile, poseWindup, poseRelease, burst, playCue } from './presentation.js';
import { castRule, castDescription } from './cast-rules.js';

// Costs and cooldowns are deliberately shorter training rules, not live LoL balance.
const RULES={
 Ashe:[[6,6,'4回のAAで発動可能。4秒間、攻撃速度とAA威力が上昇。'],[9,8,'カーソル方向へ扇状の矢。命中した敵をスロウ。'],[12,0,'ホークを飛ばし、5秒間敵のリングを強調。練習マップに視界の霧はありません。'],[24,18,'敵チャンピオンに当たる大型の矢。スタンと周囲へのダメージ。']],
 Caitlyn:[[6,8,'カーソル方向へ貫通するライフル弾。'],[8,6,'指定地点に罠。触れたチャンピオンを拘束し、ヘッドショットを強化。'],[10,8,'ネットを撃ち、反対方向へ跳ぶ。命中するとスロウ。'],[24,18,'カーソルに近いチャンピオンを1秒狙撃。他のチャンピオンが弾を遮れる。']],
 Jinx:[[.9,0,'ミニガン／ロケットを切替。ロケットは射程・範囲ダメージ増加、マナ消費。'],[6,8,'細い直線のレーザー。最初の敵にダメージとスロウ。'],[12,10,'指定地点へ3つの罠。触れたチャンピオンを拘束。'],[24,18,'チャンピオンに当たる大型ロケット。爆発と減少HPに応じた追加ダメージ。']],
 Jhin:[[5,6,'近くの敵へグレネード。最大4体に跳ね、倒すと次の威力が増加。'],[8,8,'長射程の弾。チャンピオンに止まり、直前に攻撃した対象は拘束。'],[10,8,'指定地点に花の罠。敵が踏むとスロウ、その後爆発。'],[24,18,'Rで構え、Rを再入力して4発を狙って撃つ。4発目を強化。移動で解除。']],
 Ezreal:[[4,6,'直線の弾。命中するとQ/W/E/Rの待ち時間を1秒短縮。'],[7,6,'チャンピオンに印。続くAAかスキルで印を爆発させる。'],[10,10,'カーソルへブリンク。印の付いた敵を優先して自動攻撃。'],[24,18,'短く構えてから、敵を貫通する大きな波動。']],
 Lucian:[[5,6,'近くの敵を指定し、その背後まで貫通する光線。'],[8,8,'星形に爆発する弾で印。印へのAAで移動速度上昇。'],[7,6,'カーソル方向へダッシュ。スキル後のAAは二連射。'],[24,18,'狙った方向へ連射。移動しながら撃てる。R再入力で中止。']],
 Vayne:[[4,4,'カーソルへタンブル。次のAAを強化。'],[0,0,'自動効果：同じ敵に3回連続で命中すると追加確定ダメージ。'],[10,8,'近くの敵を吹き飛ばす。壁に当てるとスタンと追加ダメージ。'],[24,16,'8秒間攻撃力増加。タンブルの待ち時間短縮と一時的なステルス。']],
 MissFortune:[[5,6,'近くの敵へ跳弾。後方の別の敵に跳ねる。'],[9,8,'4秒間攻撃速度と移動速度を上げる。'],[10,10,'指定地点に2秒間の弾丸の雨。範囲内へダメージとスロウ。'],[24,18,'前方へ3秒間、扇状に連射。移動かR再入力で中止。']],
 Varus:[[7,6,'Qを押し続けてチャージ、離すと発射。長く構えるほど射程と威力が上昇。'],[14,6,'次のQを強化。AAの枯死スタックを他のスキルで爆発させる。'],[10,10,'指定地点へ矢の雨。範囲に残るスロウ。'],[24,18,'最初のチャンピオンを拘束。近くの別のチャンピオンへ連鎖。']],
 Kaisa:[[5,6,'近くの敵へ6発の追尾ミサイルを分配。'],[9,8,'長射程のミサイル。チャンピオンへプラズマを付ける。'],[10,8,'0.6秒の移動速度上昇後、攻撃速度上昇。チャージ中はAA不可。'],[24,16,'プラズマの付いたチャンピオン付近へダッシュし、シールドを得る。']]
};
export function abilityKit(id=state.selectedChampion?.id||'Ashe'){
 const data=ABILITY_DATA[id];return Object.fromEntries('QWER'.split('').map((key,i)=>[key,{...data[key],cooldown:RULES[id][i][0],cost:RULES[id][i][1],description:RULES[id][i][2]+' '+castDescription(id,key),passive:id==='Vayne'&&key==='W'}]));
}
export function createSkillBolt(color=0x65d9ff,radius=.16,arrow=false,identity=null){
 const signature=identity&&signatureProjectile(identity.id,identity.key,radius);if(signature)return signature;
 const root=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color});
 const tip=new THREE.Mesh(arrow?new THREE.ConeGeometry(radius*1.5,.65,6):new THREE.SphereGeometry(radius,10,8),mat);if(arrow)tip.rotation.x=Math.PI/2;root.add(tip);
 const tail=new THREE.Mesh(new THREE.CylinderGeometry(radius*.3,radius*.6,.9,6),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.45}));tail.rotation.x=Math.PI/2;tail.position.z=-.4;root.add(tail);return root;
}
export function groundCircle(point,radius,color,opacity=.3){
 const group=new THREE.Group();const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false});
 const disk=new THREE.Mesh(new THREE.CircleGeometry(radius,48),material);disk.rotation.x=-Math.PI/2;group.add(disk);
 const ring=new THREE.Mesh(new THREE.RingGeometry(radius-.04,radius,48),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;group.add(ring);group.position.copy(point).setY(.08);state.scene.add(group);return group;
}
function remove(mesh){state.scene.remove(mesh);disposeObject(mesh);}
function fx(point,radius,color,life=.4){const mesh=groundCircle(point,radius,color,.3);state.abilities.effects.push({mesh,life,total:life});}
export function resetAbilities(){
 const old=state.abilities;if(old)for(const list of ['shots','traps','areas','effects'])for(const item of old[list])remove(item.mesh);
 state.abilities={cooldowns:{Q:0,W:0,E:0,R:0,D:0,F:0},mana:100,maxMana:100,shots:[],traps:[],areas:[],effects:[],buffs:{},cast:null,dash:null,charge:null,channel:null,focus:0,rocket:false,casts:0,hits:0,flash:0,heal:0,passiveTarget:null,passiveStacks:0};
 state.playerShield=0;state.shieldUntil=0;state.playerRootUntil=0;state.playerSlowUntil=0;state.playerSlowFactor=1;state.lastPlayerDamage=-Infinity;
 for(const enemy of state.enemies){enemy.rootUntil=0;enemy.slowUntil=0;enemy.mark=null;enemy.plasma=0;enemy.blight=0;enemy.lastPlayerHit=-Infinity;enemy.headshot=false;}
 refreshPlayerStats();renderAbilityHud();
}
export function refreshPlayerStats(now=performance.now()/1000){
 const p=state.selectedChampion;if(!p)return;const a=state.abilities,b=a?.buffs||{};
 const training=['KITE','COMBINED'].includes(state.mode)?1.65:1;
 let as=p.as*training,move=p.move*.01,damage=p.damage,range=p.range*.01;
 if(b.as>now)as*=1.5;if(b.ashe>now){as*=1.45;damage*=1.2;}if(a?.rocket){range+=1.5;as*=.85;}else if(p.id==='Jinx'&&b.jinxRamp>now)as*=1+(a.jinxStacks||0)*.12;
 if(p.id==='Kaisa'&&b.kaisaCharge<=now&&b.kaisaAttackUntil>now)as*=1.5;
 if(p.id==='Ezreal'&&b.ezrealStacks>now)as*=1+(a.ezrealStacks||0)*.1;
 if(b.vayne>now){damage+=25;move*=1.15;}if(b.move>now)move*=1.3;if(b.kaisaCharge>now)move*=1.6;
 if(a?.charge)move*=.7;if(state.playerSlowUntil>now)move*=state.playerSlowFactor;
 if(p.id==='MissFortune'&&now-state.lastPlayerDamage>5)move*=1.1;
 state.ATTACK_SPEED=as;state.ATTACK_INTERVAL=1/as;state.WINDUP_TIME=Math.min(.20,state.ATTACK_INTERVAL*(p.id==='Jhin'?.22:.16));state.MOVE_SPEED=move;state.ATTACK_DAMAGE=damage;state.ATTACK_RANGE=range;
 if(state.lastAbilityRange!==range){state.rangeRing.geometry.dispose();state.rangeRing.geometry=new THREE.RingGeometry(range+state.PLAYER_RADIUS-.035,range+state.PLAYER_RADIUS+.035,128);state.lastAbilityRange=range;}
}
export function enemyMovement(enemy,now=performance.now()/1000){return enemy.rootUntil>now?0:enemy.slowUntil>now?(enemy.slowFactor||.55):1;}
export function hurtPlayer(amount,now=performance.now()/1000){
 const shield=Math.min(state.playerShield||0,amount);state.playerShield=Math.max(0,(state.playerShield||0)-shield);state.playerHp=Math.max(0,state.playerHp-(amount-shield));state.lastPlayerDamage=now;return amount-shield;
}
function targetAt(point,range=9,championOnly=false){
 return livingEnemies().filter(e=>state.player.position.distanceTo(e.group.position)<=range+e.radius&&e.group.position.distanceTo(point)<=e.radius+1.25&&(!championOnly||e.type!=='minion')).sort((a,b)=>a.group.position.distanceToSquared(point)-b.group.position.distanceToSquared(point))[0];
}
function direction(point){const d=point.clone().sub(state.player.position).setY(0);if(d.lengthSq()<.001)d.set(1,0,0);return d.normalize();}
function dash(point,distance,now,blink=false){
 const before=state.player.position.clone(),d=direction(point),length=Math.min(distance,before.distanceTo(point)),destination=clampPoint(before.clone().addScaledVector(d,length));cancelWindup('skill');
 if(blink)state.player.position.copy(destination);else state.abilities.dash={start:before,end:destination,started:now,until:now+Math.max(.1,length/20),resetAttack:castRule(state.selectedChampion.id,state.abilities.executingKey).resetAttack};
 fx(before,.75,blink?0xffde6a:state.selectedChampion.color);fx(destination,.9,blink?0xffde6a:state.selectedChampion.color);
}
function hit(enemy,damage,now,effect={}){
 if(!enemy?.alive)return;state.abilities.hits++;
 burst(enemy.group.position.clone().setY(.3),state.selectedChampion.id);playCue(state.selectedChampion.id,'impact');
 if(effect.missingHp)damage+=(enemy.maxHp-enemy.hp)*.18;
 if(enemy.mark==='Ezreal'){damage+=60;enemy.mark=null;fx(enemy.group.position,1.1,0xeac45c);}if(enemy.blight&&state.selectedChampion.id==='Varus'){damage+=enemy.blight*25;enemy.blight=0;}
 damageEnemy(enemy,damage,now,true,true);enemy.lastPlayerHit=now;
 if(effect.slow){enemy.slowUntil=now+(effect.duration||2);enemy.slowFactor=effect.slow;}
 if(effect.root)enemy.rootUntil=now+effect.root;
 if(effect.headshot)enemy.headshot=true;
 if(effect.plasma)enemy.plasma=(enemy.plasma||0)+effect.plasma;
 if(effect.mark)enemy.mark=effect.mark;
 if(effect.reduce)for(const key of 'QWER')state.abilities.cooldowns[key]=Math.max(now,state.abilities.cooldowns[key]-1);
 if(effect.splash)for(const e of livingEnemies())if(e!==enemy&&e.group.position.distanceTo(enemy.group.position)<effect.splash)damageEnemy(e,damage*.5,now,true,true);
 if(effect.chain)for(const e of livingEnemies())if(e!==enemy&&e.type!=='minion'&&e.group.position.distanceTo(enemy.group.position)<4){e.rootUntil=now+1.5;damageEnemy(e,70,now,true,true);fx(e.group.position,.8,0xb774ec);}
 if(state.selectedChampion.id==='Ezreal'){state.abilities.ezrealStacks=Math.min(5,(state.abilities.buffs.ezrealStacks>now?state.abilities.ezrealStacks||0:0)+1);state.abilities.buffs.ezrealStacks=now+6;}
}
function shot(point,{damage=90,speed=22,range=14,radius=.25,color=state.selectedChampion.color,pierce=false,championOnly=false,target=null,track=null,effect={},arrow=false,delay=0,hitSet=null,visualOnly=false,visual='Q'}={}){
 const mesh=createSkillBolt(color,radius,arrow,{id:state.selectedChampion.id,key:visual}),origin=state.player.position.clone().setY(1.05),dir=direction(point);mesh.position.copy(origin);mesh.lookAt(origin.clone().add(dir));mesh.visible=delay<=0;state.scene.add(mesh);
 const now=performance.now()/1000;if(state.attackState!=='windup')state.player.lookAt(point.x,0,point.z);if(delay>0)poseWindup(state.player,now,delay,visual);else if(state.attackState!=='windup')poseRelease(state.player,now,visual);
 state.abilities.shots.push({mesh,dir,damage,speed,range,radius,pierce,championOnly,target,track,effect,traveled:0,hit:hitSet||new Set(),delay,visualOnly,visual,released:delay<=0});
}
function fan(point,count,spread,options){const d=direction(point),angle=Math.atan2(d.x,d.z),hitSet=new Set();for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*spread;shot(state.player.position.clone().add(new THREE.Vector3(Math.sin(a),0,Math.cos(a))),{...options,hitSet});}}
function area(point,radius,damage,duration,color=state.selectedChampion.color,effect={slow:.55}){
 const p=clampPoint(point.clone());state.abilities.areas.push({mesh:groundCircle(p,radius,color,.22),point:p,radius,damage,life:duration,nextTick:0,effect});
}
function trap(point,key,now,offset=0){
 const p=clampPoint(point.clone());p.x+=offset;clampPoint(p);const flower=state.selectedChampion.id==='Jhin';
 state.abilities.traps.push({mesh:groundCircle(p,.65,state.selectedChampion.color,.35),point:p,life:flower?15:state.selectedChampion.id==='Jinx'?5:12,arm:now+1,key,flower,triggerAt:0});
}
function showChannelCone(channel){
 const angle=Math.atan2(channel.dir.x,channel.dir.z),shape=new THREE.Shape();shape.moveTo(0,0);for(let i=0;i<=24;i++){const a=angle-Math.PI/6+i*Math.PI/72;shape.lineTo(Math.sin(a)*35,Math.cos(a)*35);}shape.lineTo(0,0);
 const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:0xcba65c,transparent:true,opacity:.10,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=Math.PI/2;mesh.position.copy(state.player.position).setY(.07);state.scene.add(mesh);state.abilities.effects.push({mesh,life:10,total:10,channel});
}
export function cancelChannel(reason='stop'){const a=state.abilities;if(a?.channel&&!(reason==='move'&&a.channel.kind==='lucian')){a.channel=null;toast('チャネリング解除','info');}if(a?.charge&&reason==='stop')a.charge=null;}
export function castSkill(key,point=null,now=performance.now()/1000){
 const a=state.abilities;if(!a||state.menuOpen||state.resultPanel.classList.contains('show')||state.playerHp<=0)return false;
 if(key!=='D'&&key!=='F'&&(a.cast||a.dash||a.buffs.kaisaCharge>now)){toast('発動中：終わってから次のスキルを使おう','info');return false;}
 point=(point||pickEnemy(state.pointerPx.x,state.pointerPx.y)?.group.position||screenToGround(state.pointerPx.x,state.pointerPx.y)||state.player.position.clone().add(new THREE.Vector3(3,0,0))).clone();const id=state.selectedChampion.id,kit=abilityKit(id),rule=kit[key];
 if(key==='R'&&a.channel){if(id==='Jhin'){if(now<a.channel.next)return false;const aim=direction(point);if(aim.dot(a.channel.dir)<Math.cos(Math.PI/6)){toast('R：構えた扇状範囲を狙おう','info');return false;}shot(point,{damage:a.channel.ammo===1?180:100,range:35,speed:30,pierce:true,effect:{slow:.5,stopOnChampion:true,missingHp:true},arrow:true});a.channel.ammo--;a.channel.next=now+.7;if(!a.channel.ammo)a.channel=null;return true;}cancelChannel();return true;}
 if(key==='Q'&&id==='Varus'&&a.charge){releaseCharge(point,now);return true;}
 if(a.charge&&!(id==='Varus'&&key==='W')&&key!=='D'&&key!=='F')return false;
 if(a.channel&&key!=='D'&&key!=='F'&&!(id==='Lucian'&&key==='E'))return false;
 if(rule?.passive){toast('Wは自動効果：同じ敵への3回目の命中を狙おう','info');return false;}
 if(!rule&&key!=='D'&&key!=='F')return false;
 if(now<(a.cooldowns[key]||0)){toast(`${key}：クールダウン中`,'info');return false;}
 if(rule&&a.mana<rule.cost){toast('マナが足りません','info');return false;}
 if(id==='Ashe'&&key==='Q'&&a.focus<4){toast('Q：AAを4回当ててフォーカスをためよう','info');return false;}
 const policy=castRule(id,key);let target;
 const groundRange={'Caitlyn.W':8,'Jinx.E':9.25,'Jhin.E':7.5,'MissFortune.E':10,'Varus.E':9.25}[id+'.'+key];if(groundRange&&point.distanceTo(state.player.position)>groundRange)point.copy(state.player.position.clone().addScaledVector(direction(point),groundRange));
 if(policy.dash&&state.playerRootUntil>now){toast('拘束中は移動スキルを使えません','info');return false;}
 if(policy.targetRange){target=targetAt(point,policy.targetRange,policy.championOnly);if(!target||(id==='Kaisa'&&key==='R'&&!target.plasma)){toast(id==='Kaisa'?'R：プラズマ付きの敵チャンピオンを狙おう':`${key}：射程内の対象を狙おう`,'info');return false;}}
 a.cooldowns[key]=now+(rule?.cooldown||(key==='F'?20:25));if(rule)a.mana-=rule.cost;a.casts++;
 if(key==='F'){if(state.playerRootUntil>now){a.cooldowns.F=0;a.casts--;return false;}cancelChannel('move');a.dash=null;a.flash++;dash(point,4,now,true);return true;}
 if(key==='D'){a.heal++;state.playerHp=Math.min(100,state.playerHp+25);a.buffs.move=now+1;fx(state.player.position,1.4,0x63e793);return true;}
 // Reserve mana/CD once, then resolve the effect only when the stationary cast ends.
 if(policy.duration){cancelWindup('skill');a.cast={key,point,target,started:now,until:now+policy.duration};state.player.lookAt(point.x,0,point.z);poseWindup(state.player,now,policy.duration,key);return true;}
 return executeSkill(key,point,now,target);
}
function executeSkill(key,point,now,target){
 const a=state.abilities,id=state.selectedChampion.id;a.executingKey=key;
 const instant=['Ashe.Q','Jinx.Q','Varus.W','Vayne.R','MissFortune.W','Kaisa.Q'];if(!instant.includes(id+'.'+key))cancelWindup('skill');
 if(a.channel&&!(id==='Lucian'&&key==='E'))a.channel=null;
 if(target&&!target.alive)return false;
 switch(id+'.'+key){
 case 'Ashe.Q':a.focus=0;a.buffs.ashe=now+4;if(state.attackState!=='windup')state.nextAttackReady=now;break;
 case 'Ashe.W':fan(point,9,.10,{damage:90,range:12,arrow:true,visual:'W',effect:{slow:.5}});break;
 case 'Ashe.E':shot(point,{damage:0,range:250,speed:18,radius:.2,pierce:true,color:0xe9e6ad,visualOnly:true,visual:'E'});a.buffs.vision=now+5;fx(point,3,0x74d9cf,2);break;
 case 'Ashe.R':shot(point,{damage:180,range:250,radius:.55,speed:18,championOnly:true,arrow:true,visual:'R',effect:{root:1.6,splash:2.5}});break;
 case 'Caitlyn.Q':shot(point,{damage:135,range:12.5,radius:.45,pierce:true,effect:{falloff:.6}});break;
 case 'Caitlyn.W':trap(point,key,now);break;
 case 'Caitlyn.E':shot(point,{damage:75,range:7.5,radius:.4,effect:{slow:.5,headshot:true}});dash(state.player.position.clone().addScaledVector(direction(point),-4),4,now);break;
 case 'Caitlyn.R':issueStop();a.channel={kind:'snipe',target,until:now+1.5,next:now+1,point:point.clone()};break;
 case 'Jinx.Q':a.rocket=!a.rocket;break;
 case 'Jinx.W':shot(point,{damage:115,range:14.5,speed:28,radius:.22,effect:{slow:.5}});break;
 case 'Jinx.E':for(const offset of [-1.2,0,1.2])trap(point,key,now,offset);break;
 case 'Jinx.R':shot(point,{damage:170,range:250,radius:.45,speed:22,championOnly:true,effect:{splash:3,missingHp:true}});break;
 case 'Jhin.Q':{let next=target,damage=80;const seen=new Set();for(let i=0;i<4&&next;i++){const position=next.group.position.clone();seen.add(next);const dies=next.hp<=damage;hit(next,damage,now);fx(position,.65,0xd09179);if(dies)damage*=1.35;next=livingEnemies().filter(e=>!seen.has(e)&&e.group.position.distanceTo(position)<4).sort((x,y)=>x.group.position.distanceToSquared(position)-y.group.position.distanceToSquared(position))[0];}break;}
 case 'Jhin.W':shot(point,{damage:100,range:30,speed:35,radius:.2,pierce:true,championOnly:false,effect:{jhinRoot:true}});break;
 case 'Jhin.E':trap(point,key,now);break;
 case 'Jhin.R':issueStop();a.channel={kind:'jhin',ammo:4,next:now,until:now+10,dir:direction(point)};showChannelCone(a.channel);break;
 case 'Ezreal.Q':shot(point,{damage:100,range:11.5,effect:{reduce:true}});break;
 case 'Ezreal.W':shot(point,{damage:0,range:11.5,radius:.35,championOnly:true,color:0xffd76c,visual:'W',effect:{mark:'Ezreal'}});break;
 case 'Ezreal.E':dash(point,4.75,now,true);{const enemies=livingEnemies().filter(e=>e.group.position.distanceTo(state.player.position)<7.5).sort((x,y)=>(y.mark==='Ezreal')-(x.mark==='Ezreal')||x.group.position.distanceToSquared(state.player.position)-y.group.position.distanceToSquared(state.player.position));if(enemies[0])shot(enemies[0].group.position,{damage:95,target:enemies[0]});}break;
 case 'Ezreal.R':shot(point,{damage:200,range:250,radius:.8,pierce:true,speed:25,visual:'R',effect:{minionMultiplier:.5}});break;
 case 'Lucian.Q':shot(target.group.position,{damage:110,range:12,pierce:true,radius:.25,speed:60});break;
 case 'Lucian.W':shot(point,{damage:85,range:12,radius:.3,effect:{mark:'Lucian',splash:1.5}});break;
 case 'Lucian.E':dash(point,4.45,now);break;
 case 'Lucian.R':a.channel={kind:'lucian',dir:direction(point),next:now,until:now+3};break;
 case 'Vayne.Q':dash(point,3,now);a.buffs.empower=now+5;if(a.buffs.vayne>now){a.cooldowns.Q=now+2;a.buffs.stealth=now+1;}break;
 case 'Vayne.E':{const before=target.group.position.clone(),delta=before.clone().sub(state.player.position).normalize(),raw=before.clone().addScaledVector(delta,4);target.group.position.copy(clampPoint(raw.clone()));const wall=target.group.position.distanceTo(raw)>.05;hit(target,wall?150:75,now,{root:wall?1.5:0});fx(target.group.position,.8,0xda6665);break;}
 case 'Vayne.R':a.buffs.vayne=now+8;break;
 case 'MissFortune.Q':{const origin=target.group.position.clone(),d=origin.clone().sub(state.player.position).normalize();hit(target,95,now);const behind=livingEnemies().filter(e=>e!==target&&e.group.position.distanceTo(origin)<4&&e.group.position.clone().sub(origin).normalize().dot(d)>.25).sort((x,y)=>x.group.position.distanceToSquared(origin)-y.group.position.distanceToSquared(origin))[0];if(behind)hit(behind,130,now);fx(origin,.6,0xe7b275);break;}
 case 'MissFortune.W':a.buffs.as=now+4;a.buffs.move=now+4;break;
 case 'MissFortune.E':area(state.player.position.clone().addScaledVector(direction(point),Math.min(10,state.player.position.distanceTo(point))),2.3,30,2);break;
 case 'MissFortune.R':issueStop();a.channel={kind:'fortune',dir:direction(point),next:now,until:now+3};break;
 case 'Varus.Q':a.charge={started:now,point:point.clone()};break;
 case 'Varus.W':a.buffs.varusW=now+8;break;
 case 'Varus.E':area(state.player.position.clone().addScaledVector(direction(point),Math.min(12,state.player.position.distanceTo(point))),2.4,35,2.5);break;
 case 'Varus.R':shot(point,{damage:130,range:16,radius:.4,speed:18,championOnly:true,effect:{root:1.5,chain:true}});break;
 case 'Kaisa.Q':{const enemies=livingEnemies().filter(e=>e.group.position.distanceTo(state.player.position)<6);for(let i=0;i<6&&enemies.length;i++){const e=enemies[i%enemies.length];shot(e.group.position,{damage:25,target:e,speed:18,radius:.1});}break;}
 case 'Kaisa.W':shot(point,{damage:140,range:30,speed:20,radius:.38,effect:{plasma:2}});break;
 case 'Kaisa.E':a.buffs.kaisaCharge=now+.6;a.buffs.kaisaAttackUntil=now+4.6;break;
 case 'Kaisa.R':{const destination=point.clone().sub(target.group.position);if(destination.lengthSq()<.01)destination.set(-1,0,0);destination.normalize().multiplyScalar(1.7).add(target.group.position);dash(destination,25,now);state.playerShield=30;state.shieldUntil=now+3;break;}
 }
 if(id==='Lucian'&&key!=='R')a.buffs.double=now+4;
 refreshPlayerStats(now);fx(state.player.position,.65,state.selectedChampion.color,.22);return true;
}
export function releaseCharge(point=null,now=performance.now()/1000){
 const a=state.abilities;if(!a?.charge)return;point=point||(state.pointerInside?screenToGround(state.pointerPx.x,state.pointerPx.y):null)||a.charge.point;
 const power=Math.min(1,(now-a.charge.started)/1.25),empowered=a.buffs.varusW>now;a.charge=null;delete a.buffs.varusW;a.cast={key:'Q',point:point.clone(),started:now,until:now+.25,varusShot:{damage:90+power*100+(empowered?65:0),range:9.25+power*6.75,pierce:true,arrow:true,radius:.3,speed:28}};poseWindup(state.player,now,.25,'Q');
}
export function basicAttackDamage(now){
 const a=state.abilities;if(!a)return state.ATTACK_DAMAGE;let damage=state.ATTACK_DAMAGE;
 if(a.buffs.empower>now){damage*=1.6;delete a.buffs.empower;}
 if(a.rocket){if(a.mana>=3){a.mana-=3;damage*=1.1;}else{a.rocket=false;refreshPlayerStats(now);}}
 return damage;
}
export function onBasicHit(enemy,now,damage){
 const a=state.abilities;if(!a||!enemy)return;const id=state.selectedChampion.id;enemy.lastPlayerHit=now;
 if(enemy.mark==='Ezreal'){enemy.mark=null;damageEnemy(enemy,60,now,true,true);fx(enemy.group.position,1.1,0xffd76c);}
 if(enemy.mark==='Lucian')a.buffs.move=now+1.5;
 if(id==='Ashe'){a.focus=Math.min(4,a.focus+1);enemy.slowUntil=now+1.8;enemy.slowFactor=.65;}
 if(id==='Jinx'&&!a.rocket){a.jinxStacks=Math.min(3,(a.buffs.jinxRamp>now?a.jinxStacks||0:0)+1);a.buffs.jinxRamp=now+2;}
 if(id==='Jinx'&&a.rocket)for(const e of livingEnemies())if(e!==enemy&&e.group.position.distanceTo(enemy.group.position)<1.8)damageEnemy(e,damage*.6,now,true,true);
 if(id==='Caitlyn'){a.passiveStacks++;if(enemy.headshot||a.passiveStacks>=6){enemy.headshot=false;a.passiveStacks=0;damageEnemy(enemy,damage*.7,now,true,true);fx(enemy.group.position,.6,0xf4d077);}}
 if(id==='Vayne'){if(a.passiveTarget!==enemy){a.passiveTarget=enemy;a.passiveStacks=0;}a.passiveStacks++;if(a.passiveStacks===3){a.passiveStacks=0;damageEnemy(enemy,Math.max(40,enemy.maxHp*.06),now,true,true);fx(enemy.group.position,.8,0xe7dddd);}}
 if(id==='Varus')enemy.blight=Math.min(3,(enemy.blight||0)+1);
 if(id==='Kaisa'){enemy.plasma=(enemy.plasma||0)+1;if(enemy.plasma>=5){enemy.plasma=0;damageEnemy(enemy,75,now,true,true);fx(enemy.group.position,1,0xba77f2);}}
 if(id==='Lucian'&&a.buffs.double>now){delete a.buffs.double;damageEnemy(enemy,damage*.5,now,true,true);a.cooldowns.E=Math.max(now,a.cooldowns.E-1);fx(enemy.group.position,.5,0xebdc9b);}
 if(id==='MissFortune'&&a.passiveTarget!==enemy){a.passiveTarget=enemy;damageEnemy(enemy,damage*.35,now,true,true);}
}
export function updateAbilities(dt,now){
 const a=state.abilities;if(!a)return;a.mana=Math.min(100,a.mana+dt*3);if(state.shieldUntil<=now)state.playerShield=0;refreshPlayerStats(now);
 if(state.playerHp<=0){a.cast=null;a.dash=null;a.charge=null;a.channel=null;}
 if(a.dash){const d=a.dash;state.player.position.lerpVectors(d.start,d.end,THREE.MathUtils.clamp((now-d.started)/(d.until-d.started),0,1));if(now>=d.until){a.dash=null;if(d.resetAttack)state.nextAttackReady=now;}}
 if(a.cast&&now>=a.cast.until){const cast=a.cast;a.cast=null;if(cast.varusShot)shot(cast.point,cast.varusShot);else executeSkill(cast.key,cast.point,now,cast.target);}
 if(a.charge&&now-a.charge.started>=4)releaseCharge(null,now);
 if(a.channel){const c=a.channel;if(c.until<=now||c.target&&!c.target.alive)a.channel=null;else if(c.next<=now){
  if(c.kind==='snipe'){shot(c.target.group.position,{damage:220,range:40,championOnly:true,speed:24,track:c.target});a.channel=null;}
  if(c.kind==='lucian'){shot(state.player.position.clone().add(c.dir),{damage:20,range:15,speed:26,radius:.12});c.next=now+.12;}
  if(c.kind==='fortune'){fan(state.player.position.clone().add(c.dir),5,.16,{damage:24,range:13,speed:26,radius:.16,pierce:true});c.next=now+.28;}
 }}
 for(let i=a.shots.length-1;i>=0;i--){const p=a.shots[i];p.delay-=dt;if(p.delay>0)continue;if(!p.released){p.released=true;p.mesh.visible=true;poseRelease(state.player,now,p.visual);}const tracking=p.target||p.track;if(tracking&&!tracking.alive){remove(p.mesh);a.shots.splice(i,1);continue;}
  if(tracking)p.dir.copy(tracking.group.position).setY(1).sub(p.mesh.position).normalize();
  const previous=p.mesh.position.clone(),step=Math.min(p.range-p.traveled,p.speed*dt);p.mesh.position.addScaledVector(p.dir,step);p.mesh.lookAt(p.mesh.position.clone().add(p.dir));p.traveled+=step;
  const segment=new THREE.Line3(previous,p.mesh.position);let stop=false;
  const candidates=p.visualOnly?[]:livingEnemies().filter(e=>!p.hit.has(e)&&(!p.championOnly||e.type!=='minion')&&(!p.target||p.target===e)).map(e=>({e,center:e.group.position.clone().setY(1),distance:previous.distanceToSquared(e.group.position)})).sort((x,y)=>x.distance-y.distance);
  for(const {e,center} of candidates){if(segment.closestPointToPoint(center,true,new THREE.Vector3()).distanceTo(center)>e.radius+p.radius)continue;p.hit.add(e);const effect={...p.effect};if(effect.jhinRoot&&now-e.lastPlayerHit<4)effect.root=1.3;if(p.visual==='R'&&state.selectedChampion.id==='Ashe')effect.root=Math.min(3.5,.5+p.traveled*.1);hit(e,p.damage*(e.type==='minion'?(effect.minionMultiplier||1):1),now,effect);if(effect.falloff&&p.hit.size===1)p.damage*=effect.falloff;if(!p.pierce||((p.effect.jhinRoot||p.effect.stopOnChampion)&&e.type!=='minion')){stop=true;break;}}
  if(stop||p.traveled>=p.range){remove(p.mesh);a.shots.splice(i,1);}
 }
 for(let i=a.traps.length-1;i>=0;i--){const t=a.traps[i];t.life-=dt;const e=livingEnemies().find(e=>(t.flower||e.type!=='minion')&&e.group.position.distanceTo(t.point)<1);
  if(now>=t.arm&&e&&!t.triggerAt){if(t.flower){t.triggerAt=now+.75;e.slowUntil=now+1.5;e.slowFactor=.4;}else{hit(e,state.selectedChampion.id==='Caitlyn'?0:40,now,{root:1.5,headshot:state.selectedChampion.id==='Caitlyn'});t.life=0;}}
  if(t.triggerAt&&now>=t.triggerAt){for(const enemy of livingEnemies())if(enemy.group.position.distanceTo(t.point)<2)hit(enemy,100,now);fx(t.point,2,state.selectedChampion.color);t.life=0;}
  if(t.life<=0){remove(t.mesh);a.traps.splice(i,1);}
 }
 for(let i=a.areas.length-1;i>=0;i--){const area=a.areas[i];area.life-=dt;area.nextTick-=dt;if(area.nextTick<=0){area.nextTick=.4;for(const enemy of livingEnemies())if(enemy.group.position.distanceTo(area.point)<=area.radius)hit(enemy,area.damage,now,area.effect);}if(area.life<=0){remove(area.mesh);a.areas.splice(i,1);}}
 for(let i=a.effects.length-1;i>=0;i--){const e=a.effects[i];e.life-=dt;if(e.channel&&e.channel!==a.channel)e.life=0;if(!e.channel)e.mesh.scale.setScalar(1+(1-e.life/e.total)*.5);if(e.life<=0){remove(e.mesh);a.effects.splice(i,1);}}
 state.player.visible=true;state.player.userData.body?.scale.setScalar(a.buffs.stealth>now?.75:1);
 for(const e of state.enemies)if(e.group.userData.ring)e.group.userData.ring.material.color.setHex(a.buffs.vision>now?0xffe298:e.rootUntil>now?0xb881eb:0xe2515a);
 renderAbilityHud(now);
}
export function renderAbilityHud(now=performance.now()/1000){
 const a=state.abilities;if(!a||!state.selectedChampion)return;const kit=abilityKit();
 for(const key of ['Q','W','E','R','D','F']){const slot=document.querySelector('#skill'+key);if(!slot)continue;const remaining=Math.max(0,a.cooldowns[key]-now),rule=kit[key],recast=(key==='R'&&a.channel)||(key==='Q'&&a.charge);const unavailable=!recast&&rule&&(rule.passive||a.mana<rule.cost||(state.selectedChampion.id==='Ashe'&&key==='Q'&&a.focus<4));
  slot.classList.toggle?.('on-cooldown',remaining>0&&!recast);slot.classList.toggle?.('unavailable',!!unavailable);slot.classList.toggle?.('active',!!recast||a.cast?.key===key||(key==='Q'&&a.rocket));slot.setAttribute?.('aria-label',`${key} ${rule?.name||(key==='D'?'ヒール':'フラッシュ')} ${a.cast?.key===key?'詠唱中':rule?.passive?'自動効果':recast?'再入力可能':remaining>0?remaining.toFixed(1)+'秒':unavailable?'条件待ち':'使用可能'}`);
  const cd=document.querySelector('#cooldown'+key);if(cd)cd.textContent=rule?.passive?'PASSIVE':key==='R'&&a.channel?.ammo?`${a.channel.ammo}発`:key==='Q'&&a.charge?`${Math.round(Math.min(1,(now-a.charge.started)/1.25)*100)}%`:remaining>0&&!recast?Math.ceil(remaining):'';
 }
 document.querySelector('#manaFill').style.width=a.mana+'%';document.querySelector('#manaText').textContent=`${Math.floor(a.mana)} / 100`;
 document.querySelector('#attackTempo').textContent=a.cast?'詠唱中：移動／AA不可':a.dash?'移動スキル中：AA不可':a.charge||a.buffs.kaisaCharge>now?'チャージ中：移動可・AA不可':a.channel?(a.channel.kind==='lucian'?'連射中：移動可・AA不可':'チャネリング中：停止'):state.attackState==='windup'?'発射前：まだ移動しない':state.reloadUntil>now?'リロード：移動しよう':state.nextAttackReady>now?'発射後：移動しよう':'AA READY';
 document.querySelector('#castState').textContent=a.cast?`${a.cast.key} 詠唱中 ${(Math.max(0,a.cast.until-now)).toFixed(2)}秒`:a.dash?'移動スキル中：AA不可':a.buffs.kaisaCharge>now?'E 加速中：AA不可':a.charge?`Q チャージ ${Math.round(Math.min(1,(now-a.charge.started)/1.25)*100)}%`:a.channel?`R ${a.channel.ammo?`${a.channel.ammo}発 / 再入力で発射`:'チャネリング中'}`:state.playerShield>0?`SHIELD ${Math.round(state.playerShield)}`:`SKILL HIT ${a.hits}`;
 document.querySelector('#passiveCounter').textContent=state.selectedChampion.id==='Ashe'?`${a.focus}/4`:state.selectedChampion.id==='Vayne'?`${a.passiveStacks}/3`:'';
}
export function initializeAbilityHud(){
 const kit=abilityKit(),data=ABILITY_DATA[state.selectedChampion.id];document.querySelector('#passiveIcon').src='./assets/abilities/'+data.passive.icon;document.querySelector('#passiveIcon').title=data.passive.name;
 for(const key of ['Q','W','E','R','D','F']){const rule=kit[key],name=rule?.name||(key==='D'?'ヒール':'フラッシュ'),description=rule?.description||(key==='D'?'HPを25回復。移動速度も短く上昇。練習CD 25秒。':'カーソル方向へ最大400ユニットのブリンク。練習CD 20秒。');const icon=rule?.icon||(key==='D'?'SummonerHeal.png':'SummonerFlash.png');
  const button=document.querySelector('#skill'+key);button.title=`${key} ${name} — ${description}${rule&&!rule.passive?` 練習CD ${rule.cooldown}秒 / マナ ${rule.cost}`:''}`;document.querySelector('#icon'+key).src='./assets/abilities/'+icon;document.querySelector('#name'+key).textContent=name;
 }
}
export function bindAbilityHud(){
 for(const key of ['Q','W','E','R','D','F']){const button=document.querySelector('#skill'+key);button.addEventListener('click',()=>{castSkill(key);state.renderer.domElement.focus?.({preventScroll:true});});button.addEventListener('mouseenter',()=>{document.querySelector('#skillTooltip').textContent=button.title;document.querySelector('#skillTooltip').hidden=false;});button.addEventListener('mouseleave',()=>{document.querySelector('#skillTooltip').hidden=true;});}
}

