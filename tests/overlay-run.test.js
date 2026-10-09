import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionDetector} from '../src/motion/MotionDetector.js';
import {neutral} from '../src/dev/self-test.js';
import {SAFE_BOUNDS,bodyInSafeFrame,nodeRecognized,fittedVideoRect,overlayPoint,drawTrackingOverlay,TRACKING_COLORS} from '../src/ui/TrackingOverlay.js';

const points=()=>Array.from({length:33},()=>({x:.5,y:.5,visibility:.99,presence:.99}));
test('wide safety frame accepts lateral movements and requires visible core joints',()=>{
  const p=points();p[11].x=.1;p[12].x=.9;assert.equal(bodyInSafeFrame(p),true);
  assert.ok(Math.abs(SAFE_BOUNDS.right-SAFE_BOUNDS.left-.92)<1e-9);
  p[25].x=.02;assert.equal(bodyInSafeFrame(p),false);p[25].x=.5;p[25].visibility=.1;assert.equal(bodyInSafeFrame(p),false);
});
test('yellow nodes need recognition; out-of-frame, low confidence and lost tracking are blue',()=>{
  const p=points()[0];assert.equal(nodeRecognized(p,true),true);
  assert.equal(nodeRecognized({...p,x:.97},true),false);assert.equal(nodeRecognized({...p,presence:.1},true),false);
  assert.equal(nodeRecognized(p,false),false);assert.equal(bodyInSafeFrame(null),false);
});
test('contain geometry and mirroring agree with video in landscape and portrait',()=>{
  const r=fittedVideoRect(1600,900,4/3);assert.deepEqual(r,{x:200,y:0,width:1200,height:900});
  assert.deepEqual(overlayPoint({x:.2,y:.3},r),{x:440,y:270});assert.deepEqual(overlayPoint({x:.2,y:.3},r,true),{x:1160,y:270});
  const portrait=fittedVideoRect(400,800,4/3);assert.deepEqual(portrait,{x:0,y:250,width:400,height:300});
});
test('overlay keeps visible blue nodes on tracking loss and colors frame only on valid body',()=>{
  const fills=[],ctx={setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){fills.push(this.fillStyle);}};
  const canvas={clientWidth:1600,clientHeight:900,width:0,height:0,getContext:()=>ctx},zone={dataset:{},style:{}};
  const p=points();p[15].x=.98;
  drawTrackingOverlay(canvas,zone,{landmarks:p,tracked:true,mirrored:false});
  assert.equal(zone.dataset.tracking,'valid');assert.ok(fills.includes(TRACKING_COLORS.valid));assert.ok(fills.includes(TRACKING_COLORS.invalid));
  assert.equal(zone.style.width,'1104px');fills.length=0;
  drawTrackingOverlay(canvas,zone,{landmarks:p,tracked:false,mirrored:true});
  assert.equal(zone.dataset.tracking,'invalid');assert.ok(fills.length>0);assert.ok(fills.every(c=>c===TRACKING_COLORS.invalid));
  fills.length=0;drawTrackingOverlay(canvas,zone,{landmarks:p,tracked:true,enabled:false});assert.equal(fills.length,0);assert.equal(zone.dataset.tracking,'valid');
});
test('fresh partial body keeps recognized nodes yellow and missing knees blue',()=>{
  const fills=[],ctx={setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){fills.push(this.fillStyle);}};
  const canvas={clientWidth:800,clientHeight:600,width:0,height:0,getContext:()=>ctx},zone={dataset:{},style:{}};
  const p=points();p[25].visibility=.1;
  drawTrackingOverlay(canvas,zone,{landmarks:p,tracked:false,fresh:true});
  assert.equal(zone.dataset.tracking,'invalid');assert.equal(fills[11],TRACKING_COLORS.valid);assert.equal(fills[25],TRACKING_COLORS.invalid);
});
function runTrace({dt=40,lift=.022,noise=0,frames=6,cycles=6,common=0,singleFrame=false}={}){
  const detector=new MotionDetector();let now=0,latest,events=[];
  const hold=(changes,n)=>{for(let i=0;i<n;i++){latest=detector.update({...neutral(),runNoise:noise,...changes},now+=dt);events.push(...latest.events);}};
  hold({},8);
  for(let i=0;i<cycles;i++){hold(i%2?{rightLift:lift+common,leftLift:common}:{leftLift:lift+common,rightLift:common},singleFrame?1:frames);hold({},singleFrame?8:2);}
  return {latest,events,hold,get state(){return latest;}};
}
test('small steps and slower cadence at 15 FPS produce sustained RUNNING',()=>{
  for(const dt of [40,67,100]){const s=runTrace({dt,frames:6});assert.ok(s.events.includes('RUN'),`dt=${dt}`);assert.equal(s.latest.runState,'RUNNING');
    s.hold({},Math.ceil(1500/dt));assert.equal(s.state.runState,'IDLE');}
});
test('calibrated knee noise rejects small alternating jitter but accepts clear steps',()=>{
  assert.ok(!runTrace({lift:.022,noise:.01}).events.includes('RUN'));
  assert.ok(runTrace({lift:.06,noise:.01}).events.includes('RUN'));
  assert.ok(!runTrace({lift:.009}).events.includes('RUN'));
});
test('common body bobbing and alternating one-frame spikes cannot run',()=>{
  assert.ok(!runTrace({lift:0,common:.06}).events.includes('RUN'));
  assert.ok(!runTrace({lift:.08,singleFrame:true}).events.includes('RUN'));
});
test('very small alternating steps are accepted at 15 FPS, and quiet jitter is rejected',()=>{
 const small=runTrace({dt:67,lift:.012,frames:5,noise:.001});assert.ok(small.events.includes('RUN'));assert.equal(small.latest.runState,'RUNNING');
 assert.ok(!runTrace({dt:67,lift:.008,frames:5,noise:.001}).events.includes('RUN'));
});
test('calibration noise has a bounded threshold and slower alternating steps stay running',()=>{
 const noisy=runTrace({noise:.02,lift:.04,frames:6});assert.ok(noisy.events.includes('RUN'));assert.equal(noisy.latest.runThreshold,.024);
 const d=new MotionDetector();let now=0,started=false,dropouts=0;
 for(let cycle=0;cycle<8;cycle++)for(let i=0;i<11;i++){
 const lift=i<9?.025:0;const f={...neutral(),leftLift:cycle%2?0:lift,rightLift:cycle%2?lift:0};const m=d.update(f,now+=100);
 if(m.runState==='RUNNING')started=true;else if(started)dropouts++;
 }
 assert.ok(started);assert.equal(dropouts,0);
});
