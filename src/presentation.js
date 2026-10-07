import * as THREE from 'three';
import { state } from './state.js';

const focused = id => id === 'Ashe' || id === 'Ezreal';
const effects = [];
let audio, soundEnabled = true;
const lastSound = new Map();

// Audio starts only after a user gesture. No downloads or microphone access.
export function unlockSound() {
  if (!soundEnabled) return;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  try { audio ||= new Context(); if (audio.state === 'suspended') audio.resume().catch(() => {}); } catch {}
}
export function bindSoundControl() {
  const button = document.querySelector('#soundToggle');
  const render = () => { button.textContent = soundEnabled ? '音 ON' : '音 OFF'; button.setAttribute('aria-pressed', String(soundEnabled)); };
  button.addEventListener('click', () => { soundEnabled = !soundEnabled; if (soundEnabled) unlockSound(); render(); state.renderer.domElement.focus?.({preventScroll:true}); });
  render();
}
export function playCue(id, event = 'release') {
  if (!focused(id) || !soundEnabled || !audio || audio.state !== 'running') return;
  const time = audio.currentTime, key = id + event;
  if (time - (lastSound.get(key) ?? -Infinity) < .075) return;
  lastSound.set(key,time);
  const impact = event === 'impact', magic = id === 'Ezreal';
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.type = magic ? 'sine' : 'triangle';
  osc.frequency.setValueAtTime(impact ? 380 : magic ? 640 : 920,time);
  osc.frequency.exponentialRampToValueAtTime(impact ? 130 : magic ? 1100 : 180,time+.10);
  gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(impact ? .018 : .028,time+.008);gain.gain.exponentialRampToValueAtTime(.0001,time+.14);
  osc.connect(gain);gain.connect(audio.destination);osc.start(time);osc.stop(time+.15);
}
function dispose(root) { root.traverse(o => { o.geometry?.dispose(); if(o.material)for(const m of [].concat(o.material))m.dispose(); }); }
export function clearPresentation() {
  for(const e of effects){state.scene.remove(e.mesh);dispose(e.mesh);}effects.length=0;
  for(const root of [state.player,...state.enemies.map(e=>e.group)])if(root?.userData){delete root.userData.action;root.userData.previousPosition=null;}
}
export function poseWindup(root, now, duration, key = 'AA') {
  if (!root?.userData.body) return;
  root.userData.action={phase:'windup',start:now,end:now+duration,key};
}
export function poseRelease(root, now, key = 'AA') {
  if(!root?.userData.body)return;
  if(root.userData.action?.phase==='release'&&now-root.userData.action.start<.03&&root.userData.action.key===key)return;
  root.userData.action={phase:'release',start:now,end:now+.26,key};
  const id=root.userData.profile;
  if(focused(id)) { burst(root.position.clone().setY(1.3),id,'release');playCue(id); }
}
export function cancelPose(root) { if(root?.userData.action?.phase==='windup')delete root.userData.action; }

