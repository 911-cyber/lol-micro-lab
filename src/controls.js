import { state } from './state.js';
const defaults={cast:'quick',attackMoveCursor:true,locked:false,edgeScroll:true,panSpeed:18};
export function initializeControls(){
 let saved={};try{saved=JSON.parse(localStorage.getItem('midDuelControls')||'{}');}catch{}
 state.controls={...defaults,...saved};if(!['quick','indicator','normal'].includes(state.controls.cast))state.controls.cast='quick';
 state.controls.panSpeed=Math.max(6,Math.min(30,Number(state.controls.panSpeed)||18));
 const panel=document.querySelector('#settingsPanel');panel.hidden=true;state.settingsOpen=false;
 document.querySelector('#settingsButton').addEventListener('click',()=>toggleSettings());
 document.querySelector('#lobbySettings').addEventListener('click',()=>toggleSettings());
 document.querySelector('#settingsClose').addEventListener('click',()=>toggleSettings(false));
 for(const id of ['castMode','attackMoveCursor','defaultCameraLock','edgeScroll','panSpeed'])document.querySelector('#'+id).addEventListener('change',saveControls);
 applyControls();
}
export function applyControls(){
 const c=state.controls;state.cameraSettings.edgeScroll=c.edgeScroll;state.CAMERA_PAN_SPEED=c.panSpeed;
 document.querySelector('#castMode').value=c.cast;document.querySelector('#attackMoveCursor').checked=c.attackMoveCursor;
 document.querySelector('#defaultCameraLock').checked=c.locked;document.querySelector('#edgeScroll').checked=c.edgeScroll;document.querySelector('#panSpeed').value=c.panSpeed;
}
function saveControls(){
 state.controls={cast:document.querySelector('#castMode').value,attackMoveCursor:document.querySelector('#attackMoveCursor').checked,locked:document.querySelector('#defaultCameraLock').checked,edgeScroll:document.querySelector('#edgeScroll').checked,panSpeed:Number(document.querySelector('#panSpeed').value)};
 try{localStorage.setItem('midDuelControls',JSON.stringify(state.controls));}catch{}
 applyControls();state.cameraLocked=state.controls.locked;
}
export function toggleSettings(open=!state.settingsOpen){
 state.settingsOpen=open;document.querySelector('#settingsPanel').hidden=!open;state.rightMouseHeld=false;state.spaceHeld=false;state.cameraKeys={};state.targetChampionsOnly=false;
 state.cancelAim?.();if(!open)state.renderer.domElement.focus?.({preventScroll:true});
}
