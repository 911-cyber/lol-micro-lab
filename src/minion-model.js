import * as THREE from 'three';
export function buildMinion(team,kind){
 const root=new THREE.Group(),blue=team==='ally',cloth=new THREE.MeshStandardMaterial({color:blue?0x2779ca:0xb82f38,roughness:.85}),dark=new THREE.MeshStandardMaterial({color:blue?0x153554:0x56202c}),metal=new THREE.MeshStandardMaterial({color:0xa4b4bd,metalness:.45,roughness:.55}),skin=new THREE.MeshStandardMaterial({color:0xd2b484}),gold=new THREE.MeshStandardMaterial({color:0xc9a854,metalness:.35,roughness:.6});
 function mesh(geometry,material,x,y,z){const part=new THREE.Mesh(geometry,material);part.position.set(x,y,z);part.castShadow=true;part.receiveShadow=true;root.add(part);return part;}
 const feet=[];for(const side of [-1,1])feet.push(mesh(new THREE.BoxGeometry(.18,.24,.31),dark,side*.17,.16,.02));
 if(kind==='melee'){
  mesh(new THREE.CylinderGeometry(.3,.33,.47,8),cloth,0,.52,0);
  mesh(new THREE.BoxGeometry(.52,.25,.29),metal,0,.72,.04);
  mesh(new THREE.SphereGeometry(.23,10,8),skin,0,.96,0);
  mesh(new THREE.SphereGeometry(.27,10,8,0,Math.PI*2,0,Math.PI*.58),metal,0,1.0,0);
  mesh(new THREE.BoxGeometry(.31,.07,.05),dark,0,1.02,.23);
  mesh(new THREE.BoxGeometry(.09,.16,.07),metal,0,.91,.24);
  const crest=mesh(new THREE.BoxGeometry(.1,.16,.34),cloth,0,1.23,-.015);crest.rotation.x=.15;
  for(const side of [-1,1])mesh(new THREE.SphereGeometry(.18,8,6),metal,side*.34,.75,0);
  const shield=mesh(new THREE.CylinderGeometry(.29,.29,.1,6),dark,-.39,.58,.18);shield.rotation.x=Math.PI/2;
  const face=mesh(new THREE.CylinderGeometry(.24,.24,.11,6),cloth,-.39,.58,.2);face.rotation.x=Math.PI/2;
  mesh(new THREE.BoxGeometry(.07,.41,.035),metal,-.39,.58,.26);
  mesh(new THREE.BoxGeometry(.35,.055,.035),metal,-.39,.62,.26);
  mesh(new THREE.BoxGeometry(.08,.55,.08),gold,.4,.51,.13);
  mesh(new THREE.BoxGeometry(.31,.18,.2),metal,.4,.85,.13);
 }else{
  mesh(new THREE.ConeGeometry(.38,.65,10),cloth,0,.48,0);
  mesh(new THREE.CylinderGeometry(.18,.3,.28,8),dark,0,.62,0);
  mesh(new THREE.SphereGeometry(.23,10,8),cloth,0,.9,-.02);
  mesh(new THREE.SphereGeometry(.18,10,8),skin,0,.91,.09);
  const hood=mesh(new THREE.ConeGeometry(.27,.37,8),cloth,0,1.1,-.08);hood.rotation.x=-.25;
  mesh(new THREE.BoxGeometry(.29,.09,.08),dark,0,.93,.245);
  for(const side of [-1,1])mesh(new THREE.SphereGeometry(.1,8,6),skin,side*.28,.67,.13);
  mesh(new THREE.CylinderGeometry(.035,.035,1.02,8),gold,.38,.59,.12);
  const crystal=mesh(new THREE.OctahedronGeometry(.14),new THREE.MeshBasicMaterial({color:blue?0x88dcff:0xff9c73}),.38,1.16,.12);crystal.rotation.z=.4;
  mesh(new THREE.TorusGeometry(.17,.025,6,14),gold,.38,1.16,.12);
 }
 root.userData.minionKind=kind;root.userData.feet=feet;return root;
}
export function animateMinions(units,now){
 for(const unit of units){if(!unit.alive)continue;const data=unit.group.userData,moved=data.previousPosition&&data.previousPosition.distanceToSquared(unit.group.position)>.000001;
  for(let i=0;i<(data.feet?.length||0);i++)data.feet[i].rotation.x=moved?Math.sin(now*9+(i?Math.PI:0))*.38:0;
  data.previousPosition=unit.group.position.clone();
 }
}
