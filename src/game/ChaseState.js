const clamp=v=>Math.max(0,Math.min(100,v));
const RULES={EASY:{runRate:3.2,idleRate:1,success:3,runBonus:4,miss:6,runMiss:8},NORMAL:{runRate:3,idleRate:1.4,success:2.5,runBonus:3.5,miss:7,runMiss:9},HARD:{runRate:2.8,idleRate:1.8,success:2,runBonus:3,miss:8,runMiss:10}};
/** Feedback only. Advances exclusively with ForestStage's game clock. */
export class ChaseState {
 constructor({chaseEnabled=true,difficulty='EASY'}={}){this.enabled=chaseEnabled;this.rules=RULES[difficulty]??RULES.EASY;this.distance=65;this.visualDistance=65;this.state=chaseEnabled?'WAITING':'OFF';this.catchCount=0;this.lastDelta=null;this.minimum=65;this.maximum=65;this.log=[];this.notices=[];this.catchUntil=null;this.recoverUntil=null;this.finished=false;}
 change(amount,reason,time){if(!this.enabled||this.state==='WAITING'||this.finished||this.state==='CATCH')return;const before=this.distance;this.distance=clamp(before+amount);this.lastDelta={time,reason,amount:this.distance-before};this.minimum=Math.min(this.minimum,this.distance);this.maximum=Math.max(this.maximum,this.distance);if(!reason.endsWith('_STATE'))this.log.push({...this.lastDelta,distance:this.distance});if(this.distance===0)this.catch(time);}
 catch(time){if(this.state==='CATCH')return;this.state='CATCH';this.catchUntil=time+1000;this.catchCount++;this.log.push({time,reason:'CATCH',amount:0,distance:0});this.notices.push({result:'CATCH',time});}
 outcome(type,result,time){this.change(result==='SUCCESS'?(type==='RUN'?this.rules.runBonus:this.rules.success):-(type==='RUN'?this.rules.runMiss:this.rules.miss),type+'_'+result,time);}
 advance(from,to,{runSlot=false,running=false,intensity=0}={}){if(!this.enabled||this.finished||to<=from)return;
  if(this.state==='WAITING'&&to>=24000){this.state='ENTER';this.notices.push({result:'CHASE_ENTER',time:24000});this.log.push({time:24000,reason:'ENTER',amount:0,distance:this.distance});}
  if(to<24000)return;
  if(this.state==='CATCH'&&to>=this.catchUntil){this.distance=50;this.state='RECOVER';this.recoverUntil=this.catchUntil+1000;this.lastDelta={time:this.catchUntil,reason:'RECOVER',amount:50};this.log.push({...this.lastDelta,distance:50});}
  const catching=this.state==='CATCH',recovering=this.state==='RECOVER'&&to<this.recoverUntil;
  if(!catching&&!recovering&&runSlot){const dt=(to-Math.max(from,24000,this.recoverUntil??0))/1000;if(dt>0)this.change(dt*(running?this.rules.runRate+Math.max(0,Math.min(1,intensity))*.3:-this.rules.idleRate),running?'RUN_STATE':'IDLE_STATE',to);}
  if(!['CATCH','RECOVER'].includes(this.state)||this.state==='RECOVER'&&to>=this.recoverUntil)this.state=to<26500?'ENTER':this.distance<25?'DANGER':this.distance<40?'CLOSE':'RUN';
  // Visual smoothing is also game-time driven, so pause freezes the monster.
  this.visualDistance+=(this.distance-this.visualDistance)*(1-Math.exp(-(to-from)/300));
 }
 finish(time){if(!this.enabled)return;this.finished=true;this.state='ESCAPED';this.log.push({time,reason:'ESCAPED',amount:0,distance:this.distance});}
 snapshot(time){return {enabled:this.enabled,chaseDistance:this.distance,visualDistance:this.visualDistance,chaseState:this.state,catchCount:this.catchCount,lastChaseDelta:this.lastDelta,chaseDanger:this.distance<25&&this.state!=='WAITING',catchUntil:this.catchUntil,entryProgress:Math.max(0,Math.min(1,(time-24000)/2500))};}
 report(){return {enabled:this.enabled,minimum:this.minimum,maximum:this.maximum,catchCount:this.catchCount,appearances:this.log.filter(r=>r.reason==='ENTER').length,log:this.log.map(r=>({...r}))};}
}
