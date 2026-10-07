import { state } from './state.js';
import { resetEntities } from './entities.js';
import { hideResult } from './ui.js';
import { buildArena } from './arena.js';
import { startCoach } from './coach.js';
import { disposeObject } from './champions.js';
import { resetAbilities } from './abilities.js';
import { resetMicro } from './micro.js';
import { clearPresentation } from './presentation.js';
import { startDuel, resetDuel } from './duel.js';
export function resetStats(){resetMicro();for(const key of ['hits','cancels','cleanKites','dodges','cs','missedCs','score','targetSwitches','skillshotsFired','skillshotsHit'])state[key]=0;state.playerHp=100;state.lastSelectedTarget=null;state.laneMetrics={fired:0,hit:0,dodged:0,damage:0};}
export function setMode(){
 state.pausedAt=undefined;state.navigation=null;state.cancelAim?.();resetDuel();state.mode='DUEL';state.lobbyMode='DUEL';resetEntities();clearPresentation();resetStats();resetAbilities();hideResult();
 state.order={type:'idle',point:state.player.position.clone(),target:null};state.attackState='idle';state.attackTarget=null;state.attackMoveArmed=false;state.rightMouseHeld=false;state.awaitingKiteMove=false;state.lastShotAt=-Infinity;state.nextAttackReady=performance.now()/1000;state.reloadUntil=0;state.championShots=0;
 state.projectiles.splice(0).forEach(p=>{state.scene.remove(p.mesh);disposeObject(p.mesh);});state.skillshots.splice(0).forEach(p=>state.scene.remove(p.mesh));
 buildArena('DUEL');startDuel();startCoach();
}
