import * as THREE from 'three';
import { state } from './state.js';
export function makeMinionHpBar(unit) {
  const root = new THREE.Group();
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({
    color: 0x0a0d12,
    transparent: true,
    opacity: .98,
    depthTest: false,
    depthWrite: false
  }));
  const fillColor = unit.team === 'ally' ? 0x4b9cff : 0xd93e4b;
  const fillMat = new THREE.SpriteMaterial({
    color: fillColor,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false
  });
  const fill = new THREE.Sprite(fillMat);
  bg.scale.set(1.64, .155, 1);
  fill.scale.set(1.49, .088, 1);
  bg.renderOrder = 30;
  fill.renderOrder = 31;
  root.add(bg, fill);
  state.scene.add(root);
  unit.hpBar = {
    root,
    bg,
    fill,
    fillMat
  };
  updateMinionHpBar(unit);
}
export function updateMinionHpBar(unit) {
  if (!unit.hpBar) return;
  const ratio = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
  const y = unit.type==='tower'?4.5:unit.type!=='minion' ? unit.group.userData.profile?3.65:2.45 : unit.minionClass === 'melee' || unit.maxHp === 320 ? 1.82 : 1.68;
  unit.hpBar.root.position.set(unit.group.position.x, y, unit.group.position.z);
  unit.hpBar.root.quaternion.copy(state.camera.quaternion);
  unit.hpBar.root.visible = unit.alive && unit.group.visible;
  unit.hpBar.fill.scale.x = 1.49 * ratio;
  unit.hpBar.fill.position.x = -.745 * (1 - ratio);
}
export function updateEnemyHpBars(){
  for(const enemy of [...state.enemies,...state.alliedMinions]){if(enemy.type!=='minion'&&!enemy.hpBar&&enemy.alive&&enemy.group.visible)makeMinionHpBar(enemy);updateMinionHpBar(enemy);}
}
export function laneUnitStats(unit) {
  return unit.minionClass === 'caster' ? {
    range: 4.25,
    move: 1.05,
    interval: 1.45,
    damage: 16
  } : {
    range: .92,
    move: 1.25,
    interval: 1.20,
    damage: 22
  };
}
export function damageLaneUnit(unit, amount, now, sourceTeam) {
  if (!unit?.alive) return;
  unit.hp = Math.max(0, unit.hp - amount);
  if (unit.hp > 0) return;
  unit.alive = false;
  unit.group.visible = false;
  if (unit.hpBar) unit.hpBar.root.visible = false;
  if (unit.team === 'enemy') {
    if (unit.lastHitIndicator) unit.lastHitIndicator.visible = false;
    if (sourceTeam === 'ally') {
      state.missedCs++;
      state.score = Math.max(0, state.score - 18);
    }
  }
}
