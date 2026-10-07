import * as THREE from 'three';
import { state } from './state.js';
import { championById } from './roster.js';
const portraits = new Map();

export function disposeObject(root) {
  root.traverse(object => { object.geometry?.dispose(); if (object.material) for (const material of [].concat(object.material)) material.dispose(); });
}

export function buildChampion(profile, team = 'ally') {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const joints = [];
  const mat = color => new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.2});
  const armor = mat(profile.armor), trim = mat(0xc9ad67), hair = mat(profile.hair);
  const skin = mat(profile.id === 'Lucian' ? 0x795346 : 0xd0a88a);
  const glow = new THREE.MeshBasicMaterial({color:profile.color});
  function piece(parent, geometry, material, position, rotation) {
    const mesh = new THREE.Mesh(geometry, material);mesh.position.set(...position);if(rotation)mesh.rotation.set(...rotation);mesh.castShadow=true;parent.add(mesh);return mesh;
  }
  const box=(parent,size,material,position,rotation)=>piece(parent,new THREE.BoxGeometry(...size),material,position,rotation);
  const sphere=(parent,radius,material,position)=>piece(parent,new THREE.SphereGeometry(radius,12,8),material,position);
  const cylinder=(parent,top,bottom,length,material,position,rotation)=>piece(parent,new THREE.CylinderGeometry(top,bottom,length,12),material,position,rotation);
  box(body,[.58,.78,.37],armor,[0,1.3,0]);
  box(body,[.64,.09,.41],trim,[0,.92,0]);
  sphere(body,.27,skin,[0,1.99,.02]);
  sphere(body,.285,hair,[0,2.09,-.07]);
  for(const side of [-1,1]) {
    const leg=new THREE.Group();leg.position.set(side*.18,.9,0);body.add(leg);joints.push(leg);
    cylinder(leg,.125,.14,.72,armor,[0,-.36,0]);box(leg,[.27,.18,.4],armor,[0,-.82,.08]);
    sphere(body,.2,trim,[side*.42,1.61,0]);
    const arm=new THREE.Group();arm.position.set(side*.4,1.55,0);body.add(arm);
    cylinder(arm,.1,.12,.55,armor,[0,-.25,.1],[.35,0,side*.2]);sphere(arm,.12,skin,[0,-.47,.2]);
  }
  const weapon = new THREE.Group();weapon.position.set(.43,1.2,.38);body.add(weapon);
  const barrel=(x=0,len=.8)=>cylinder(weapon,.065,.09,len,trim,[x,0,len*.45],[Math.PI/2,0,0]);
  function bow(material,size=1) {
    const points=[];for(let i=0;i<=16;i++){const a=-Math.PI/2+i*Math.PI/16;points.push(new THREE.Vector3(Math.cos(a)*.35,Math.sin(a)*size/2,0));}
    piece(weapon,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),20,.045,6,false),material,[0,0,0]);
    cylinder(weapon,.008,.008,size,glow,[0,0,0]);barrel(0,.48);
  }
  switch(profile.id) {
    case 'Ashe':
      piece(body,new THREE.ConeGeometry(.57,1.3,8,1,true),armor,[0,1.02,-.25],[.14,0,0]);
      sphere(body,.31,armor,[0,2.04,-.12]);box(body,[.48,.28,.11],hair,[0,1.87,-.25]);bow(glow,1.35);break;
    case 'Caitlyn':
      cylinder(body,.34,.34,.1,armor,[0,2.22,0]);cylinder(body,.24,.27,.48,armor,[0,2.48,0]);
      box(body,[.35,.7,.18],hair,[0,1.73,-.29]);box(weapon,[.17,.18,.45],armor,[0,0,.12]);barrel(0,1.65);sphere(weapon,.085,glow,[0,.15,.62]);break;
    case 'Jinx':
      for(const side of [-1,1]){cylinder(body,.065,.10,1.25,hair,[side*.24,1.4,-.3],[0,0,-side*.15]);sphere(body,.10,hair,[side*.33,.8,-.3]);}
      cylinder(weapon,.25,.25,.65,armor,[0,0,.3],[Math.PI/2,0,0]);for(let i=0;i<6;i++)barrel(Math.cos(i*Math.PI/3)*.17,.85);break;
    case 'Jhin':
      sphere(body,.255,mat(0xf1e7ce),[0,1.99,.13]);box(body,[.075,.055,.04],mat(0x251821),[-.08,2.02,.36]);
      box(body,[.33,.95,.15],mat(0xb49649),[-.38,1.3,-.13],[0,0,.18]);barrel(0,.85);box(weapon,[.17,.28,.15],armor,[0,-.12,0]);break;
    case 'Ezreal':
      for(let i=0;i<5;i++)piece(body,new THREE.ConeGeometry(.12,.3,4),hair,[(i-2)*.1,2.26,.1],[0,0,(i-2)*.22]);
      box(weapon,[.3,.26,.33],trim,[0,0,0]);sphere(weapon,.14,glow,[0,.1,.22]);break;
    case 'Lucian':
      box(body,[.72,.95,.12],armor,[0,1.02,-.25]);for(const x of [-.15,.15]){barrel(x,.7);box(weapon,[.1,.25,.12],armor,[x,-.12,0]);}break;
    case 'Vayne':
      piece(body,new THREE.ConeGeometry(.6,1.1,8,1,true),mat(0xa8293e),[0,1,-.28]);box(body,[.42,.07,.05],mat(0xda333b),[0,2.02,.29]);
      barrel(0,.55);box(weapon,[.78,.08,.1],trim,[0,0,.36]);break;
    case 'MissFortune':
      for(const side of [-1,1])cylinder(body,.1,.17,.8,hair,[side*.24,1.7,-.22],[0,0,-side*.18]);
      piece(body,new THREE.ConeGeometry(.5,.32,3),armor,[0,2.31,0],[0,Math.PI/6,0]);for(const x of [-.19,.19]){barrel(x,.6);box(weapon,[.12,.25,.15],armor,[x,-.12,0]);}break;
    case 'Varus':
      box(body,[.6,.4,.37],skin,[0,1.46,0]);box(body,[.34,.8,.38],armor,[-.15,.51,0]);bow(glow,1.4);break;
    case 'Kaisa':
      box(body,[.42,.7,.14],hair,[0,1.81,-.3]);for(const side of [-1,1]){
        piece(body,new THREE.ConeGeometry(.23,.8,5),armor,[side*.63,1.76,-.12],[.8,0,-side*.5]);sphere(body,.10,glow,[side*.66,1.93,.14]);}sphere(weapon,.1,glow,[0,0,.2]);break;
  }
  const ring=piece(root,new THREE.RingGeometry(.66,.72,48),new THREE.MeshBasicMaterial({color:team==='ally'?0x46c8dc:0xe2515a,side:THREE.DoubleSide,transparent:true,opacity:.85}),[0,.04,0],[-Math.PI/2,0,0]);
  // Shared portrait textures survive model disposal when switching champions.
  if(document.createElementNS) {
    if(!portraits.has(profile.id)){const texture=new THREE.TextureLoader().load(new URL(`../assets/champions/${profile.id}.png`,import.meta.url).href);texture.colorSpace=THREE.SRGBColorSpace;portraits.set(profile.id,texture);}
    const portrait=new THREE.Sprite(new THREE.SpriteMaterial({map:portraits.get(profile.id),depthTest:false,transparent:true}));
    portrait.position.set(0,3.05,0);portrait.scale.set(.65,.65,1);root.add(portrait);
  }
  root.userData={profile:profile.id,body,weapon,joints,ring};return root;
}

