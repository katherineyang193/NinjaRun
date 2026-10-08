import { MotionDetector } from '../motion/MotionDetector.js';
export const neutral=()=>({playerX:0,playerShoulderX:0,hipRise:0,shoulderRise:0,
  leftLift:0,rightLift:0,kneeAngle:180,kneeY:.75,hipY:.55,baselineLeg:.2});
export function syntheticTrace(action){
  const frames=[];let time=0;
  const hold=(changes,n)=>{for(let i=0;i<n;i++){time+=40;frames.push({f:{...neutral(),...changes},time});}};
  hold({},10);
  if(action==='RUN'){for(let i=0;i<5;i++){hold(i%2?{rightLift:.09}:{leftLift:.09},5);hold({},4);}}
  if(action==='JUMP'){hold({hipRise:.14,shoulderRise:.14},8);hold({},12);}
  if(action==='CROUCH')hold({hipRise:-.16,shoulderRise:-.14,kneeAngle:130,hipY:.66},10);
  if(action==='DODGE_LEFT')hold({playerX:-.22,playerShoulderX:-.2},10);
  if(action==='DODGE_RIGHT')hold({playerX:.22,playerShoulderX:.2},10);
  return frames;
}
export function runSelfTest(){
  return ['RUN','JUMP','CROUCH','DODGE_LEFT','DODGE_RIGHT'].map(action=>{
    const detector=new MotionDetector();const events=[];
    for(const {f,time} of syntheticTrace(action))events.push(...detector.update(f,time).events);
    return {action,pass:events.includes(action),events};
  });
}
