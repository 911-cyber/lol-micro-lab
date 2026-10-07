import { state } from './state.js';

// Training feedback, not a claim about the live game's frames or cooldowns.
export function resetMicro() {
  state.micro = { attacks:0, edgeAttacks:0, punishHits:0, evades:0, returns:0,
    returnSeconds:0, recoveryTime:0, movingRecovery:0, windows:new Map(), previous:null };
}
export function noteMicroAttack(enemy) {
  const m=state.micro;if(!m||enemy.type==='minion')return;
  const distance=Math.max(0,state.player.position.distanceTo(enemy.group.position)-state.PLAYER_RADIUS-enemy.radius);
  m.attacks++;if(distance>=state.ATTACK_RANGE*.8&&distance<=state.ATTACK_RANGE+.001)m.edgeAttacks++;
}
export function noteEvade(enemy, now) {
  const m=state.micro;if(!m||!enemy.alive)return;
  m.evades++;m.windows.set(enemy,{started:now,until:now+2});
}
export function noteMicroHit(enemy, now, launchedAt=-Infinity) {
  const m=state.micro;if(!m||enemy.type==='minion')return;
  if(enemy.microOpeningUntil>now)m.punishHits++;
  const window=m.windows.get(enemy);
  if(window&&now<=window.until&&launchedAt>=window.started){m.returns++;m.returnSeconds+=now-window.started;m.windows.delete(enemy);}
}
export function updateMicro(dt, now) {
  const m=state.micro;if(!m)return;
  for(const [enemy,w] of m.windows)if(now>w.until||!enemy.alive)m.windows.delete(enemy);
  const a=state.abilities,busy=a?.cast||a?.dash||a?.charge||a?.channel||a?.buffs.kaisaCharge>now;
  if(!busy&&state.attackState!=='windup'&&now>state.lastShotAt&&now<state.nextAttackReady){
    m.recoveryTime+=dt;
    if(m.previous&&m.previous.distanceToSquared(state.player.position)>.000001)m.movingRecovery+=dt;
  }
  m.previous=state.player.position.clone();
}
export function microSummary() {
  const m=state.micro;if(!m)return '';
  const parts=[];
  if(m.attacks)parts.push(`射程の外側でAA ${m.edgeAttacks}/${m.attacks}回`);
  if(m.recoveryTime>.2)parts.push(`AA待ち時間の移動 ${Math.round(m.movingRecovery/m.recoveryTime*100)}%`);
  if(m.punishHits)parts.push(`敵の詠唱・発射直後への命中 ${m.punishHits}回`);
  if(m.evades)parts.push(`回避後2秒以内のAA反撃 ${m.returns}/${m.evades}回`);
  if(m.returns)parts.push(`反撃まで平均 ${(m.returnSeconds/m.returns).toFixed(2)}秒`);
  return parts.join('。');
}
