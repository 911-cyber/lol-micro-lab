import { state } from './state.js';
// Keep all wall-clock deadlines consistent when the local duel is paused.
export function shiftDeadlines(seconds){
 const shift=(object,keys)=>{if(!object)return;for(const key of keys)if(Number.isFinite(object[key])&&object[key]>0)object[key]+=seconds;};
 shift(state,['nextAttackReady','windupEnd','lastShotAt','reloadUntil','playerRootUntil','playerSlowUntil','shieldUntil','lastPlayerDamage','toastUntil']);
 const a=state.abilities;if(a){shift(a.cooldowns,Object.keys(a.cooldowns));shift(a.buffs,Object.keys(a.buffs));shift(a.cast,['started','until']);shift(a.dash,['started','until']);shift(a.charge,['started']);shift(a.channel,['next','until']);shift(a.pending,['expires']);for(const t of a.traps)shift(t,['arm','triggerAt']);}
 for(const e of [...state.enemies,...state.alliedMinions,state.duel?.blue])shift(e,['nextAttack','rootUntil','stunUntil','slowUntil','lastPlayerHit','microOpeningUntil']);
 if(state.duel)shift(state.duel,['playerMarkUntil']);
}