// Visual sizes are independent from collision radii and damage.
export function signatureProjectile(id, key = 'AA', radius = .16) {
  if(!focused(id))return null;
  const root=new THREE.Group(),ice=id==='Ashe',color=ice?0x8be9ff:0x57dfff;
  const material=(c,opacity=1)=>new THREE.MeshBasicMaterial({color:c,transparent:opacity<1,opacity,depthWrite:false});
  const add=(geometry,mat,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);root.add(mesh);return mesh;};
  if(ice&&key==='E') {
    for(const sign of [-1,1]){const wing=add(new THREE.ConeGeometry(.20,.8,3),material(0xe6f7cc),sign*.30,0,0);wing.rotation.z=sign*1.05;wing.rotation.x=Math.PI/2;}
    const head=add(new THREE.ConeGeometry(.13,.5,4),material(0xfff5cf),0,0,.28);head.rotation.x=Math.PI/2;
  } else if(ice) {
    const big=key==='R',width=big?.34:.10,length=big?1.8:.65;
    const head=add(new THREE.ConeGeometry(width,length,4),material(0xbcefff));head.rotation.x=Math.PI/2;
    const shaft=add(new THREE.CylinderGeometry(.025,.025,big?1.8:.8,6),material(color),0,0,-length*.5);shaft.rotation.x=Math.PI/2;
    for(const sign of [-1,1]){const fin=add(new THREE.ConeGeometry(width*.65,length*.5,3),material(color,.65),sign*width*.7,0,-length*.45);fin.rotation.x=Math.PI/2;fin.rotation.z=sign*.6;}
  } else if(key==='R') {
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.2,0,-.3),new THREE.Vector3(-.65,0,.25),new THREE.Vector3(0,0,.45),new THREE.Vector3(.65,0,.25),new THREE.Vector3(1.2,0,-.3)]);
    add(new THREE.TubeGeometry(curve,24,.10,6,false),material(0xffe5a0));
    const halo=add(new THREE.TubeGeometry(curve,24,.23,6,false),material(color,.22));halo.position.z=-.10;
  } else if(key==='W') {
    const ring=add(new THREE.TorusGeometry(.3,.06,6,24),material(0xffd36b));ring.rotation.x=0;
    add(new THREE.SphereGeometry(.16,10,8),material(0xffe6ad,.5));
  } else {
    const core=add(new THREE.OctahedronGeometry(key==='AA'?.13:.22),material(0xffedb7));core.scale.z=2.2;
    add(new THREE.SphereGeometry(key==='AA'?.18:.3,10,8),material(color,.22)).scale.z=1.9;
  }
  const tail=add(new THREE.ConeGeometry(Math.min(.24,radius),ice?1.1:1.5,8),material(color,.23),0,0,-.7);tail.rotation.x=-Math.PI/2;
  root.userData.signature={id,key};return root;
}
export function burst(point,id,event='impact') {
  if(!focused(id))return;
  const root=new THREE.Group(),color=id==='Ashe'?0x9beaff:0xffdc85;
  const ring=new THREE.Mesh(new THREE.RingGeometry(.22,.30,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;root.add(ring);
  if(event==='impact')for(let i=0;i<6;i++){const shard=new THREE.Mesh(new THREE.OctahedronGeometry(.055),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8}));shard.position.set(Math.cos(i*Math.PI/3)*.3,.1,Math.sin(i*Math.PI/3)*.3);root.add(shard);}
  root.userData.transient=true;root.position.copy(point);state.scene.add(root);effects.push({mesh:root,life:event==='impact'?.30:.18,total:event==='impact'?.30:.18});
}
export function markVisual(enemy, now) {
  if(enemy.mark!=='Ezreal'||now<(enemy.nextMarkVisual||0))return;
  enemy.nextMarkVisual=now+.35;burst(enemy.group.position.clone().setY(.12),'Ezreal','release');
}
export function updatePresentation(dt, now) {
  const meter=document.querySelector('#attackMeter');
  if(meter){const windup=state.attackState==='windup',duration=windup?state.WINDUP_TIME:state.ATTACK_INTERVAL;const remaining=windup?state.windupEnd-now:state.nextAttackReady-now;meter.style.width=`${Math.round(100*THREE.MathUtils.clamp(1-remaining/duration,0,1))}%`;meter.style.background=windup?'#e8bb67':'#69d9ec';meter.setAttribute('aria-label',windup?'発射前':'発射後・移動可能');}
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;const progress=1-Math.max(0,e.life)/e.total;e.mesh.scale.setScalar(1+progress*2);e.mesh.traverse(o=>{if(o.material)o.material.opacity=(1-progress)*.8;});if(e.life<=0){state.scene.remove(e.mesh);dispose(e.mesh);effects.splice(i,1);}}
  for(const e of state.enemies)if(e.alive)markVisual(e,now);
}
export function animateRig(root, dt, now) {
  const rig=root.userData;if(!rig.body)return;
  const previous=rig.previousPosition||root.position.clone(),moving=previous.distanceToSquared(root.position)>.000001;
  rig.previousPosition=root.position.clone();
  const action=rig.action,windup=action?.phase==='windup'&&now<=action.end,released=action?.phase==='release'&&now<=action.end;
  const progress=windup?THREE.MathUtils.clamp((now-action.start)/(action.end-action.start),0,1):0;
  const recoil=released?1-THREE.MathUtils.clamp((now-action.start)/.26,0,1):0;
  if(action&&now>action.end)delete rig.action;
  rig.body.position.y=moving?Math.sin(now*12)*.045:Math.sin(now*2)*.012;
  rig.body.rotation.x=windup?-.05*progress:recoil*.10;
  rig.joints.forEach((joint,i)=>joint.rotation.x=moving?Math.sin(now*12+i*Math.PI)*.32:0);
  rig.weapon.rotation.x=windup?-.16*progress:recoil*.26;
  rig.weapon.position.z=.38-(windup?.12*progress:0)-recoil*.10;
  if(focused(rig.profile)&&rig.arms){rig.arms[0].rotation.x=windup?-.7-progress*.35:-.15-recoil*.5;rig.arms[1].rotation.x=windup?-.6-progress*.5:-.10-recoil*.5;rig.arms[1].rotation.z=rig.profile==='Ashe'&&windup?-.4*progress:0;}
  if(rig.focusGlow){rig.focusGlow.scale.setScalar(windup?1+progress*1.4:1+recoil);rig.focusGlow.material.opacity=windup?.25+progress*.5:recoil*.65;}
  rig.ring.material.opacity=windup?.55+progress*.4:released?1:.85;
}
