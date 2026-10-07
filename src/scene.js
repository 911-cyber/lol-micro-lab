import * as THREE from 'three';
import { state } from './state.js';
export function addRock(x, z, s = 1) {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1 * s, 0), new THREE.MeshStandardMaterial({
    color: 0x465448,
    roughness: 1
  }));
  rock.position.set(x, .65 * s, z);
  rock.scale.y = .65;
  rock.rotation.set(.2, x * .07, .1);
  rock.castShadow = true;
  rock.receiveShadow = true;
  state.scene.add(rock);
}
export function makeChampion(color = 0x4c91ff, shoulderColor = 0x223b70) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.58, .9, 7, 12), new THREE.MeshStandardMaterial({
    color,
    roughness: .5
  }));
  body.position.y = .78;
  body.castShadow = true;
  group.add(body);
  const shoulder = new THREE.Mesh(new THREE.ConeGeometry(.8, .45, 8), new THREE.MeshStandardMaterial({
    color: shoulderColor,
    roughness: .55
  }));
  shoulder.position.y = 1.28;
  shoulder.rotation.x = Math.PI;
  group.add(shoulder);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.72, .82, 48), new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: .8,
    side: THREE.DoubleSide
  }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .045;
  group.add(ring);
  return group;
}
