import { state } from './state.js';
import { championById } from './roster.js';

const LESSONS={DUEL:'前に出てスキルを誘い、狙いが決まったら横へ回避。ミニオンと一緒にタワーへ。二本先取で勝利。'};
export const modeLesson = mode => LESSONS[mode] || LESSONS.DUEL;

export function coachingAdvice(s = state) {
  if(s.selectedChampion?.id==='Jhin'&&s.reloadUntil>performance.now()/1000)return 'ジンはリロード中。追加の攻撃入力より、敵との距離と次に狙うミニオンを確認しよう。';
  if(s.cancels>=2&&s.cancels/Math.max(1,s.hits+s.cancels)>.2)return `AAキャンセルが${s.cancels}回。弾が見えるまで待ってから移動しよう。`;
  if(s.mode==='DUEL'&&s.skillshotsHit>=2)return `スキルを${s.skillshotsHit}回受けている。ミニオンを盾にし、敵の詠唱を見たら横へ移動。CSを1体逃してもHPを守ろう。`;
  if(s.mode==='DUEL'&&s.missedCs>=2&&s.cs/(s.cs+s.missedCs)<.6)return `CS ${s.cs} / MISS ${s.missedCs}。HPバーに加え、味方の遠隔弾が当たる瞬間を見てAAを合わせよう。`;
  if((s.mode==='KITE'||s.mode==='COMBINED')&&s.hits>=3&&s.cleanKites/s.hits<.5)return '攻撃は出せている。次は弾の発射直後に1回移動し、次の攻撃まで止まらない練習をしよう。';
  if(s.playerHp<40)return '残りHPが少ない。敵へ近づくより、回避と安全な距離を優先しよう。';
  if(s.mode==='SPACING'&&s.modeData.spacingDangerTime>2)return '赤い危険範囲に入る時間が増えている。自分の射程の外側寄りを使おう。';
  if(s.micro?.windows.size)return '回避成功。相手が射程内なら、次の攻撃が来る前にAAを返そう。近づきすぎる追撃は不要。';
  if(s.micro?.recoveryTime>3&&s.micro.movingRecovery/s.micro.recoveryTime<.4)return 'AAの待ち時間に立ち止まりがち。発射後は横か後ろへ動き、次のAAでまた射程に入ろう。';
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
  state.coachClock-=dt;if(state.coachClock>0&&!state.micro?.windows.size)return;state.coachClock=4;
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
