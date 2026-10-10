import {ACTIONS} from './PromptSequence.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const SEGMENTS=[{id:'A',label:'起跑暖身',start:0,end:12000},{id:'B',label:'基礎障礙',start:12000,end:44000},{id:'C',label:'連續組合',start:44000,end:84000},{id:'D',label:'最後衝刺',start:84000,end:120000}];
const OBSTACLES={JUMP:'CRATE',CROUCH:'BRANCH',DODGE_LEFT:'RIGHT_BLOCK',DODGE_RIGHT:'LEFT_BLOCK'};
export function buildForestTimeline({jumpEnabled=true,difficulty='EASY'}={}){
 const timing=({EASY:{preview:2000,window:6000},NORMAL:{preview:1700,window:5000},HARD:{preview:1400,window:4000}})[difficulty]??{preview:2000,window:1800};
 const rows=[];
 const add=(type,start,runEnd=null)=>{if(type==='JUMP'&&!jumpEnabled)type='CROUCH';
  const activeStart=start+(type==='RUN'?2000:timing.preview),activeEnd=runEnd??activeStart+timing.window;
  const impactTime=activeEnd+200,recovery=type==='JUMP'?2000:type==='CROUCH'?2000:1800;
  rows.push({id:rows.length,type,obstacle:OBSTACLES[type]??null,previewStart:start,previewTime:start,activeStart,activeTime:activeStart,activeEnd,activeWindow:activeEnd-activeStart,impactTime,recoveryEnd:start+12000,resolved:false,result:null,successTime:null,firstMotionTime:null,impactResolved:false,attempts:[]});};
 add('RUN',0,11800);
 ['JUMP','CROUCH','DODGE_LEFT'].forEach((a,i)=>add(a,12000+i*12000));
 ['DODGE_RIGHT','JUMP','CROUCH'].forEach((a,i)=>add(a,48000+i*12000));
 ['DODGE_LEFT','DODGE_RIGHT'].forEach((a,i)=>add(a,84000+i*12000));
 add('RUN',108000,119800);return rows;
}
/** One game clock owns prompts, scoring windows, obstacle positions and impact.
 * Pose observations are stamped with this clock; render timers never score. */
