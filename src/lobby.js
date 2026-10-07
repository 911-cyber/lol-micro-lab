import { state } from './state.js';
import { CHAMPIONS, championById } from './roster.js';
import { selectChampion } from './champions.js';
import { buildArena } from './arena.js';
import { setMode } from './drills.js';
import { modeLesson, startCoach, bindCoach } from './coach.js';
import { abilityKit, initializeAbilityHud, bindAbilityHud } from './abilities.js';
import { unlockSound, bindSoundControl } from './presentation.js';

import { initializeControls } from './controls.js';
import { bindDuel } from './duel.js';
export const DRILLS = [{id:'DUEL',name:'ミッド1v1',detail:'タワーを先に破壊して二本先取。ラウンド間に双方が装備を選択。',time:'二本先取'}];

function renderSelection() {
  const profile=championById(state.lobbyChampion),drill=DRILLS.find(d=>d.id===state.lobbyMode);
  document.querySelectorAll('[data-drill]').forEach(button=>{const selected=button.dataset.drill===state.lobbyMode;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
  document.querySelectorAll('[data-champion]').forEach(button=>{const selected=button.dataset.champion===profile.id;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
  document.querySelector('#championArt').src=`./assets/champions/${profile.id}.jpg`;
  document.querySelector('#championArt').alt=profile.name;
  document.querySelector('#championName').textContent=profile.name;
  document.querySelector('#championTitle').textContent=profile.title;
  document.querySelector('#championWeapon').textContent=profile.weapon;
  document.querySelector('#championRange').textContent=profile.range;
  document.querySelector('#championSpeed').textContent=profile.as.toFixed(3);
  document.querySelector('#championTip').textContent=profile.tip;
  const kit=abilityKit(profile.id);document.querySelector('#championSkills').innerHTML='QWER'.split('').map(key=>`<span title="${kit[key].name}：${kit[key].description}"><img src="./assets/abilities/${kit[key].icon}" alt="${kit[key].name}"/><kbd>${key}</kbd></span>`).join('');
  document.querySelector('#launchName').textContent=drill.name+'を開始';
  document.querySelector('#selectedLesson').textContent=modeLesson(drill.id);
  document.querySelectorAll('[data-difficulty]').forEach(button=>{const selected=Number(button.dataset.difficulty)===state.difficultyIndex;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
}

export function openLobby() {
  document.querySelector('#duelPanel').hidden=true;
  state.menuOpen=true;
  state.rightMouseHeld=false;state.middleDragging=false;state.spaceHeld=false;
  state.renderer.domElement.style.cursor='';
  state.coachRequest?.abort();
  document.querySelector('#lobby').hidden=false;
  document.querySelector('#hud').hidden=true;
  if(state.mode!=='FREE')state.lobbyMode=state.mode;
  renderSelection();
}

export function launchTraining() {
  state.menuOpen=false;document.querySelector('#lobby').hidden=true;document.querySelector('#hud').hidden=false;
  state.coachEnabled=document.querySelector('#coachToggle').checked;
  selectChampion(state.lobbyChampion);
  setMode(state.lobbyMode);
  initializeAbilityHud();state.cameraLocked=state.controls.locked;state.cameraFocus.copy(state.player.position);state.pointerInside=false;
  document.querySelector('#playChampion').textContent=state.selectedChampion.name;
  document.querySelector('#playPortrait').src=`./assets/champions/${state.selectedChampion.id}.png`;
  document.querySelector('#playAttackSpeed').textContent=state.ATTACK_SPEED.toFixed(3);
  document.querySelector('#playRange').textContent=Math.round(state.ATTACK_RANGE*100);
  startCoach();
  state.renderer.domElement.setAttribute?.('tabindex','0');
  state.renderer.domElement.focus?.({preventScroll:true});
}

export function initializeLobby() {
  state.lobbyMode='DUEL';state.lobbyChampion='Ashe';state.menuOpen=true;state.coachEnabled=true;state.aiConnected=false;
  document.querySelector('#modeGrid').textContent='MID LANE · 1v1 · FIRST TO TWO';
  document.querySelector('#championGrid').innerHTML=CHAMPIONS.map(c=>`<button type="button" class="champion-tile" data-champion="${c.id}" aria-label="${c.name}を選択" aria-pressed="false"><img src="./assets/champions/${c.id}.png" alt=""/><span>${c.name}</span></button>`).join('');
  document.querySelector('#modeGrid').addEventListener('click',event=>{const button=event.target.closest('[data-drill]');if(button){state.lobbyMode=button.dataset.drill;renderSelection();}});
  document.querySelector('#championGrid').addEventListener('click',event=>{const button=event.target.closest('[data-champion]');if(button){state.lobbyChampion=button.dataset.champion;renderSelection();}});
  document.querySelectorAll('[data-difficulty]').forEach(button=>button.addEventListener('click',()=>{
    state.difficultyIndex=Number(button.dataset.difficulty);document.querySelectorAll('[data-difficulty]').forEach(b=>{const selected=b===button;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  }));
  document.querySelector('#launchTraining').addEventListener('click',()=>{unlockSound();launchTraining();});
  document.querySelector('#returnLobby').addEventListener('click',openLobby);
  document.querySelector('#resultMenu').addEventListener('click',openLobby);
  document.querySelector('#resultRetry').addEventListener('click',launchTraining);
  initializeControls();bindDuel(launchTraining,openLobby);buildArena('DUEL');bindCoach();bindAbilityHud();bindSoundControl();openLobby();
}
