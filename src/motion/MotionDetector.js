const clamp=v=>Math.max(0,Math.min(1,v));
/** Deterministic pose-time state machine. Jump > Crouch > Dodge > Run. */
export class MotionDetector {
  constructor({jumpEnabled=true}={}) {this.jumpEnabled=jumpEnabled;this.reset();}
  reset() {
    this.state='CENTER';this.previous=null;this.smooth=null;this.lastTime=null;
    this.gates={};this.cooldown={jump:-Infinity,crouch:-Infinity,dodge:-Infinity};
    this.jumpArmed=true;this.crouchArmed=true;this.dodgeArmed=true;
    this.stepSide=null;this.steps=[];this.runIntensity=0;this.runThreshold=.010;
    this.lastLegTime=null;this.lastSpecialTime=-Infinity;
  }
  confirm(key, condition, now, ms=75, frames=3) {
    if(!condition){delete this.gates[key];return false;}
    this.gates[key]??={since:now,frames:0};this.gates[key].frames++;
    return this.gates[key].frames>=frames&&now-this.gates[key].since>=ms;
  }
  lost() {
    this.reset();this.state='LOST_TRACKING';
    // Recovery must include a neutral posture; no rewards for reappearing off-center.
    this.jumpArmed=false;this.crouchArmed=false;this.dodgeArmed=false;
    return {state:this.state,runState:'IDLE',runIntensity:0,events:[]};
  }
  update(input, now, tracked=true) {
    if(!tracked||!input)return this.lost();
    if(this.lastTime!==null&&(now<=this.lastTime||now-this.lastTime>450))return this.lost();
    const dt=this.lastTime===null?33:now-this.lastTime;this.lastTime=now;
    const alpha=1-Math.exp(-dt/45);
    const keys=['playerX','playerShoulderX','hipRise','shoulderRise','leftLift','rightLift'];
    const f={...input};for(const key of keys)f[key]=this.smooth?this.smooth[key]+alpha*(input[key]-this.smooth[key]):input[key];
    this.smooth=f;
    const hipVelocity=this.previous?(f.hipRise-this.previous.hipRise)/(dt/1000):0;
    this.previous=f;
    const events=[];
    if(this.confirm('jumpReset',Math.abs(f.hipRise)<.035&&Math.abs(f.shoulderRise)<.045,now,110))this.jumpArmed=true;
    if(this.confirm('crouchReset',f.hipRise>-.045&&f.shoulderRise>-.065,now,110))this.crouchArmed=true;
    if(this.confirm('dodgeReset',Math.abs(f.playerX)<.055&&Math.abs(f.playerShoulderX)<.075,now,120))this.dodgeArmed=true;
    // Both shoulders and hips rise together; a fast ascent distinguishes straightening.
    const legsVisible=input.lowerBodyVisible!==false;
    const jump=legsVisible&&f.hipRise>.065&&f.shoulderRise>.055&&Math.abs(f.hipRise-f.shoulderRise)<.09;
    if(jump&&hipVelocity>.22)this.gates.jumpVelocity=now;
    const jumpConfirmed=this.confirm('jump',jump,now,65)&&now-(this.gates.jumpVelocity??-Infinity)<240;
    const crouch=f.hipRise<-.065&&f.shoulderRise<-.055&&Math.abs(f.hipRise-f.shoulderRise)<.12;
    const crouchConfirmed=this.confirm('crouch',crouch,now,100);
    const lateral=legsVisible&&Math.abs(f.playerX)>.12&&Math.abs(f.playerShoulderX)>.085&&Math.sign(f.playerX)===Math.sign(f.playerShoulderX);
    const dodgeSide=f.playerX<0?'DODGE_LEFT':'DODGE_RIGHT';
    const dodgeConfirmed=this.confirm('dodge_'+dodgeSide,lateral,now,95);
    this.confirm('dodge_'+(dodgeSide==='DODGE_LEFT'?'DODGE_RIGHT':'DODGE_LEFT'),false,now);
    if(this.jumpEnabled&&jumpConfirmed&&this.jumpArmed&&now-this.cooldown.jump>=700) {
      events.push('JUMP');this.jumpArmed=false;this.cooldown.jump=now;
    }
    const jumping=this.jumpEnabled&&!this.jumpArmed&&(jump||now-this.cooldown.jump<350);
    if(!jumping&&crouchConfirmed&&this.crouchArmed&&now-this.cooldown.crouch>=450){events.push('CROUCH');this.crouchArmed=false;this.cooldown.crouch=now;}
    const crouching=!jumping&&crouchConfirmed;
    if(!jumping&&!crouching&&dodgeConfirmed&&this.dodgeArmed&&now-this.cooldown.dodge>=420){events.push(dodgeSide);this.dodgeArmed=false;this.cooldown.dodge=now;}
    const dodging=!jumping&&!crouching&&lateral&&!this.dodgeArmed;
    if(jumping||crouching||dodging){this.lastSpecialTime=now;this.steps=[];this.stepSide=null;this.runIntensity=0;delete this.gates.step_left;delete this.gates.step_right;}
    else if(!legsVisible){
      // Preserve the rhythm through a brief knee occlusion, without awarding
      // running time while knees are unavailable.
      this.runIntensity=0;delete this.gates.step_left;delete this.gates.step_right;
      if(this.lastLegTime===null||now-this.lastLegTime>250){this.steps=[];this.stepSide=null;}
    }else {
      this.lastLegTime=now;
      const diff=f.leftLift-f.rightLift;
      // Small steps at full-body camera distance are enough. A slightly moving
      // calibration must not raise the threshold without limit.
      this.runThreshold=Math.max(.010,Math.min(.024,(input.runNoise??0)*2.2));
      const exit=this.runThreshold*.45;
      let side=diff>this.runThreshold?'left':diff<-this.runThreshold?'right':null;
      // Hysteresis keeps a candidate through small dips, but cannot create a new step.
      if(!side&&this.gates.step_left&&diff>exit)side='left';
      if(!side&&this.gates.step_right&&diff<-exit)side='right';
      const rawDiff=input.leftLift-input.rightLift;
      if(side&&(Math.sign(rawDiff)!==(side==='left'?1:-1)||Math.abs(rawDiff)<exit))side=null;
      if(this.confirm('step_'+side,!!side,now,35,2)&&side!==this.stepSide){
        if(this.steps.length&&now-this.steps.at(-1).time<150){/* Reject landmark flicker. */}
        else {this.steps.push({side,time:now});this.stepSide=side;}
      }
      for(const other of ['left','right'])if(other!==side)delete this.gates['step_'+other];
      this.steps=this.steps.filter(s=>now-s.time<3400);
      if(!this.steps.length)this.stepSide=null;
      // After a real obstacle action, two fresh alternating feet resume RUN.
      // Standing still cannot reuse old steps; normal cold start still needs three.
      const requiredSteps=now-this.lastSpecialTime<4000?2:3;
      const running=this.steps.length>=requiredSteps&&now-this.steps.at(-1).time<1150;
      this.runIntensity=running?clamp(.4+(this.steps.length-3)*.12):0;
    }
    const running=this.runIntensity>0;
    const next=jumping?'JUMPING':crouching?'CROUCHING':dodging?dodgeSide:running?'RUNNING':'CENTER';
    if(next==='RUNNING'&&this.state!=='RUNNING')events.push('RUN');
    this.state=next;
    return {state:next,runState:running?'RUNNING':'IDLE',runIntensity:this.runIntensity,stepCount:this.steps.length,runThreshold:this.runThreshold,runResume:now-this.lastSpecialTime<4000,events,features:f};
  }
}
