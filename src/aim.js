import * as THREE from 'three';
import { state } from './state.js';
import { screenToGround } from './camera.js';
import { castSkill, releaseCharge } from './abilities.js';
import { pickEnemy } from './entities.js';
import { castRule } from './cast-rules.js';
import { disposeObject } from './champions.js';
const ranges={Ashe:[6,12,18,25],Caitlyn:[12.5,8,7.5,35],Jinx:[7,14.5,9.25,25],Jhin:[5.5,25,7.5,35],Ezreal:[11.5,11.5,4.75,25],Lucian:[5,9,4.45,15],Vayne:[3,6,5.5,6],MissFortune:[6.5,6,10,13],Varus:[16,6,9.25,13],Kaisa:[6,30,6,20]};
const circles=['Caitlyn.W','Jinx.E','Jhin.E','MissFortune.E','Varus.E'];
export function aimPoint(key){const enemy=key&&castRule(state.selectedChampion.id,key).targetRange?pickEnemy(state.pointerPx.x,state.pointerPx.y):null;if(enemy)return enemy.group.position.clone();return screenToGround(state.pointerPx.x,state.pointerPx.y)||state.player.position.clone().add(new THREE.Vector3(3,0,0));}
export function cancelAim(){if(state.aim){state.scene.remove(state.aim.mesh);disposeObject(state.aim.mesh);state.aim=null;}state.attackMoveArmed=false;state.rangeRing.visible=!!state.showAttackRange;}
export function requestSkill(key,indicator=false){
 if(state.menuOpen||state.settingsOpen||state.playerHp<=0||state.duel?.phase!=='play')return false;
 if(state.selectedChampion.id==='Varus'&&key==='Q'){cancelAim();return castSkill(key,aimPoint(key));}
 if(['Ashe.Q','Jinx.Q','Varus.W','Vayne.R','MissFortune.W','Kaisa.Q','Kaisa.E','Vayne.W'].includes(state.selectedChampion.id+'.'+key)||key==='D'||key==='F'||state.abilities?.channel&&key==='R'||!indicator&&state.controls?.cast==='quick'){cancelAim();return castSkill(key,aimPoint());}
 cancelAim();const mesh=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:0x5dd6de,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false});
 const radius=ranges[state.selectedChampion.id]['QWER'.indexOf(key)]||6;
 const ring=new THREE.Mesh(new THREE.RingGeometry(radius-.035,radius,96),mat);ring.rotation.x=-Math.PI/2;mesh.add(ring);
 const line=new THREE.Mesh(new THREE.PlaneGeometry(.28,radius),mat.clone());line.rotation.x=-Math.PI/2;line.position.z=radius/2;mesh.add(line);
 const area=new THREE.Mesh(new THREE.RingGeometry(1.4,1.5,64),mat.clone());area.rotation.x=-Math.PI/2;mesh.add(area);
 const isFan=['Ashe.W','MissFortune.R','Jhin.R'].includes(state.selectedChampion.id+'.'+key);let fan=null;if(isFan){const vertices=[];for(let i=0;i<48;i++){const a=-Math.PI/6+i*Math.PI/144,b=a+Math.PI/144;vertices.push(0,0,0,Math.sin(a)*radius,0,Math.cos(a)*radius,Math.sin(b)*radius,0,Math.cos(b)*radius);}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));fan=new THREE.Mesh(geometry,mat.clone());fan.material.opacity=.12;mesh.add(fan);}
 state.scene.add(mesh);state.aim={key,mesh,line,area,fan,radius,release:indicator||state.controls.cast==='indicator'};updateAim();return true;
}
export function confirmAim(){if(!state.aim)return false;const key=state.aim.key,point=aimPoint(key);cancelAim();return castSkill(key,point);}
export function releaseSkill(key){if(key==='Q'&&state.selectedChampion.id==='Varus')releaseCharge(aimPoint());else if(state.aim?.key===key&&state.aim.release)confirmAim();}
export function updateAim(){
 const a=state.aim;if(!a)return;const p=aimPoint(),from=state.player.position,d=p.clone().sub(from).setY(0),len=d.length();d.normalize();a.mesh.position.copy(from).setY(.1);a.mesh.rotation.y=Math.atan2(d.x,d.z);
 a.line.visible=!a.fan&&!circles.includes(state.selectedChampion.id+'.'+a.key);a.area.visible=!a.fan&&!a.line.visible;
 a.area.position.z=Math.min(len,a.radius);const policy=castRule(state.selectedChampion.id,a.key);a.mesh.children[0].visible=!!policy.targetRange||a.area.visible||policy.dash;
}
