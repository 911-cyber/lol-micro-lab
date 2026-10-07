import { state } from './state.js';
import { championById } from './roster.js';

const LESSONS = {
  FREE:'地面を右クリックで移動、敵を右クリックで通常攻撃。まず1発撃ってから移動してみよう。',
  KITE:'攻撃の発射前に動くとキャンセル。弾が出た直後に移動し、次の攻撃まで距離を作ろう。',
  TARGET:'カーソルを次の敵へ先に移し、A→左クリック。Attack Moveは射程内でカーソルに近い敵を選ぶ。',
  SPACING:'黄色が自分の攻撃射程、赤が危険範囲。安全な間合いを維持し、撃てる時だけ攻撃しよう。',
  DODGE:'相手のスキル名と予告を見る。直線や扇状は横移動、円形範囲は外へ。追い詰められたらF、回復はD。',
  CS:'赤いHPバーが通常攻撃1発以下になるまで待つ。味方の弾が着弾するタイミングも見よう。',
  COMBINED:'発射直後に横へ移動し、その移動でスキルショットも避ける。攻撃と回避を同じリズムに。',
  LANE:'CSのHPバーと敵のオレンジ予告線を交互に見る。予告線が出たらまず横移動、次にCSへ戻ろう。'
};
export const modeLesson = mode => LESSONS[mode] || LESSONS.FREE;

export function coachingAdvice(s = state) {
  if(s.selectedChampion?.id==='Jhin'&&s.reloadUntil>performance.now()/1000)return 'ジンはリロード中。追加の攻撃入力より、敵との距離と次に狙うミニオンを確認しよう。';
  if(s.cancels>=2&&s.cancels/Math.max(1,s.hits+s.cancels)>.2)return `AAキャンセルが${s.cancels}回。弾が見えるまで待ってから移動しよう。`;
  if(s.mode==='LANE'&&s.laneMetrics.hit>=2)return `ハラスを${s.laneMetrics.hit}回受けている。オレンジの線の横へ移動。CSを1体逃してもHPを守ろう。`;
  if((s.mode==='CS'||s.mode==='LANE')&&s.missedCs>=2&&s.cs/(s.cs+s.missedCs)<.6)return `CS ${s.cs} / MISS ${s.missedCs}。HPバーに加え、味方の遠隔弾が当たる瞬間を見てAAを合わせよう。`;
  if((s.mode==='KITE'||s.mode==='COMBINED')&&s.hits>=3&&s.cleanKites/s.hits<.5)return '攻撃は出せている。次は弾の発射直後に1回移動し、次の攻撃まで止まらない練習をしよう。';
  if(s.playerHp<40)return '残りHPが少ない。敵へ近づくより、回避と安全な距離を優先しよう。';
  if(s.mode==='SPACING'&&s.modeData.spacingDangerTime>2)return '赤い危険範囲に入る時間が増えている。自分の射程の外側寄りを使おう。';
  return modeLesson(s.mode)+' '+(s.selectedChampion?.tip||'');
}

export function coachContext() {
  if(state.menuOpen){const champion=championById(state.lobbyChampion);return {champion:champion.id,mode:state.lobbyMode,difficulty:state.difficulty().name,range:champion.range,attackSpeed:champion.as};}
  return { champion:state.menuOpen?state.lobbyChampion:state.selectedChampion?.id,mode:state.menuOpen?state.lobbyMode:state.mode,difficulty:state.difficulty().name,range:state.ATTACK_RANGE*100,attackSpeed:state.ATTACK_SPEED,
    hits:state.hits,cancels:state.cancels,cleanKites:state.cleanKites,cs:state.cs,missedCs:state.missedCs,dodges:state.dodges,hp:state.playerHp,
    harassHits:state.laneMetrics?.hit||0,remainingSeconds:state.modeData.time,lesson:modeLesson(state.mode) };
}

export function startCoach() {
  state.coachClock=0;
  document.querySelector('#coachPanel').hidden=!state.coachEnabled;
  document.querySelector('#coachMessage').textContent=coachingAdvice();
}
export function resultObservation(mode) {
  const name=state.selectedChampion?.name||'プレイヤー';
  if(mode==='CS'||mode==='LANE')return `${name}：CS ${state.cs}、取り逃し ${state.missedCs}。`+(mode==='LANE'?` ハラス被弾 ${state.laneMetrics.hit}回、残りHP ${Math.round(state.playerHp)}。`:'');
  if(mode==='DODGE')return `${name}：回避 ${state.dodges}回、被弾 ${state.skillshotsHit}回。`;
  if(mode==='SPACING')return `${name}：安全な射程内 ${state.modeData.spacingGoodTime.toFixed(1)}秒、危険範囲内 ${state.modeData.spacingDangerTime.toFixed(1)}秒。`;
  return `${name}：攻撃命中 ${state.hits}回、発射前キャンセル ${state.cancels}回、発射直後の移動 ${state.cleanKites}回。`;
}
export function updateCoach(dt) {
  if(!state.coachEnabled||state.resultPanel.classList.contains('show'))return;
  state.coachClock-=dt;if(state.coachClock>0)return;state.coachClock=4;
  document.querySelector('#coachMessage').textContent=coachingAdvice();
}

export function bindCoach() {
  const controls=[['coachQuestion','coachAnswer','coachForm','askCoach','aiStatus'],['lobbyQuestion','lobbyAnswer','lobbyCoachForm','lobbyAskCoach','lobbyAiStatus']].map(ids=>ids.map(id=>document.querySelector('#'+id)));
  for(const [input,answer,form,button] of controls){
  form.addEventListener('submit',async event=>{
    event.preventDefault();const question=input.value.trim();if(!question||button.disabled||!state.aiConnected)return;
    state.coachRequest?.abort();const controller=new AbortController();state.coachRequest=controller;button.disabled=true;
    answer.textContent='プレイ状況を確認しています…';
    try {
      const response=await fetch('./api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,context:coachContext()}),signal:controller.signal});
      const result=await response.json();if(!response.ok)throw Error(result.error||'AIに接続できませんでした。');answer.textContent=result.answer;
    } catch(error){if(error.name!=='AbortError')answer.textContent=error.message;}
    finally{button.disabled=!state.aiConnected;}
  });
  }
  fetch('./api/coach/status').then(async response=>response.ok?response.json():{connected:false}).then(result=>{
    state.aiConnected=!!result.connected;
    for(const [input,, ,button,status] of controls){
    status.closest?.('details')?.toggleAttribute('hidden',!state.aiConnected);
    status.textContent=state.aiConnected?'AIチャット接続済み':'AIチャット未接続 · プレイ分析は利用できます';
    button.disabled=!state.aiConnected;input.disabled=!state.aiConnected;
    input.placeholder=state.aiConnected?'コーチに質問する':'AIチャットはサーバー設定後に利用できます';
    }
  }).catch(()=>{for(const [,,,,status] of controls)status.textContent='AIチャット未接続 · プレイ分析は利用できます';});
}
