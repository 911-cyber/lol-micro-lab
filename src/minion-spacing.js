import * as THREE from 'three';
import { state } from './state.js';
// Resolve small-body overlap independently of target choice, including opposing waves.
export function separateMinions(units){
 const gap=1.3;
 for(let pass=0;pass<20;pass++){
  let penetration=0;
  for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){
   const a=units[i].group.position,b=units[j].group.position;let dx=b.x-a.x,dz=b.z-a.z;const squared=dx*dx+dz*dz;if(squared>=gap*gap)continue;
   const distance=Math.sqrt(squared);penetration=Math.max(penetration,gap-distance);
   if(distance<.0001){const angle=(i+j*7)*2.399963;dx=Math.cos(angle);dz=Math.sin(angle);}else{dx/=distance;dz/=distance;}
   const correction=(gap-distance)/2;a.x-=dx*correction;a.z-=dz*correction;b.x+=dx*correction;b.z+=dz*correction;
  }
  if(penetration<.015)break;
 }
 const bounds=state.arenaBounds;
 for(const unit of units){const p=unit.group.position;p.x=THREE.MathUtils.clamp(p.x,bounds.minX,bounds.maxX);p.z=THREE.MathUtils.clamp(p.z,bounds.minZ,bounds.maxZ);}
}
export function minionRoute(unit,goal){
 const p=unit.group.position;let path=unit.towerRoute;
 if(path?.length&&p.distanceTo(goal)<p.distanceTo(path[0])){unit.towerRoute=null;path=null;}
 if(path){while(path.length&&p.distanceTo(path[0])<.2)path.shift();if(path.length)return path[0];unit.towerRoute=null;}
 const dir=goal.clone().sub(p).setY(0),length=dir.length();if(!length)return goal;dir.normalize();
 for(const tower of [state.duel.blue,state.duel.red]){
  if(!tower.alive)continue;const center=tower.group.position,projection=center.clone().sub(p).dot(dir);if(projection<=0||projection>=length)continue;
  if(p.clone().addScaledVector(dir,projection).distanceTo(center)>1.8)continue;
  const side=(unit.laneSlot||1)<0?-1:1,direction=goal.x>p.x?1:-1;
  unit.towerRoute=[new THREE.Vector3(center.x-direction*2.1,0,side*2.2),new THREE.Vector3(center.x+direction*2.1,0,side*2.2)];return unit.towerRoute[0];
 }
 return goal;
}
