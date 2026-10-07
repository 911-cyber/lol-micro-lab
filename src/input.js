import * as THREE from 'three';
import { state } from './state.js';
import { screenToGround, cameraBasisOnGround, clampFocus } from './camera.js';
import { issueMoveFromScreen, issueStop } from './player.js';
import { issueAttackMove, issueAttack } from './combat.js';
import { pickEnemy } from './entities.js';
import { openLobby, launchTraining } from './lobby.js';
import { toggleSettings } from './controls.js';
import { requestSkill, releaseSkill, cancelAim, confirmAim } from './aim.js';
import { bindMinimap } from './minimap.js';
const active=()=>!state.menuOpen&&!state.settingsOpen&&state.duel?.phase==='play';
export function bindInput(){
 const canvas=state.renderer.domElement;state.requestSkill=requestSkill;state.cancelAim=cancelAim;state.cameraKeys={};
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('pointerdown',e=>{
  if(!active())return;state.pointerPx.set(e.clientX,e.clientY);canvas.focus?.({preventScroll:true});
  if(e.button===2){e.preventDefault();if(state.aim||state.attackMoveArmed){cancelAim();return;}
   state.lastMoveIssueMs=performance.now();const enemy=pickEnemy(e.clientX,e.clientY);
   if(e.shiftKey){const p=screenToGround(e.clientX,e.clientY);if(p)issueAttackMove(p);state.rightMouseHeld=false;}
   else if(enemy&&(!state.targetChampionsOnly||enemy.type==='duelist')){issueAttack(enemy);state.rightMouseHeld=false;}
   else{state.rightMouseHeld=true;issueMoveFromScreen(e.clientX,e.clientY,true);}
  }
  if(e.button===0){if(state.aim){e.preventDefault();confirmAim();}else if(state.attackMoveArmed){e.preventDefault();cancelAim();const p=screenToGround(e.clientX,e.clientY);if(p)issueAttackMove(p);}else{const enemy=pickEnemy(e.clientX,e.clientY);if(enemy)state.activeTarget=enemy;}}
  if(e.button===1){e.preventDefault();state.middleDragging=true;state.cameraLocked=false;state.lastMiddle.set(e.clientX,e.clientY);canvas.style.cursor='grabbing';}
 });
 canvas.addEventListener('pointermove',e=>{
  if(!active())return;state.pointerPx.set(e.clientX,e.clientY);state.pointerInside=true;
  if(state.rightMouseHeld&&performance.now()-state.lastMoveIssueMs>=state.HOLD_MOVE_INTERVAL_MS){state.lastMoveIssueMs=performance.now();issueMoveFromScreen(e.clientX,e.clientY,false);}
  if(state.middleDragging){const dx=e.clientX-state.lastMiddle.x,dy=e.clientY-state.lastMiddle.y;state.lastMiddle.set(e.clientX,e.clientY);const {forward,right}=cameraBasisOnGround(),w=state.CAMERA_DISTANCE*state.cameraSettings.zoom/1100;state.cameraFocus.addScaledVector(right,-dx*w).addScaledVector(forward,dy*w);clampFocus();}
 });
 canvas.addEventListener('pointerenter',()=>state.pointerInside=true);canvas.addEventListener('pointerleave',()=>state.pointerInside=false);
 canvas.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
 window.addEventListener('pointerup',e=>{if(e.button===2)state.rightMouseHeld=false;if(e.button===1){state.middleDragging=false;canvas.style.cursor='';}});
 window.addEventListener('blur',()=>{state.rightMouseHeld=false;state.middleDragging=false;state.spaceHeld=false;state.showAttackRange=false;state.targetChampionsOnly=false;state.cameraKeys={};cancelAim();canvas.style.cursor='';});
 canvas.addEventListener('wheel',e=>{if(!active())return;e.preventDefault();state.cameraSettings.zoom=THREE.MathUtils.clamp(state.cameraSettings.zoom*(e.deltaY>0?1.08:.92),state.cameraSettings.minZoom,state.cameraSettings.maxZoom);},{passive:false});
 window.addEventListener('keydown',e=>{
  if(e.code==='Escape'){e.preventDefault();if(state.aim||state.attackMoveArmed)cancelAim();else toggleSettings();return;}
  if(['INPUT','TEXTAREA','BUTTON','SELECT'].includes(e.target?.tagName))return;
  if(!active())return;
  if(e.code==='KeyM'&&!e.repeat){cancelAim();openLobby();return;}
  if(['KeyQ','KeyW','KeyE','KeyR','KeyD','KeyF'].includes(e.code)&&!e.repeat){e.preventDefault();requestSkill(e.code.slice(3),e.shiftKey);return;}
  if(e.code==='Space'){e.preventDefault();state.spaceHeld=true;state.cameraFocus.copy(state.player.position);}
  if(e.code.startsWith('Arrow')){e.preventDefault();state.cameraKeys[e.code]=true;}
  if(e.code==='Backquote')state.targetChampionsOnly=true;
  if(e.code==='KeyC'){state.showAttackRange=true;state.rangeRing.visible=true;}
  if(e.repeat)return;
  if(e.code==='KeyY'){state.cameraLocked=!state.cameraLocked;if(state.cameraLocked)state.cameraFocus.copy(state.player.position);}
  if(e.code==='KeyS'||e.code==='KeyH'){e.preventDefault();cancelAim();issueStop();}
  if(e.code==='KeyA'){e.preventDefault();cancelAim();state.attackMoveArmed=true;state.rangeRing.visible=true;}
  if(e.code==='KeyX'){e.preventDefault();cancelAim();const p=screenToGround(state.pointerPx.x,state.pointerPx.y);if(p)issueAttackMove(p);}
  if(e.code==='KeyT'){cancelAim();launchTraining();}
 });
 window.addEventListener('keyup',e=>{if(e.code==='Space')state.spaceHeld=false;if(e.code.startsWith('Arrow'))state.cameraKeys[e.code]=false;if(e.code==='Backquote')state.targetChampionsOnly=false;if(e.code==='KeyC'){state.showAttackRange=false;state.rangeRing.visible=state.attackMoveArmed;}if(['KeyQ','KeyW','KeyE','KeyR'].includes(e.code))releaseSkill(e.code.slice(3));});
 bindMinimap();
}
