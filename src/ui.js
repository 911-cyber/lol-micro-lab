import * as THREE from 'three';
import { state } from './state.js';
import { resultObservation } from './coach.js';
import { updateMinimap } from './minimap.js';
export function showMarker(point, color = 0x55e36f) {
  state.markerMaterial.color.setHex(color);
  state.orderMarker.position.set(point.x, .065, point.z);
  state.orderMarker.scale.setScalar(.82);
  state.markerMaterial.opacity = .92;
  state.orderMarker.visible = true;
  state.markerLife = .34;
}
export function flashTarget(e) {
  if (!e) return;
  if (state.mode === state.MODE.TARGET && state.lastSelectedTarget && state.lastSelectedTarget !== e) state.targetSwitches++;
  if (state.mode === state.MODE.TARGET) state.lastSelectedTarget = e;
  state.activeTarget = e;
  state.targetFlash = .24;
  state.targetRing.position.set(e.group.position.x, .055, e.group.position.z);
  state.targetRing.material.opacity = .95;
  state.targetRing.visible = true;
}
export function toast(text, kind = '') {
  state.toastEl.textContent = text;
  state.toastEl.className = `show ${kind}`.trim();
  state.toastUntil = performance.now() / 1000 + 1.0;
}
export function hideResult() {
  state.resultPanel.classList.remove('show');
}
export function clamp100(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}
export function gradeFor(v) {
  return v >= 92 ? 'S' : v >= 80 ? 'A' : v >= 68 ? 'B' : v >= 55 ? 'C' : 'D';
}
export function resultHistory() {
  try {
    return JSON.parse(localStorage.getItem('lolMicroLabResults') || '[]');
  } catch {
    return [];
  }
}
export function recordResult(modeName, performance) {
  const rows = resultHistory();
  rows.push({
    mode: modeName,
    performance,
    time: Date.now(),
    difficulty: state.difficulty().name
  });
  try {
    localStorage.setItem('lolMicroLabResults', JSON.stringify(rows.slice(-40)));
  } catch {}
}
export function weakestHistoryText() {
  const rows = resultHistory();
  const buckets = {};
  for (const r of rows) {
    (buckets[r.mode] ??= []).push(r.performance);
  }
  const entries = Object.entries(buckets).filter(([, v]) => v.length);
  if (entries.length < 2) return '';
  entries.sort((a, b) => a[1].reduce((x, y) => x + y, 0) / a[1].length - b[1].reduce((x, y) => x + y, 0) / b[1].length);
  const [name, vals] = entries[0];
  const avg = Math.round(vals.reduce((x, y) => x + y, 0) / vals.length);
  return ` 過去の平均では ${name} (${avg}) が今の弱点。`;
}
export function statCard(label, value) {
  return `<div class="result-stat"><span>${label}</span><b>${value}</b></div>`;
}
export function showResult(finished) {
  let performance = 0,
    diagnosis = '',
    stats = [];
  const hpRate = state.playerHp / state.playerMaxHp;
  if (finished === state.MODE.KITE) {
    const clean = state.cleanKites / Math.max(1, state.hits),
      cancel = state.cancels / Math.max(1, state.hits + state.cancels);
    performance = clamp100(Math.min(1, state.hits / 12) * 35 + clean * 30 + hpRate * 25 + (1 - cancel) * 10);
    stats = [['HITS', state.hits], ['CLEAN', state.cleanKites], ['HP', `${Math.round(state.playerHp)}%`]];
    diagnosis = cancel > .22 ? 'AAキャンセルが多め。弾が出る瞬間を確認してから移動しよう。' : clean < .55 ? 'AA後に止まる時間が長い。発射直後の右クリックをもっと早く。' : hpRate < .65 ? '火力は出ているけど近づかれすぎ。AA射程の外側を使おう。' : 'AA→移動のリズムはかなり安定。次は敵を見ながら同じ精度を維持。';
  }
  if (finished === state.MODE.TARGET) {
    const cancel = state.cancels / Math.max(1, state.hits + state.cancels);
    performance = clamp100(Math.min(1, state.targetSwitches / 8) * 45 + Math.min(1, state.hits / 14) * 35 + (1 - cancel) * 20);
    stats = [['SWITCHES', state.targetSwitches], ['HITS', state.hits], ['CANCELS', state.cancels]];
    diagnosis = state.targetSwitches < 5 ? '同じ敵を殴り続けがち。A→クリックで次の標的へ視線とカーソルを先に移そう。' : cancel > .2 ? '切り替えはできている。次はAAの発射前キャンセルを減らそう。' : 'ターゲット変更は良好。次は移動を混ぜながら同じ速さを維持。';
  }
  if (finished === state.MODE.SPACING) {
    const good = state.modeData.spacingGoodTime / Math.max(1, state.sessionDuration),
      danger = state.modeData.spacingDangerTime / Math.max(1, state.sessionDuration);
    performance = clamp100(good * 105 - danger * 65 + hpRate * 20);
    stats = [['GOOD', `${state.modeData.spacingGoodTime.toFixed(1)}s`], ['DANGER', `${state.modeData.spacingDangerTime.toFixed(1)}s`], ['HP', `${Math.round(state.playerHp)}%`]];
    diagnosis = danger > .22 ? '敵の危険範囲に入りすぎ。攻撃より先に「相手の届く距離」を意識しよう。' : good < .45 ? '安全すぎて自分の射程も活かせていない。黄色リングの内側ギリギリへ。' : '距離管理は安定。次はAAを混ぜてもこの間合いを崩さない練習へ。';
  }
  if (finished === state.MODE.DODGE) {
    const total = state.dodges + state.skillshotsHit,
      rate = state.dodges / Math.max(1, total);
    performance = clamp100(rate * 85 + hpRate * 15);
    stats = [['DODGED', state.dodges], ['HIT', state.skillshotsHit], ['RATE', `${Math.round(rate * 100)}%`]];
    diagnosis = rate < .7 ? '被弾が多め。弾を見てから大きく逃げるより、細かい横移動を増やそう。' : rate < .88 ? '回避は良い。次は移動先を毎回変えて予測されにくくしよう。' : 'かなり安定して避けられている。複合練習に進めるレベル。';
  }
  if (finished === state.MODE.COMBINED) {
    const total = state.dodges + state.skillshotsHit,
      dodgeRate = state.dodges / Math.max(1, total),
      clean = state.cleanKites / Math.max(1, state.hits),
      cancel = state.cancels / Math.max(1, state.hits + state.cancels);
    performance = clamp100(dodgeRate * 35 + clean * 30 + hpRate * 25 + (1 - cancel) * 10);
    stats = [['CLEAN', state.cleanKites], ['DODGE', `${Math.round(dodgeRate * 100)}%`], ['HP', `${Math.round(state.playerHp)}%`]];
    diagnosis = dodgeRate < .72 ? 'AAに集中するとスキルショットを見失っている。攻撃後に敵ではなく画面全体を見る時間を作ろう。' : clean < .5 ? '回避はできているけどAA→移動のリズムが崩れ気味。発射直後だけ移動する意識を戻そう。' : hpRate < .55 ? '操作はできているが敵との距離が近い。カイト方向を後ろだけでなく斜めにも散らそう。' : '攻撃と回避の同時処理が安定。実戦に近い複合ミクロができている。';
  }
  if (finished === state.MODE.CS) {
    const total = state.cs + state.missedCs,
      rate = state.cs / Math.max(1, total);
    performance = clamp100(rate * 90 + Math.min(1, state.cs / 12) * 10);
    stats = [['CS', state.cs], ['MISS', state.missedCs], ['RATE', `${Math.round(rate * 100)}%`]];
    diagnosis = rate < .6 ? 'HPバーを見て「自分の1発で倒せる瞬間」まで待とう。早撃ちを減らすのが最優先。' : rate < .82 ? 'タイミングは掴めてきた。複数ミニオンのHPを同時に見る癖をつけよう。' : 'ラストヒット精度は良好。次は移動やハラスを混ぜたCSへ。';
  }
  if (finished === state.MODE.LANE) {
    const total = state.cs + state.missedCs;
    const csRate = state.cs / Math.max(1, total);
    const resolved = state.laneMetrics.hit + state.laneMetrics.dodged;
    const dodgeRate = state.laneMetrics.dodged / Math.max(1, resolved);
    performance = clamp100((csRate * 65 + hpRate * 20 + dodgeRate * 15) * Math.min(1, total / 6));
    stats = [['CS', state.cs], ['MISS', state.missedCs], ['CS RATE', `${Math.round(csRate * 100)}%`], ['HARASS HIT', state.laneMetrics.hit], ['DODGED', state.laneMetrics.dodged], ['HP', `${Math.round(state.playerHp)}%`]];
    diagnosis = hpRate < .4 ? '残りHPが少ない。予告線が出たら横移動を優先し、CSへ戻ろう。' : csRate < .6 ? '回避しながら赤HPバーを確認。倒せる瞬間にAAを1発だけ入れよう。' : 'CSと回避を両立できている。難易度を上げて同じ精度を維持しよう。';
  }
  recordResult(finished, performance);
  const observed=document.querySelector('#resultObservation');observed.hidden=!state.coachEnabled;observed.textContent=resultObservation(finished);
  if(state.coachEnabled&&state.selectedChampion)diagnosis+=' 次の練習：'+state.selectedChampion.tip;
  state.resultGradeEl.textContent = gradeFor(performance);
  state.resultTitleEl.textContent = finished;
  state.resultScoreEl.textContent = `PERFORMANCE ${performance}/100 • SCORE ${Math.round(state.score)} • ${state.difficulty().name}`;
  state.resultStatsEl.innerHTML = stats.map(([a, b]) => statCard(a, b)).join('');
  if(state.abilities)state.resultStatsEl.innerHTML+=statCard('SKILL HIT',state.abilities.hits)+statCard('FLASH',state.abilities.flash)+statCard('HEAL',state.abilities.heal);
  state.resultDiagnosisEl.textContent = diagnosis + weakestHistoryText();
  state.resultPanel.classList.add('show');
  if(state.coachEnabled)document.querySelector('#coachMessage').textContent=diagnosis;
}
export function updateVisuals(dt) {
  state.rangeRing.position.set(state.player.position.x, .05, state.player.position.z);
  state.markerLife -= dt;
  if (state.orderMarker.visible) {
    if (state.markerLife <= 0) state.orderMarker.visible = false;else {
      const t = 1 - state.markerLife / .34;
      state.markerMaterial.opacity = .92 * (1 - t);
      state.orderMarker.scale.setScalar(.82 + t * .55);
    }
  }
  state.targetFlash -= dt;
  if (state.targetRing.visible) {
    if (state.activeTarget?.alive) state.targetRing.position.set(state.activeTarget.group.position.x, .055, state.activeTarget.group.position.z);
    if (state.targetFlash <= 0) state.targetRing.material.opacity = Math.max(.2, state.targetRing.material.opacity - dt * 2.5);
  }
}
export function updateHud(now) {
  updateMinimap();
  if(state.selectedChampion){document.querySelector('#playAttackSpeed').textContent=state.ATTACK_SPEED.toFixed(2);document.querySelector('#playRange').textContent=Math.round(state.ATTACK_RANGE*100);document.querySelector('#hudAD').textContent=Math.round(state.ATTACK_DAMAGE);document.querySelector('#hudAS').textContent=state.ATTACK_SPEED.toFixed(2);document.querySelector('#hudMS').textContent=Math.round(state.MOVE_SPEED*100);document.querySelector('#cameraFollow').textContent=state.cameraLocked?'Y 追従ON':'Y 追従OFF';document.querySelector('#trainingPreset').textContent=['KITE','COMBINED'].includes(state.mode)?'練習CD · AAテンポ +65%':'練習CD · 基礎AA';}
  state.modeStateEl.textContent = state.mode;
  state.difficultyStateEl.textContent = state.difficulty().name;
  const attackCycle=document.querySelector('#attackCycle');
  if(attackCycle&&state.selectedChampion)attackCycle.textContent=state.reloadUntil>now?`リロード ${(state.reloadUntil-now).toFixed(1)}s`:state.selectedChampion.id==='Jhin'?`ウィスパー ${4-(state.championShots||0)%4} / 4発`:`${state.selectedChampion.weapon} · AD ${state.ATTACK_DAMAGE}`;
  state.orderStateEl.textContent = state.attackState === 'windup' ? 'WINDUP' : state.order.type.toUpperCase();
  state.orderStateEl.className = state.attackState === 'windup' ? 'attacking' : state.order.type === 'move' ? 'moving' : '';
  state.hitsStateEl.textContent = state.hits;
  state.cancelStateEl.textContent = state.cancels;
  state.kiteStateEl.textContent = state.cleanKites;
  state.dodgeStateEl.textContent = state.dodges;
  state.csStateEl.textContent = state.cs;
  state.scoreStateEl.textContent = Math.round(state.score);
  state.playerHpFill.style.width = `${state.playerHp}%`;
  state.playerHpText.textContent = `${Math.round(state.playerHp)} / ${state.playerMaxHp}`;
  if (state.activeTarget?.alive && state.activeTarget.group.visible) {
    state.targetNameEl.textContent = state.activeTarget.name;
    state.enemyHpFill.style.width = `${Math.max(0, state.activeTarget.hp / state.activeTarget.maxHp * 100)}%`;
    state.enemyHpText.textContent = `${Math.ceil(state.activeTarget.hp)} / ${state.activeTarget.maxHp}`;
  } else {
    state.targetNameEl.textContent = 'NO TARGET';
    state.enemyHpFill.style.width = '0%';
    state.enemyHpText.textContent = '—';
  }
  if (now > state.toastUntil) state.toastEl.className = '';
}