export class ForestStage {
 constructor(options={}){this.events=buildForestTimeline(options);this.duration=this.events.at(-1).impactTime;this.segments=SEGMENTS.map((row,i)=>({...row,start:i===0?0:this.events[[0,1,4,7][i]].previewStart,end:i===3?this.duration:this.events[[1,4,7][i]].previewStart}));this.time=0;this.score=0;this.energy=20;this.combo=0;this.bestCombo=0;this.stars=0;this.distance=0;this.runTime=0;this.runHeld=0;this.runGap=0;this.idleTime=0;this.centerHeld=0;this.centerReady=true;this.paused=false;this.finished=false;this.speed=.6;this.motion={state:'CENTER',runState:'IDLE',runIntensity:0,events:[]};this.observedEventId=null;this.lastRunSampleTime=null;this.notices=[];this.lastFeedback=null;this.log=[];this.performance={pose:[],render:[]};}
 currentEvent(){return this.events.find(e=>this.time>=e.previewStart&&this.time<e.recoveryEnd)??null;}
 setJumpEnabled(enabled){if(!enabled)for(const e of this.events)if(!e.resolved&&e.type==='JUMP'){e.type='CROUCH';e.obstacle='BRANCH';}}
 pause(value=true){this.paused=value;if(value){this.lastRunSampleTime=null;this.runHeld=0;this.runGap=0;this.motion={state:'LOST_TRACKING',runState:'IDLE',runIntensity:0,events:[]};}}
 resolve(e,result){if(e.resolved)return;e.resolved=true;e.result=result;e.successTime=result==='SUCCESS'?this.time:null;
  if(result==='SUCCESS'){this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.score+=100+Math.min(30,(this.combo-1)*5);this.energy=clamp(this.energy+8+Math.min(3,this.combo*.3),0,100);this.stars+=e.type==='RUN'?1:3;}
  else {this.combo=0;this.energy=clamp(this.energy-3,0,100);}
  this.lastFeedback={time:this.time,result,type:e.type,id:e.id};this.notices.push({...this.lastFeedback});
 }
 advance(ms){if(this.paused||this.finished)return;let next=Math.min(this.duration,this.time+Math.max(0,ms));
  // A later dodge waits at the end of its preview for the player to return
  // physically to CENTER. Other actions may continue normally.
  const gate=this.events.find(e=>!e.resolved&&e.type.startsWith('DODGE')&&this.time<e.activeStart&&next>=e.activeStart);
  if(gate&&!this.centerReady)next=gate.activeStart-.001;
  const seconds=(next-this.time)/1000;this.time=next;
  const running=this.motion.runState==='RUNNING';const runRequested=this.currentEvent()?.type==='RUN';const target=Math.min(1.2,(!runRequested?1:running?1+clamp(this.motion.runIntensity??0,0,1)*.15:.6)*(this.time>=this.segments[3].start?1.12:1));
  this.speed+=(target-this.speed)*Math.min(1,seconds*3);this.distance+=this.speed*seconds;
  const collected=Math.floor(this.distance/4)-Math.floor((this.distance-this.speed*seconds)/4);if(collected>0){this.stars+=collected;this.score+=collected*10;this.notices.push({result:'STAR',time:this.time});}
  if(running){this.runTime+=seconds;this.score+=seconds*2;this.energy=clamp(this.energy+seconds*2,0,100);this.idleTime=0;}
  else {this.idleTime+=seconds;if(runRequested&&this.idleTime>3)this.energy=clamp(this.energy-seconds*.5,0,100);}
  for(const e of this.events){if(!e.resolved&&this.time>=e.activeEnd)this.resolve(e,'MISS');if(!e.impactResolved&&this.time>=e.impactTime){e.impactResolved=true;if(e.obstacle)this.notices.push({result:e.result==='SUCCESS'?'CLEAR':'HIT',type:e.type,id:e.id,time:e.impactTime});}}
  if(this.time>=this.duration)this.finished=true;
 }
 observe(motion,deltaMs=0){if(this.paused||this.finished)return false;this.motion=motion;
  const f=motion.features;const centered=f?Math.abs(f.playerX)<.055&&Math.abs(f.playerShoulderX)<.075:['CENTER','RUNNING'].includes(motion.state);
  if(centered){this.centerHeld+=Math.min(120,Math.max(0,deltaMs));if(this.centerHeld>=160)this.centerReady=true;}else {this.centerHeld=0;this.centerReady=false;}
  const e=this.currentEvent();if(!e){this.runHeld=0;this.runGap=0;return false;}
  if(this.observedEventId!==e.id){this.runHeld=0;this.runGap=0;this.observedEventId=e.id;this.lastRunSampleTime=null;}
  const previousRunSample=this.lastRunSampleTime;if(e.type==='RUN')this.lastRunSampleTime=this.time;
  const active=this.time>=e.activeStart&&this.time<e.activeEnd;
  for(const action of motion.events??[]){if(e.firstMotionTime===null)e.firstMotionTime=this.time;const attempt={time:this.time,action,accepted:active&&!e.resolved&&action===e.type,reason:e.resolved?'already resolved':!active?'outside active window':action!==e.type?'different action':'matched'};e.attempts.push(attempt);this.log.push({eventId:e.id,...attempt});}
  if(!active||e.resolved)return false;
  if(e.type==='RUN'){const delta=Math.min(120,Math.max(0,deltaMs),Math.max(0,this.time-Math.max(e.activeStart,previousRunSample??this.time)));if(motion.runState==='RUNNING'){this.runHeld+=delta;this.runGap=0;}else {this.runGap+=delta;if(motion.state!=='CENTER'||this.runGap>700)this.runHeld=0;}
   if(this.runHeld<1000)return false;
  }else if(!(motion.events??[]).includes(e.type))return false;
  this.resolve(e,'SUCCESS');return true;
 }
 snapshot(){const e=this.currentEvent(),segment=this.segments.find(s=>this.time>=s.start&&this.time<s.end)??this.segments.at(-1);
  let state='RECOVERY',prompt=null;const waiting=!!e&&e.type.startsWith('DODGE')&&!this.centerReady&&this.time>=e.activeStart-.01&&this.time<e.activeStart;
  if(e){if(e.result==='SUCCESS'&&this.time-e.successTime<700){state='SUCCESS';prompt=e.type;}
   else if(e.type==='RUN'&&e.result==='SUCCESS'){state='ACTIVE';prompt='RUN';}
   else if(this.time<e.activeStart){state='PREVIEW';prompt=e.type;}
   else if(!e.resolved){state='ACTIVE';prompt=e.type;}
   else if(e.result==='MISS'&&this.time<e.impactTime+500){state='MISS';prompt=e.type;}
   else {state='RECOVERY';prompt=null;}}
  if(this.finished)state='FINISHED';
  const next=this.events.filter(row=>row.previewStart>this.time).slice(0,2).map(row=>row.type);
  const impacted=this.events.find(row=>row.obstacle&&row.result==='MISS'&&this.time>=row.impactTime&&this.time<row.impactTime+500);
  const animation=impacted?'HIT':e?.result==='SUCCESS'&&e.type!=='RUN'&&this.time>=e.impactTime-450&&this.time<e.impactTime+450?e.type:'RUN';
  return {promptState:state,currentPrompt:prompt,nextPrompt:next,promptStartTime:e?.previewStart??this.time,activeWindow:e?[e.activeStart,e.activeEnd]:null,motionDetected:this.motion.state,successTimestamp:e?.successTime??null,runProgress:Math.min(1,this.runHeld/1000),showRunProgress:e?.type==='RUN'&&!e.resolved,slotAction:e?.type??null,combo:this.combo,time:this.time,score:Math.floor(this.score),energy:this.energy,stars:this.stars,speed:this.speed,distance:this.distance,segment,finalRun:this.time>=this.events.at(-1).previewStart,currentAction:e?.type??'RUN',eventState:e?.result??(e?(this.time<e.activeStart?'PREVIEW':'ACTIVE'):'CRUISING'),event:e,nextAction:next[0]??null,waitingForCenter:waiting,characterState:animation,paused:this.paused,finished:this.finished,lastFeedback:this.lastFeedback};
 }
 drainNotices(){return this.notices.splice(0);}
 notePerformance(pose,render){if(this.paused||this.finished)return;if(pose>0)this.performance.pose.push(pose);if(render>0)this.performance.render.push(render);}
 report(){const success=this.events.filter(e=>e.result==='SUCCESS');const reactions=success.map(e=>e.successTime-e.activeStart);const average=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  return {allocatedSeconds:{RUN:24,DODGE:48,JUMP_CROUCH:48},totalEvents:this.events.length,success:success.length,miss:this.events.filter(e=>e.result==='MISS').length,actions:ACTIONS.map(action=>{const rows=this.events.filter(e=>e.type===action),hits=rows.filter(e=>e.result==='SUCCESS');return {action,attempts:rows.length,successes:hits.length,rate:rows.length?Math.round(hits.length/rows.length*100):null};}),averageReactionMs:average(reactions),earliestActionTime:this.log.length?Math.min(...this.log.map(a=>a.time)):null,latestSuccessTime:success.length?Math.max(...success.map(e=>e.successTime)):null,score:Math.floor(this.score),energy:Math.round(this.energy),stars:this.stars,bestCombo:this.bestCombo,runSeconds:this.runTime,durationSeconds:this.time/1000,poseFpsAverage:average(this.performance.pose),renderFpsAverage:average(this.performance.render),poseFpsMinimum:this.performance.pose.length?Math.min(...this.performance.pose):null,events:this.events.map(e=>({...e,attempts:[...e.attempts]})),log:[...this.log]};
 }
}
