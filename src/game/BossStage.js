const clamp=v=>Math.max(0,Math.min(100,v));
export const BOSS_ACTIONS=['JUMP','CROUCH','DODGE_LEFT','DODGE_RIGHT'];
export const BOSS_TIMING={EASY:{preview:1300,active:2600},NORMAL:{preview:1000,active:2200},HARD:{preview:800,active:1800}};
const attacks={JUMP:'GROUND_WAVE',CROUCH:'LEAF_SWEEP',DODGE_LEFT:'RIGHT_IMPACT',DODGE_RIGHT:'LEFT_IMPACT'};
const pools=[['JUMP','DODGE_RIGHT','CROUCH','DODGE_LEFT','JUMP'],['CROUCH','DODGE_LEFT','JUMP','DODGE_RIGHT','CROUCH']];
/** Consumes existing motion events. All attack, prompt and animation timestamps
 * belong to this clock; pauses freeze it, including the 60s completion cap. */
export class BossStage {
 constructor({difficulty='EASY',jumpEnabled=true,energy=60,scriptIndex=0}={}){
  this.time=0;this.duration=55500;this.paused=false;this.finished=false;this.energy=clamp(Math.max(30,energy*.5));this.combo=0;this.bestCombo=0;this.bossStamina=0;this.success=0;this.miss=0;this.centerReady=true;this.centerHeld=0;this.powerStart=null;this.powerCount=0;this.weakVictory=false;this.notices=[{result:'BOSS_INTRO'}];this.performance={pose:[],render:[]};this.motion={state:'CENTER'};
  const timing=BOSS_TIMING[difficulty]??BOSS_TIMING.EASY,order=[...BOSS_ACTIONS,...pools[Math.abs(scriptIndex)%pools.length],'DODGE_RIGHT','CROUCH'];
  this.events=order.map((a,i)=>{const type=!jumpEnabled&&a==='JUMP'?'CROUCH':a,previewStart=2000+i*4500,activeStart=previewStart+timing.preview,activeEnd=activeStart+timing.active;return {id:`boss-${i}`,type,attack:attacks[type],attackFrom:type==='DODGE_LEFT'?'PLAYER_RIGHT':type==='DODGE_RIGHT'?'PLAYER_LEFT':null,previewStart,activeStart,activeEnd,impactTime:activeEnd+100,recoveryEnd:previewStart+4500,resolved:false,result:null,successTime:null,telegraphed:false,launched:false,impacted:false,bonus:i>=9,attempts:[]};});
 }
 currentEvent(){return this.powerStart===null?this.events.find(e=>this.time>=e.previewStart&&this.time<e.recoveryEnd)??null:null;}
 setJumpEnabled(enabled){if(!enabled)for(const e of this.events)if(!e.resolved&&e.type==='JUMP'){e.type='CROUCH';e.attack='LEAF_SWEEP';}}
 pause(value=true){this.paused=value;if(value){this.centerHeld=0;this.centerReady=false;}}
 resolve(e,result){if(e.resolved||this.powerStart!==null)return;e.resolved=true;e.result=result;e.successTime=result==='SUCCESS'?this.time:null;
  if(result==='SUCCESS'){this.success++;this.combo++;this.bestCombo=Math.max(this.combo,this.bestCombo);const beforeEnergy=this.energy;this.energy=clamp(this.energy+10);if(beforeEnergy<100&&this.energy===100)this.notices.push({result:'ENERGY_READY'});this.bossStamina=clamp(this.bossStamina+15);e.visualImpactTime=this.time+600;this.notices.push({result:'BOSS_TIRED'});}
  else {this.miss++;this.combo=0;this.energy=clamp(this.energy-3);}
  this.notices.push({result,type:e.type,id:e.id,time:this.time});
 }
 beginPower(){if(this.powerStart!==null)return;this.weakVictory=!(this.success>=6&&this.bossStamina>=100&&this.energy>=100);this.powerStart=this.time;this.powerCount++;this.duration=this.time+4000;
  for(const e of this.events)if(!e.resolved){e.resolved=true;e.result='SKIPPED';}
  this.notices.push({result:'POWER',weak:this.weakVictory});
 }
 advance(ms){if(this.paused||this.finished)return;let target=Math.min(this.powerStart===null?56000:this.duration,this.time+Math.max(0,ms));
  // Center gating shifts the remaining script, not the player's coordinates.
  // A bounded round cap completes safely even if center is never regained.
  const gate=this.events.find(e=>!e.resolved&&e.type.startsWith('DODGE')&&this.time<e.activeStart&&target>=e.activeStart);
  if(this.powerStart===null&&gate&&!this.centerReady){const delay=target-gate.activeStart+.001;for(const e of this.events)if(e.previewStart>=gate.previewStart){for(const key of ['activeStart','activeEnd','impactTime','recoveryEnd'])e[key]+=delay;if(e!==gate)e.previewStart+=delay;}}
  this.time=target;
  if(this.powerStart!==null){if(this.time>=this.duration){this.time=this.duration;this.finished=true;this.notices.push({result:'VICTORY'});}return;}
  for(const e of this.events){if(e.result==='SUCCESS'){if(!e.counterThrown&&this.time>=e.successTime+160){e.counterThrown=true;this.notices.push({result:'COUNTER_THROW'});}if(!e.counterHit&&this.time>=e.successTime+440){e.counterHit=true;this.notices.push({result:'COUNTER_HIT'});}}if(e.resolved&&e.result==='SKIPPED')continue;if(this.time>=e.previewStart&&!e.telegraphed){e.telegraphed=true;this.notices.push({result:'BOSS_TELEGRAPH'});}if(this.time>=e.activeStart&&!e.launched){e.launched=true;this.notices.push({result:e.attack});}if(!e.resolved&&this.time>=e.activeEnd)this.resolve(e,'MISS');if(e.resolved&&!e.impacted&&this.time>=(e.visualImpactTime??e.impactTime)){e.impacted=true;this.notices.push({result:e.result==='SUCCESS'?'CLEAR':'HIT',type:e.type});}}
  const baseDone=this.time>=this.events[8].recoveryEnd,qualified=this.success>=6&&this.energy>=100&&this.bossStamina>=100;
  if((baseDone&&qualified)||this.time>=this.events.at(-1).recoveryEnd||this.time>=56000)this.beginPower();
 }
 observe(motion,deltaMs=0){if(this.paused||this.finished||this.powerStart!==null)return false;this.motion=motion;const f=motion.features,center=f?Math.abs(f.playerX)<.055&&Math.abs(f.playerShoulderX)<.075:motion.state==='CENTER';
  if(center){this.centerHeld+=Math.min(120,Math.max(0,deltaMs));if(this.centerHeld>=160)this.centerReady=true;}else {this.centerHeld=0;this.centerReady=false;}
  const e=this.currentEvent();if(!e)return false;let accepted=false;
  for(const action of motion.events??[]){const valid=!e.resolved&&this.time>=e.activeStart&&this.time<e.activeEnd&&action===e.type;e.attempts.push({time:this.time,action,accepted:valid});if(valid){this.resolve(e,'SUCCESS');accepted=true;}}
  return accepted;
 }
 snapshot(){const e=this.currentEvent(),power=this.powerStart!==null,age=power?this.time-this.powerStart:0;let promptState=this.time<2000?'INTRO':power?(this.finished?'FINISHED':'POWER'):!e?'RECOVERY':e.result??(this.time<e.activeStart?'PREVIEW':'ACTIVE');
  const bossState=this.finished?'DEFEATED':power?(age<1000?'SURPRISED':'DEFEATED'):!e?'IDLE':e.result==='SUCCESS'?'TIRED':e.result==='MISS'?'ATTACK':this.time<e.activeStart?({JUMP:'TELEGRAPH_JUMP',CROUCH:'TELEGRAPH_CROUCH',DODGE_LEFT:'TELEGRAPH_RIGHT',DODGE_RIGHT:'TELEGRAPH_LEFT'})[e.type]:'ATTACK';
  const hit=e?.result==='MISS'&&this.time>=e.impactTime&&this.time<e.impactTime+500;
  return {boss:true,bossState,bossStamina:this.bossStamina,bossSuccess:this.success,bossMiss:this.miss,bossAttackCount:this.events.filter(e=>e.launched).length,powerReady:this.energy>=100,powerActive:power&&!this.finished,powerAge:age,weakVictory:this.weakVictory,promptState,currentPrompt:e?.type??null,nextPrompt:this.events.filter(x=>!x.resolved&&x.previewStart>(e?.previewStart??this.time)).slice(0,2).map(x=>x.type),promptStartTime:e?.previewStart??0,activeWindow:e?[e.activeStart,e.activeEnd]:null,event:e,waitingForCenter:!!e&&e.type.startsWith('DODGE')&&!this.centerReady&&this.time>=e.activeStart-1,time:this.time,energy:this.energy,combo:this.combo,score:0,stars:0,showRunProgress:false,characterState:this.finished||power&&age>=3000?'VICTORY':power?'POWER':hit?'HIT':e?.result==='SUCCESS'&&this.time-e.successTime<900?e.type:'IDLE',paused:this.paused,finished:this.finished,segment:{id:'BOSS',label:'森林胖胖王'},distance:0,motionDetected:this.motion.state};
 }
 drainNotices(){return this.notices.splice(0);}
 notePerformance(pose,render){if(!this.paused&&!this.finished){if(pose>0)this.performance.pose.push(pose);if(render>0)this.performance.render.push(render);}}
 report(){const rows=this.events.filter(e=>['SUCCESS','MISS'].includes(e.result)),average=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;return {totalAttacks:rows.length,success:this.success,miss:this.miss,actions:BOSS_ACTIONS.map(action=>{const r=rows.filter(e=>e.type===action),n=r.filter(e=>e.result==='SUCCESS').length;return {action,attempts:r.length,successes:n,rate:r.length?Math.round(n/r.length*100):null};}),averageReactionMs:average(rows.filter(e=>e.result==='SUCCESS').map(e=>e.successTime-e.activeStart)),bestCombo:this.bestCombo,energy:this.energy,bossStamina:this.bossStamina,bonusRounds:rows.filter(e=>e.bonus).length,powerCount:this.powerCount,weakVictory:this.weakVictory,durationSeconds:this.time/1000,poseFpsAverage:average(this.performance.pose),renderFpsAverage:average(this.performance.render),events:this.events.map(e=>({...e,attempts:e.attempts.map(a=>({...a}))}))};}
}
