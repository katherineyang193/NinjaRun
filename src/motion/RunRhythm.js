const quantile=(rows,q)=>{const a=rows.map(s=>s.value).sort((x,y)=>x-y);return a[Math.floor((a.length-1)*q)]??0;};
export function rhythmStats(rows,minimumAmplitude=.004){
 if(rows.length<6)return {amplitude:0,flips:0,lastFlip:null};
 const low=quantile(rows,.1),high=quantile(rows,.9),amplitude=high-low,mid=(low+high)/2;
 let side=0,flips=0,lastFlip=null,candidate=0,since=0,frames=0;const band=Math.max(minimumAmplitude*.25,amplitude*.2);
 for(const row of rows){const next=row.value>mid+band?1:row.value<mid-band?-1:0;
  if(!next||next===side){candidate=0;frames=0;continue;}
  if(candidate!==next){candidate=next;since=row.time;frames=0;}frames++;
  if(frames>=2&&row.time-since>=60){if(side){flips++;lastFlip=row.time;}side=next;candidate=0;frames=0;}
 }
 return {amplitude,flips,lastFlip};
}
/** Only numeric pose features; no camera frames are retained. */
export class RunCalibration {
 constructor(){this.reset();}
 reset(){this.rows=[];this.elapsed=0;this.lastTime=null;}
 pause(){this.lastTime=null;}
 observe(f,now){
  if(!f||f.lowerBodyVisible===false||Math.abs(f.hipRise)>.1){this.pause();return null;}
  const dt=this.lastTime===null?0:now-this.lastTime;this.lastTime=now;
  if(dt>0&&dt<=250)this.elapsed+=dt;
  this.rows.push({time:now,value:f.leftLift-f.rightLift});
  if(this.elapsed<5000)return null;
  const stats=rhythmStats(this.rows),noise=Math.max(.002,(f.runNoise??0)*2.5);
  if(stats.flips<4||stats.amplitude<Math.max(.008,noise*2))return {valid:false,reason:'再試一次，左右腳輪流小步踏'};
  return {valid:true,amplitude:stats.amplitude,amplitudeThreshold:Math.max(.006,noise*2,Math.min(.012,stats.amplitude*.30)),frames:this.rows.length};
 }
}
export class RunRhythm {
 constructor(){this.reset();}
 reset(){this.rows=[];}
 update(f,now,profile,allowDefault=false){
  if(f.lowerBodyVisible===false){this.reset();return {running:false,reason:'KNEES_NOT_VISIBLE',profileValid:!!profile?.valid};}
  if(!profile?.valid&&!allowDefault){this.reset();return {running:false,reason:"PROFILE_UNAVAILABLE",profileValid:false};}
  // Calibration is an initial reference, not a prerequisite for rhythmic steps.
  const threshold=Math.max(.006,(f.runNoise??0)*3.5,profile?.valid?Math.min(.010,profile.amplitudeThreshold):.008);
  if(this.rows.length&&now-this.rows.at(-1).time>250)this.reset();
  this.rows.push({time:now,value:f.leftLift-f.rightLift,left:f.leftLift,right:f.rightLift});this.rows=this.rows.filter(s=>now-s.time<=2400);
  const stats=rhythmStats(this.rows,threshold);
  const legRange=key=>{const rows=this.rows.map(s=>({value:s[key]}));return quantile(rows,.9)-quantile(rows,.1);};
  const bothLegs=legRange("left")>=threshold*.25&&legRange("right")>=threshold*.25;
  const running=bothLegs&&stats.amplitude>=threshold&&stats.flips>=3&&now-(stats.lastFlip??-Infinity)<1000;
  return {...stats,running,threshold,profileValid:!!profile?.valid,reason:running?'RHYTHM':!bothLegs?'BOTH_LEGS_REQUIRED':stats.amplitude<threshold?'AMPLITUDE_LOW':stats.flips<3?'BUILDING_RHYTHM':'NO_RECENT_STEP'};
 }
}
