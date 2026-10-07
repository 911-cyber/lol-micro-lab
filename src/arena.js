import * as THREE from 'three';
import { state } from './state.js';
import { disposeObject } from './champions.js';

const ARENAS={DUEL:{name:'MID DUEL',width:80,depth:22,accent:0x76ab78}};

export function buildArena(mode) {
  if(!state.arenaGroup) {
    for(const object of [...state.scene.children]) {
      if([state.ground,state.lane,state.river,state.grid].includes(object)||object.geometry?.type==='DodecahedronGeometry') {state.scene.remove(object);disposeObject(object);}
    }
  } else {state.scene.remove(state.arenaGroup);disposeObject(state.arenaGroup);}
  const config=ARENAS[mode]||ARENAS.DUEL;
  state.arenaBounds={minX:-config.width/2+.8,maxX:config.width/2-.8,minZ:-config.depth/2+.8,maxZ:config.depth/2-.8};
  state.arenaName=config.name;
  const arena=new THREE.Group();state.arenaGroup=arena;state.scene.add(arena);
  const stone=new THREE.MeshStandardMaterial({color:0x303e43,roughness:.9});
  const floor=new THREE.MeshStandardMaterial({color:0x314837,roughness:1});
  const trim=new THREE.MeshBasicMaterial({color:config.accent,transparent:true,opacity:.65});
  function box(size,material,position){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...position);mesh.receiveShadow=true;mesh.castShadow=true;arena.add(mesh);return mesh;}
  box([config.width,.35,config.depth],floor,[0,-.2,0]);
  for(const side of [-1,1]) {
    box([config.width+1,.6,.6],stone,[0,.12,side*config.depth/2]);
    box([.6,.6,config.depth],stone,[side*config.width/2,.12,0]);
    box([config.width,.035,.055],trim,[0,.065,side*(config.depth/2-.7)]);
    box([.055,.035,config.depth],trim,[side*(config.width/2-.7),.065,0]);
    for(const x of [-config.width/2,config.width/2]) {
      box([1,1.3,1],stone,[x,.55,side*config.depth/2]);
      const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.3),trim);crystal.position.set(x,1.5,side*config.depth/2);arena.add(crystal);
    }
  }
  if(mode==='DUEL') {
    box([config.width-2,.05,8],new THREE.MeshStandardMaterial({color:0x555747,roughness:1}),[0,.02,0]);
    for(let x=-36;x<=36;x+=2)box([.035,.02,7.9],stone,[x,.06,0]);
    for(const z of [-6,6])for(let x=-12;x<=12;x+=4) {
      const shrub=new THREE.Mesh(new THREE.IcosahedronGeometry(.7),new THREE.MeshStandardMaterial({color:0x315d46,roughness:1}));shrub.position.set(x,.45,z);shrub.scale.y=.6;arena.add(shrub);
    }
  } else {
    const grid=new THREE.GridHelper(Math.min(config.width,config.depth)-2,12,config.accent,0x39515a);grid.position.y=.01;grid.material.transparent=true;grid.material.opacity=.13;arena.add(grid);
    const mark=new THREE.Mesh(new THREE.RingGeometry(4,4.04,96),trim);mark.rotation.x=-Math.PI/2;mark.position.set(2,.045,0);arena.add(mark);
  }
  state.cameraFocus.set(2,0,0);
}
