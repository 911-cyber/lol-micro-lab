import { state } from './state.js';

// Movement/targeting rules are separate from training damage and cooldowns.
// Timings below are explicit simulation estimates, not frame-certified live values.
const TIMES={Ashe:[0,.25,.25,.25],Caitlyn:[.625,.25,.15,0],Jinx:[0,.6,.25,.6],Jhin:[.25,.75,.25,.25],Ezreal:[.25,.25,.25,1],Lucian:[.4,.25,0,0],Vayne:[0,0,.25,0],MissFortune:[.25,0,.25,0],Varus:[0,0,.25,.25],Kaisa:[0,.4,0,0]};
const TARGETS={'Jhin.Q':5.5,'Lucian.Q':5,'Vayne.E':5.5,'MissFortune.Q':6.5,'Caitlyn.R':35,'Kaisa.R':20};
export function castRule(id,key) {
  const slot='QWER'.indexOf(key);let duration=TIMES[id]?.[slot]||0;
  if(id==='Jinx'&&key==='W')duration=Math.max(.4,.6-.2*Math.max(0,state.ATTACK_SPEED/(state.selectedChampion?.as||.625)-1));
  const dash=['Lucian.E','Vayne.Q','Caitlyn.E','Ezreal.E','Kaisa.R'].includes(id+'.'+key);
  const channel=['Caitlyn.R','Jhin.R','MissFortune.R','Lucian.R'].includes(id+'.'+key);
  return {duration,dash,channel,targetRange:TARGETS[id+'.'+key],championOnly: ['Caitlyn.R','Kaisa.R'].includes(id+'.'+key),resetAttack:['Ashe.Q','Lucian.E','Vayne.Q'].includes(id+'.'+key)};
}
export function castDescription(id,key){
  if(id==='Vayne'&&key==='W')return '自動効果';
  if(id==='Varus'&&key==='Q')return 'チャージ中は移動可・AA不可。離すと短く停止して発射';
  if(id==='Kaisa'&&key==='E')return '加速中は移動可・AA不可';
  if(id==='Lucian'&&key==='R')return '連射中も移動可・AA不可';
  if(['Caitlyn.R','Jhin.R','MissFortune.R'].includes(id+'.'+key))return '構え／連射中は停止。移動・停止・AA入力で解除';
  const rule=castRule(id,key);return rule.duration?`詠唱中は停止（${rule.duration.toFixed(2)}秒）`:rule.dash?'移動スキル。移動終了までAA不可':'移動しながら使用可';
}
