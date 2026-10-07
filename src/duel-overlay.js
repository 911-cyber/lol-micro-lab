import { state } from './state.js';
const itemIcons={blade:'⚔',bow:'➶',boots:'♟',armor:'◈'};
export function updateDuelOverlay(now){
 const d=state.duel;if(!d)return;
 const seconds=Math.floor(d.time),timer=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
 document.querySelector('#matchStats').textContent=`${d.kills[0]} / ${d.kills[1]}　CS ${state.cs}　${timer}`;
 document.querySelector('#inventory').innerHTML=Array.from({length:6},(_,i)=>`<span class="item-cell ${d.items[i]?'equipped':''}" title="${d.items[i]||'空きスロット'}">${itemIcons[d.items[i]]||''}</span>`).join('');
 const units=[{position:state.player.position,name:state.selectedChampion.name,hp:state.playerHp,alive:state.playerHp>0,mana:state.abilities.mana/state.abilities.maxMana,cc:state.playerRootUntil>now?'拘束':''},{position:d.bot.group.position,name:'エズリアル BOT',hp:d.bot.hp,alive:d.bot.alive,mana:d.botMana/375,enemy:true,cc:d.bot.stunUntil>now?'スタン':d.bot.rootUntil>now?'拘束':d.cast?'詠唱中':''}];
 state.camera.updateMatrixWorld();
 document.querySelector('#overheads').innerHTML=units.filter(e=>e.alive).map(e=>{const p=e.position.clone().setY(3.1).project(state.camera);if(p.z>1||p.z< -1||Math.abs(p.x)>1.2||Math.abs(p.y)>1.2)return '';return `<div class="overhead" style="left:${(p.x+1)*innerWidth/2}px;top:${(1-p.y)*innerHeight/2}px"><span class="overhead-name">${e.name}</span><span class="overhead-cc">${e.cc}</span><div class="overhead-health ${e.enemy?'enemy':''}"><i style="width:${Math.max(0,e.hp)}%"></i></div><div class="overhead-mana"><i style="width:${Math.max(0,Math.min(100,(e.mana||0)*100))}%"></i></div></div>`;}).join('');
 // The HTML champion bars carry names, mana and crowd-control; keep sprite bars for minions/towers.
 if(d.bot.hpBar)d.bot.hpBar.root.visible=false;
}