export function selectChampion(id) {
  const profile = championById(id);
  const position = state.player.position.clone();
  state.scene.remove(state.player);disposeObject(state.player);
  state.player=buildChampion(profile);state.player.position.copy(position);state.scene.add(state.player);
  state.selectedChampion=profile;
  state.ATTACK_RANGE=profile.range*.01;state.ATTACK_SPEED=profile.as;state.ATTACK_INTERVAL=1/profile.as;
  state.WINDUP_TIME=state.ATTACK_INTERVAL*(profile.id==='Jhin'?.3:.22);
  state.ATTACK_DAMAGE=profile.damage;state.MOVE_SPEED=profile.move*.01;state.PROJECTILE_SPEED=profile.style==='rifle'?28:profile.style==='magic'?22:20;
  state.championShots=0;state.reloadUntil=0;
  state.rangeRing.geometry.dispose();state.rangeRing.geometry=new THREE.RingGeometry(state.ATTACK_RANGE+state.PLAYER_RADIUS-.035,state.ATTACK_RANGE+state.PLAYER_RADIUS+.035,128);
}

export function championProjectile(profile) {
  const root=new THREE.Group();const mat=new THREE.MeshBasicMaterial({color:profile.color});
  const arrow=['arrow','darkbow','crossbow'].includes(profile.style);
  const geometry=arrow?new THREE.ConeGeometry(.09,.6,6):new THREE.SphereGeometry(profile.style==='magic'||profile.style==='void'?.15:.09,8,6);
  const tip=new THREE.Mesh(geometry,mat);if(arrow)tip.rotation.x=Math.PI/2;root.add(tip);
  const trail=new THREE.Mesh(new THREE.CylinderGeometry(.025,.055,.6,6),new THREE.MeshBasicMaterial({color:profile.color,transparent:true,opacity:.45}));trail.rotation.x=Math.PI/2;trail.position.z=-.25;root.add(trail);return root;
}

export function animateChampion(dt, now) {
  if(!state.selectedChampion)return;
  const rig=state.player.userData;if(!rig.body)return;
  const moving=state.order.type==='move'||state.order.type==='attackMove'&&!state.order.target||state.order.type==='attack'&&state.attackState!=='windup'&&state.player.position.distanceTo(state.order.target?.group.position||state.player.position)>state.ATTACK_RANGE+1.4;
  rig.body.position.y=moving?Math.sin(now*12)*.04:Math.sin(now*2)*.015;
  rig.joints.forEach((joint,index)=>joint.rotation.x=moving?Math.sin(now*12+index*Math.PI)*.3:0);
  rig.weapon.rotation.x=state.attackState==='windup'?-.12:Math.max(0,.18-(now-state.lastShotAt)*.6);
}
