import { standingCheck, visible } from './pose-features.js';
export class CalibrationManager {
  constructor() { this.reset(); }
  reset(saved=null) {
    this.phase=saved?'BASELINE':'STANDING'; this.direction=saved;this.baseline=null;
    this.samples=[]; this.handCandidate=null; this.handSince=null; this.handFrames=0;
    this.firstHand=null; this.lowerSince=null; this.lastTime=null;
  }
  raised(f) {
    const left=visible(f.p.leftWrist,.55)&&f.p.leftWrist.y<f.p.leftShoulder.y-.09;
    const right=visible(f.p.rightWrist,.55)&&f.p.rightWrist.y<f.p.rightShoulder.y-.09;
    return left===right?null:(left?'left':'right');
  }
  update(f, now) {
    if (this.lastTime!==null&&now-this.lastTime>250) {
      this.samples=[]; this.handSince=null; this.handFrames=0; this.lowerSince=null;
    }
    this.lastTime=now;
    const check=standingCheck(f);
    if (!check.ready) {
      this.samples=[]; this.handSince=null; this.handFrames=0; this.lowerSince=null;
      return {phase:this.phase, message:check.message};
    }
    if (this.phase==='STANDING') {
      this.samples.push(f);
      if (this.samples.length>=12) {this.samples=[]; this.phase='LEFT_HAND';}
    }
    if (this.phase==='LEFT_HAND'||this.phase==='RIGHT_HAND') {
      const side=this.raised(f);
      if (!side) {this.handSince=null; this.handFrames=0; this.handCandidate=null;}
      else {
        if (this.handCandidate!==side) {this.handCandidate=side; this.handSince=now; this.handFrames=0;}
        this.handFrames++;
        if (this.handFrames>=5&&now-this.handSince>=250) {
          // Use shoulder separation for the horizontal sign; wrist can cross the torso.
          const dx=f.p[side+'Shoulder'].x-f.p[(side==='left'?'right':'left')+'Shoulder'].x;
          if (Math.abs(dx)<.05) return {phase:this.phase,message:'請面向鏡頭，再舉手一次'};
          if (this.phase==='LEFT_HAND') {
            this.firstHand={side,leftRawSign:Math.sign(dx)}; this.phase='LOWER_HANDS';
          } else if (side===this.firstHand.side||Math.sign(dx)===this.firstHand.leftRawSign) {
            this.phase='LEFT_HAND';this.firstHand=null;
            this.handSince=null;this.handFrames=0;this.handCandidate=null;
            return {phase:this.phase,message:'兩邊還沒對上，再舉一次你的左手'};
          } else {
            this.direction={mirrorDirection:this.firstHand.side==='right',
              playerRightSign:-this.firstHand.leftRawSign};
            this.phase='BASELINE';this.samples=[];
          }
          this.handSince=null;this.handFrames=0;this.handCandidate=null;
        }
      }
    } else if (this.phase==='LOWER_HANDS') {
      const lowered=['left','right'].every(side=>visible(f.p[side+'Wrist'])&&f.p[side+'Wrist'].y>f.p[side+'Shoulder'].y+.04);
      if (!lowered) this.lowerSince=null;
      else {this.lowerSince??=now;if(now-this.lowerSince>=250)this.phase='RIGHT_HAND';}
    } else if (this.phase==='BASELINE') {
      // Hands down prevents baseline acquisition during the calibration gesture.
      if (['left','right'].some(side=>visible(f.p[side+'Wrist'])&&f.p[side+'Wrist'].y<f.p[side+'Shoulder'].y-.04)) {
        this.samples=[];return {phase:this.phase,message:'雙手放下，站在中央'};
      }
      this.samples.push({...f,time:now}); if(this.samples.length>24)this.samples.shift();
      const keys=['hipX','hipY','shoulderY','kneeY','bodyHeight'];
      const stable=keys.every(key=>Math.max(...this.samples.map(s=>s[key]))-Math.min(...this.samples.map(s=>s[key]))<.028);
      if (this.samples.length===24&&stable&&now-this.samples[0].time>=750) {
        const avg=key=>this.samples.reduce((sum,s)=>sum+s[key],0)/this.samples.length;
        this.baseline={baselineHipX:avg('hipX'),baselineHipY:avg('hipY'),
          baselineShoulderX:avg('shoulderX'),baselineShoulderY:avg('shoulderY'),
          baselineKneeY:avg('kneeY'),baselineBodyHeight:avg('bodyHeight'),
          baselineLeftLeg:avg('leftLeg'),baselineRightLeg:avg('rightLeg'),frames:24};
        this.phase='READY';
      }
    }
    const messages={STANDING:check.warning?'我還看不到你的腳，膝蓋看得到也可以':'站在框框裡，讓我看看你',
      LEFT_HAND:'請舉起你的左手',LOWER_HANDS:'很好！先把雙手放下',RIGHT_HAND:'請舉起你的右手',
      BASELINE:'雙手放下，在中央站穩一下',READY:'準備完成！'};
    return {phase:this.phase,message:messages[this.phase],baseline:this.baseline,direction:this.direction};
  }
}
