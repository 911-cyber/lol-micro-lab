import { state } from './state.js';
import { CHAMPIONS, championById } from './roster.js';
import { selectChampion } from './champions.js';
import { buildArena } from './arena.js';
import { setMode } from './drills.js';
import { modeLesson, startCoach, bindCoach } from './coach.js';
import { abilityKit, initializeAbilityHud, bindAbilityHud } from './abilities.js';
import { unlockSound, bindSoundControl } from './presentation.js';

import { bindDuel } from './duel.js';
export const DRILLS = [
  {id:'DUEL',key:'8',name:'ミッド1v1',tag:'FIRST TO TWO',icon:'⚔',detail:'エズリアルBOTと対戦。タワー破壊で二本先取、ラウンド間に装備を選択。',time:'二本先取'},
  {id:'KITE',key:'1',name:'カイティング',tag:'ATTACK + MOVE',icon:'↗',detail:'攻撃したら移動。追いつかれずにダメージを出す。',time:'30秒'},
  {id:'TARGET',key:'2',name:'ターゲット切替',tag:'TARGET SELECTION',icon:'⌖',detail:'複数の敵へ素早く正確に攻撃を切り替える。',time:'30秒'},
  {id:'SPACING',key:'3',name:'距離管理',tag:'SPACING',icon:'◎',detail:'自分の射程内、敵の危険範囲外を保つ。',time:'30秒'},
  {id:'DODGE',key:'4',name:'スキルショット回避',tag:'DODGE',icon:'◇',detail:'対面チャンピオンのスキルを横移動で避ける。',time:'30秒'},
  {id:'CS',key:'5',name:'ラストヒット',tag:'LANE CS',icon:'✦',detail:'6対6のミニオン戦闘で最後の一撃を取る。',time:'45秒'},
  {id:'COMBINED',key:'6',name:'攻撃と回避',tag:'KITE + DODGE',icon:'⚔',detail:'攻撃のリズムを保ちながら弾を避ける。',time:'40秒'},
  {id:'LANE',key:'7',name:'レーンフェーズ',tag:'CS + HARASS',icon:'≋',detail:'CSと敵チャンピオンのハラス回避を両立する。',time:'45秒'},
  {id:'FREE',key:'—',name:'自由練習',tag:'SANDBOX',icon:'∞',detail:'キャラの通常攻撃と操作を時間制限なしで試す。',time:'制限なし'}
];

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
  initializeAbilityHud();state.cameraLocked=true;state.cameraFocus.copy(state.player.position);state.pointerInside=false;
  document.querySelector('#playChampion').textContent=state.selectedChampion.name;
  document.querySelector('#playPortrait').src=`./assets/champions/${state.selectedChampion.id}.png`;
  document.querySelector('#playAttackSpeed').textContent=state.ATTACK_SPEED.toFixed(3);
  document.querySelector('#playRange').textContent=Math.round(state.ATTACK_RANGE*100);
  startCoach();
  state.renderer.domElement.setAttribute?.('tabindex','0');
  state.renderer.domElement.focus?.({preventScroll:true});
}

export function initializeLobby() {
  state.lobbyMode='KITE';state.lobbyChampion='Ashe';state.menuOpen=true;state.coachEnabled=true;state.aiConnected=false;
  document.querySelector('#modeGrid').innerHTML=DRILLS.map(d=>`<button class="drill-card" data-drill="${d.id}" type="button" aria-pressed="false"><span class="drill-top"><b>${d.icon}</b><small>${d.time}</small></span><span class="drill-tag">${d.tag}</span><strong>${d.name}</strong><span class="drill-detail">${d.detail}</span></button>`).join('');
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
  bindDuel(launchTraining,openLobby);buildArena('FREE');bindCoach();bindAbilityHud();bindSoundControl();openLobby();
}
