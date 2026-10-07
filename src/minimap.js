import * as THREE from 'three';
import { state } from './state.js';
import { issueMovePoint } from './player.js';
import { screenToGround, clampFocus } from './camera.js';
function mapPoint(x,y){const r=document.querySelector('#minimap').getBoundingClientRect(),b=state.arenaBounds,dx=(x-r.left)/r.width*160-80,dy=(y-r.top)/r.height*110-55,u=Math.max(-1,Math.min(1,(14*dx-20*dy)/1600)),v=Math.max(-1,Math.min(1,(38*dx+60*dy)/1600));return new THREE.Vector3((b.minX+b.maxX)/2+u*(b.maxX-b.minX)/2,0,(b.minZ+b.maxZ)/2+v*(b.maxZ-b.minZ)/2);}
export function bindMinimap(){
 const map=document.querySelector('#minimap');let dragging=false;
 map.addEventListener('contextmenu',e=>e.preventDefault());
 map.addEventListener('pointerdown',e=>{if(state.menuOpen||state.settingsOpen||state.duel?.phase!=='play')return;e.preventDefault();const p=mapPoint(e.clientX,e.clientY);state.cancelAim?.();if(e.button===2){issueMovePoint(p);state.renderer.domElement.focus?.();}else if(e.button===0){dragging=true;state.cameraLocked=false;state.cameraFocus.copy(p);clampFocus();map.setPointerCapture?.(e.pointerId);}});
 map.addEventListener('pointermove',e=>{if(dragging){state.cameraFocus.copy(mapPoint(e.clientX,e.clientY));clampFocus();}});
 window.addEventListener('pointerup',()=>dragging=false);window.addEventListener('blur',()=>dragging=false);
}
export function updateMinimap(){
 if(!state.arenaBounds)return;const map=document.querySelector('#minimap'),b=state.arenaBounds;
 const xy=p=>{const u=(p.x-(b.minX+b.maxX)/2)/(b.maxX-b.minX)*2,v=(p.z-(b.minZ+b.maxZ)/2)/(b.maxZ-b.minZ)*2;return {x:80+u*60+v*20,y:55-u*38+v*14};};
 const dots=[...state.alliedMinions.filter(e=>e.alive).map(e=>({p:e.group.position,c:'#438edb',r:1.5})),...state.enemies.filter(e=>e.alive&&e.group.visible).map(e=>({p:e.group.position,c:'#e45c66',r:e.type==='minion'?1.5:3})),...(state.duel?.blue?[{p:state.duel.blue.group.position,c:'#438edb',r:3}]:[]),{p:state.player.position,c:'#69e0e1',r:3}];
 let svg='<rect x="5" y="5" width="150" height="100" fill="#243f37" stroke="#6b805f"/><path d="M20 93L140 17" stroke="#807859" stroke-width="19"/>';
 for(const dot of dots){const p=xy(dot.p);svg+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${dot.r}" fill="${dot.c}"/>`;}
 const corners=[[0,0],[innerWidth,0],[innerWidth,innerHeight],[0,innerHeight]].map(([x,y])=>screenToGround(x,y)).filter(Boolean).map(p=>{const c=xy(p);return c.x.toFixed(1)+','+c.y.toFixed(1);});svg+='<polygon points="'+corners.join(' ')+'" fill="none" stroke="#eef1cd" stroke-width=".8"/>';map.innerHTML=svg;
}
