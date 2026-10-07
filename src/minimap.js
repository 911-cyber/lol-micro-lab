import { state } from './state.js';
export function updateMinimap(){
 if(!state.arenaBounds)return;const map=document.querySelector('#minimap'),b=state.arenaBounds;
 const xy=p=>({x:8+(p.x-b.minX)/(b.maxX-b.minX)*144,y:8+(p.z-b.minZ)/(b.maxZ-b.minZ)*94});
 const dots=[...state.alliedMinions.filter(e=>e.alive).map(e=>({p:e.group.position,c:'#438edb',r:1.5})),...state.enemies.filter(e=>e.alive&&e.group.visible).map(e=>({p:e.group.position,c:'#e45c66',r:e.type==='minion'?1.5:3})),{p:state.player.position,c:'#69e0e1',r:3}];
 let svg='<rect x="5" y="5" width="150" height="100" fill="#243f37" stroke="#6b805f" stroke-width="1"/>';
 if(['CS','LANE'].includes(state.mode))svg+='<rect x="7" y="45" width="146" height="20" fill="#666553"/>';
 for(const dot of dots){const p=xy(dot.p);svg+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${dot.r}" fill="${dot.c}"/>`;}
 const camera=xy(state.cameraFocus);svg+=`<rect x="${(camera.x-18).toFixed(1)}" y="${(camera.y-13).toFixed(1)}" width="36" height="26" fill="none" stroke="#c7ceb3" stroke-width=".8"/>`;map.innerHTML=svg;
}
