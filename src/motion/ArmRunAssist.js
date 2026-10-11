/** Arm rhythm helps small steps; arms alone never award RUN. */
export class ArmRunAssist {
 constructor(){this.reset();}
 reset(){this.arms=[];this.legs=[];this.candidates={};}
 sample(key,value,threshold,now){
  const side=value>threshold?1:value<-threshold?-1:0;
  if(!side){delete this.candidates[key];return;}
  let c=this.candidates[key];if(!c||c.side!==side)c=this.candidates[key]={side,since:now,frames:0};
  c.frames++;const rows=this[key];
  if(c.frames>=2&&now-c.since>=60&&side!==rows.at(-1)?.side&&now-(rows.at(-1)?.time??-Infinity)>=160)rows.push({side,time:now});
 }
 update(f,now){
  if(!f.armsVisible||f.hipRise<-.05||f.hipRise>.06){this.reset();return false;}
  this.sample('arms',f.armDifference,.07,now);
  if(f.lowerBodyVisible!==false)this.sample('legs',f.leftLift-f.rightLift,Math.max(.006,Math.min(.014,(f.runNoise??0)*1.5)),now);
  this.arms=this.arms.filter(s=>now-s.time<2400);this.legs=this.legs.filter(s=>now-s.time<2400);
  return this.arms.length>=3&&this.legs.length>=2&&now-this.arms.at(-1).time<850&&now-this.legs.at(-1).time<850&&f.lowerBodyVisible!==false;
 }
}
