export const ACTIONS=['RUN','JUMP','CROUCH','DODGE_LEFT','DODGE_RIGHT'];
const ORDER=['RUN','JUMP','RUN','DODGE_LEFT','CROUCH','RUN','DODGE_RIGHT','JUMP'];
/** Game time advances only while tracking is healthy. Each slot stays 8 seconds,
 * including after success, so completing early never shortens the 64 second level. */
export class PromptSequence {
  constructor({jumpEnabled=true}={}){this.order=ORDER.map(a=>a==='JUMP'&&!jumpEnabled?'CROUCH':a);this.time=0;this.index=0;this.state='PREVIEW';this.successTimestamp=null;this.motionDetected=null;this.runHeld=0;this.runGap=0;this.combo=0;this.bestCombo=0;this.results=[];}
  advance(ms){if(this.state==='FINISHED')return;this.time+=Math.max(0,ms);const index=Math.floor(this.time/8000);
    while(this.index<Math.min(index,this.order.length)){this.results.push({action:this.order[this.index],success:this.successTimestamp!==null});this.index++;this.successTimestamp=null;this.motionDetected=null;this.runHeld=0;this.runGap=0;}
    if(this.index>=this.order.length){this.state='FINISHED';return;}
    const offset=this.time-this.index*8000;
    const next=this.successTimestamp!==null?'SUCCESS':offset<2000?'PREVIEW':offset<7000?'ACTIVE':'MISS';
    if(next==='MISS'&&this.state!=='MISS')this.combo=0;this.state=next;
  }
  observe(motion,deltaMs){if(this.state!=='ACTIVE')return false;this.motionDetected=motion.state;
    const action=this.order[this.index];
    if(action==='RUN'){
      const delta=Math.min(120,Math.max(0,deltaMs));
      if(motion.runState==='RUNNING'){this.runHeld+=delta;this.runGap=0;}
      else {this.runGap+=delta;
        // A short CENTER dip often means one knee sample was missed. Keep
        // earned progress, but never count the missed time as running.
        if(motion.state!=='CENTER'||this.runGap>250)this.runHeld=0;
      }
    }
    const hit=action==='RUN'?this.runHeld>=1000:motion.events.includes(action);
    if(!hit)return false;this.successTimestamp=this.time;this.state='SUCCESS';this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);return true;
  }
  snapshot(){return {promptState:this.state,currentPrompt:this.order[this.index]??null,nextPrompt:this.order.slice(this.index+1,this.index+3),promptStartTime:this.index*8000,activeWindow:[this.index*8000+2000,this.index*8000+7000],motionDetected:this.motionDetected,successTimestamp:this.successTimestamp,runProgress:Math.min(1,this.runHeld/1000),combo:this.combo,time:this.time};}
  report(){return ACTIONS.map(action=>{const rows=this.results.filter(r=>r.action===action);const successes=rows.filter(r=>r.success).length;return {action,attempts:rows.length,successes,rate:rows.length?Math.round(successes/rows.length*100):null};});}
}
