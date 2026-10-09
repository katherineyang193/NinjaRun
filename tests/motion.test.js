import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionDetector} from '../src/motion/MotionDetector.js';
import {PlayerCoordinateMapper} from '../src/motion/PlayerCoordinateMapper.js';
import {TrackingManager} from '../src/motion/TrackingManager.js';
import {CalibrationManager} from '../src/motion/CalibrationManager.js';
import {poseFeatures,standingCheck} from '../src/motion/pose-features.js';
import {SettingsManager} from '../src/settings/SettingsManager.js';
import {MirrorController} from '../src/motion/MirrorController.js';
import {neutral,syntheticTrace,runSelfTest} from '../src/dev/self-test.js';

function stream(detector=new MotionDetector()){
  let time=0,events=[],latest;
  return {detector,get events(){return events;},get latest(){return latest;},
    hold(changes={},frames=10,dt=40){for(let i=0;i<frames;i++){time+=dt;latest=detector.update({...neutral(),...changes},time);events.push(...latest.events);}return latest;},
    lost(){time+=40;latest=detector.update(null,time,false);events.push(...latest.events);return latest;}};
}
export function pose({raised=null,swapped=false,flipped=false}={}){
  const points=Array.from({length:33},()=>({x:.5,y:.4,visibility:.99,presence:.99,z:0}));
  const coords={0:[.5,.13],11:[.6,.29],12:[.4,.29],13:[.66,.41],14:[.34,.41],15:[.65,.52],16:[.35,.52],23:[.56,.53],24:[.44,.53],25:[.56,.73],26:[.44,.73],27:[.56,.91],28:[.44,.91]};
  for(const [index,[x,y]] of Object.entries(coords))points[index]={...points[index],x,y};
  if(raised)points[raised==='left'?15:16].y=.14;
  if(swapped)for(const [a,b] of [[11,12],[13,14],[15,16],[23,24],[25,26],[27,28]])[points[a],points[b]]=[points[b],points[a]];
  if(flipped)for(const p of points)p.x=1-p.x;
  return points;
}
const baseline={baselineHipX:.5,baselineHipY:.53,baselineShoulderX:.5,baselineShoulderY:.29,
  baselineKneeY:.73,baselineBodyHeight:.78,baselineLeftLeg:.2,baselineRightLeg:.2};

test('browser self-test uses all five actual detectors',()=>{assert.ok(runSelfTest().every(r=>r.pass));});
for(const action of ['RUN','JUMP','CROUCH','DODGE_LEFT','DODGE_RIGHT'])test(`${action} confirmed by a multi-frame trace`,()=>{
  const d=new MotionDetector();const events=syntheticTrace(action).flatMap(({f,time})=>d.update(f,time).events);
  assert.ok(events.includes(action),JSON.stringify(events));assert.equal(events.filter(e=>e===action).length,1);
});
test('standing still, head/wrist movement and small jitter award nothing',()=>{
  const s=stream();s.hold();for(let i=0;i<100;i++)s.hold({hipRise:Math.sin(i)*.013,shoulderRise:Math.sin(i)*.02,playerX:Math.sin(i)*.025,playerShoulderX:Math.sin(i)*.04},1);
  assert.deepEqual(s.events,[]);
});
test('single frame spikes cannot award jump/crouch/dodge',()=>{
  const s=stream();s.hold();for(const changes of [{hipRise:.2,shoulderRise:.2},{hipRise:-.25,shoulderRise:-.2,kneeAngle:110},{playerX:-.3,playerShoulderX:-.3}]){s.hold(changes,1);s.hold({},15);}
  assert.deepEqual(s.events,[]);
});
test('shoulder-only nod and leg-only lift are not jump/crouch',()=>{
  const s=stream();s.hold();s.hold({shoulderRise:-.18,kneeAngle:170},20);s.hold({},10);s.hold({leftLift:.15},20);s.hold({},10);s.hold({shoulderRise:.16},20);
  assert.deepEqual(s.events,[]);
});
test('slowly standing taller is not a jump',()=>{const s=stream();s.hold();for(let i=1;i<=60;i++)s.hold({hipRise:i*.002,shoulderRise:i*.002},1);assert.ok(!s.events.includes('JUMP'));});
test('one jump is counted once while airborne and cooldown applies',()=>{
  const s=stream();s.hold();s.hold({hipRise:.15,shoulderRise:.15},30);assert.equal(s.events.filter(e=>e==='JUMP').length,1);
  s.hold({},18);s.hold({hipRise:.15,shoulderRise:.15},8);assert.equal(s.events.filter(e=>e==='JUMP').length,2);
});
test('crouch needs hips plus shoulders lowering, and must stand before repeating',()=>{
  const s=stream();s.hold();s.hold({hipRise:-.15,shoulderRise:-.14,kneeAngle:180},10);assert.deepEqual(s.events,['CROUCH']);
  s.hold({hipRise:-.15,shoulderRise:-.14,kneeAngle:140},30);assert.equal(s.events.filter(e=>e==='CROUCH').length,1);
  s.hold({},15);s.hold({hipRise:-.15,shoulderRise:-.14,kneeAngle:140},10);assert.equal(s.events.filter(e=>e==='CROUCH').length,2);
});
test('crouch still works with no ankles via hip-to-knee shortening',()=>{const s=stream();s.hold();s.hold({hipRise:-.15,shoulderRise:-.14,kneeAngle:180,hipY:.66,kneeY:.75},10);assert.ok(s.events.includes('CROUCH'));});
test('holding left and crossing straight to right do not repeat dodge',()=>{
  const s=stream();s.hold();s.hold({playerX:-.25,playerShoulderX:-.22},50);s.hold({playerX:.25,playerShoulderX:.22},20);
  assert.deepEqual(s.events,['DODGE_LEFT']);s.hold({},12);s.hold({playerX:.25,playerShoulderX:.22},10);assert.deepEqual(s.events,['DODGE_LEFT','DODGE_RIGHT']);
});
test('hip-only or shoulder-only lean cannot dodge',()=>{const s=stream();s.hold();s.hold({playerX:.22},10);s.hold({},10);s.hold({playerShoulderX:.22},10);assert.deepEqual(s.events,[]);});
test('run needs alternating knees; one repeated leg is insufficient',()=>{
  const s=stream();s.hold();for(let i=0;i<6;i++){s.hold({leftLift:.09},5);s.hold({},4);}assert.deepEqual(s.events,[]);
});
test('run stops after no alternating step, with bounded intensity',()=>{const s=stream();s.hold();for(let i=0;i<6;i++){s.hold(i%2?{rightLift:.09}:{leftLift:.09},5);s.hold({},4);}assert.equal(s.latest.runState,'RUNNING');assert.ok(s.latest.runIntensity>0&&s.latest.runIntensity<=1);s.hold({},25);assert.equal(s.latest.runState,'IDLE');});
test('run can alternate without an artificially held neutral frame',()=>{const s=stream();s.hold();for(let i=0;i<6;i++)s.hold(i%2?{rightLift:.08}:{leftLift:.08},6);assert.equal(s.latest.runState,'RUNNING');});
test('jump takes priority over running and suppresses running intensity',()=>{const s=stream();s.hold();for(let i=0;i<5;i++){s.hold(i%2?{rightLift:.09}:{leftLift:.09},5);s.hold({},4);}s.hold({hipRise:.15,shoulderRise:.15,leftLift:.09},6);assert.equal(s.latest.state,'JUMPING');assert.equal(s.latest.runIntensity,0);});
test('jump disabled never emits a jump',()=>{const s=stream(new MotionDetector({jumpEnabled:false}));s.hold();s.hold({hipRise:.15,shoulderRise:.15},10);assert.ok(!s.events.includes('JUMP'));});
test('lost tracking immediately pauses; reappearing off-center cannot award dodge',()=>{
  const s=stream();s.hold();assert.equal(s.lost().state,'LOST_TRACKING');s.hold({playerX:.25,playerShoulderX:.22},15);assert.deepEqual(s.events,[]);
  s.hold({},15);s.hold({playerX:.25,playerShoulderX:.22},10);assert.deepEqual(s.events,['DODGE_RIGHT']);
});
test('tracking recovery requires continuous good frames, and rejects low visibility/out of bounds',()=>{
  const manager=new TrackingManager(),f=poseFeatures(pose());for(let i=0;i<3;i++)assert.equal(manager.update(f,i*40).paused,true);
  assert.equal(manager.update(f,120).paused,false);assert.equal(manager.update(null,160).paused,true);
  const points=pose();points[25].visibility=.1;assert.equal(poseFeatures(points),null);points[25].visibility=.99;points[25].y=1.2;assert.equal(poseFeatures(points),null);
  assert.equal(manager.update(f,500).paused,true);
});
test('mapping signs derive from calibration and do not depend on display mirroring',()=>{
  for(const sign of [-1,1]){const mapper=new PlayerCoordinateMapper({playerRightSign:sign,mirrorDirection:sign===1});
    const f={...poseFeatures(pose()),hipX:.5-sign*.15,shoulderX:.5-sign*.15};
    assert.ok(mapper.map(f,baseline).playerX<0);assert.equal(mapper.toGame('DODGE_LEFT').arrow,'←');
    assert.equal(mapper.toDisplayX(.2,true),.8);assert.equal(mapper.toDisplayX(.2,false),.2);assert.ok(mapper.map(f,baseline).playerX<0);
  }
});
for(const swapped of [false,true])for(const flipped of [false,true])test(`two-hand calibration: swapped=${swapped}, flipped=${flipped}`,()=>{
  const c=new CalibrationManager();let time=0,last;
  const frames=(options,count=12)=>{for(let i=0;i<count;i++){time+=40;last=c.update(poseFeatures(pose({swapped,flipped,...options})),time);}};
  frames({});assert.equal(c.phase,'LEFT_HAND');frames({raised:'left'});assert.equal(c.phase,'LOWER_HANDS');frames({});assert.equal(c.phase,'RIGHT_HAND');
  frames({raised:'right'});assert.equal(c.phase,'BASELINE');frames({},24);assert.equal(c.phase,'READY');
  assert.equal(last.direction.mirrorDirection,swapped);assert.equal(last.direction.playerRightSign,flipped?1:-1);assert.equal(last.baseline.frames,24);
});
test('calibration cannot advance with both hands up or a single frame',()=>{
  const c=new CalibrationManager();let time=0;for(let i=0;i<12;i++)c.update(poseFeatures(pose()),time+=40);
  const p=pose({raised:'left'});p[16].y=.14;for(let i=0;i<12;i++)c.update(poseFeatures(p),time+=40);assert.equal(c.phase,'LEFT_HAND');
  c.update(poseFeatures(pose({raised:'left'})),time+=40);c.update(poseFeatures(pose()),time+=40);assert.equal(c.phase,'LEFT_HAND');
});
test('baseline uses 24 stable frames and rejects gaps or changing position',()=>{
  const c=new CalibrationManager();c.reset({playerRightSign:-1,mirrorDirection:false});let time=0;
  for(let i=0;i<50;i++){const f=poseFeatures(pose());f.hipX=i%2?.46:.54;c.update(f,time+=40);}assert.equal(c.phase,'BASELINE');
  c.update(null,time+=40);for(let i=0;i<23;i++)c.update(poseFeatures(pose()),time+=40);assert.equal(c.phase,'BASELINE');
  c.update(poseFeatures(pose()),time+=400);assert.equal(c.phase,'BASELINE');
  for(let i=0;i<24;i++)c.update(poseFeatures(pose()),time+=40);assert.equal(c.phase,'READY');
});
test('position guidance and ankle-optional baseline',()=>{
  const f=poseFeatures(pose());assert.equal(standingCheck(f).message,'準備完成！');
  assert.equal(standingCheck({...f,hipX:.8}).message,'請站到中央');assert.equal(standingCheck({...f,bodyHeight:.2}).message,'再靠近一點');
  assert.equal(standingCheck({...f,bodyHeight:.96}).message,'再退後一點');const points=pose();points[27].visibility=.1;points[28].visibility=.1;
  assert.equal(standingCheck(poseFeatures(points)).ready,true);assert.equal(standingCheck(poseFeatures(points)).message,'我還看不到你的腳');
});
test('settings persist, sanitize corruption and bind calibration to camera/aspect',()=>{
  const store={text:null,getItem(){return this.text;},setItem(_,text){this.text=text;}};const s=new SettingsManager(store);
  s.update({mirrorMode:'normal',jumpEnabled:false,difficulty:'HARD',calibration:{playerRightSign:-1,mirrorDirection:false,deviceId:'a',aspect:4/3}});
  const refreshed=new SettingsManager(store);assert.equal(refreshed.value.mirrorMode,'normal');assert.equal(refreshed.value.jumpEnabled,false);
  assert.ok(refreshed.calibrationFor('a',4/3));assert.equal(refreshed.calibrationFor('b',4/3),null);assert.equal(refreshed.calibrationFor('a',3/4),null);
  store.text='{bad';assert.ok(new SettingsManager(store).warning);s.update({gameHomeUrl:'javascript:alert(1)',duration:-9,mirrorMode:'wrong'});assert.equal(s.value.duration,180);assert.equal(s.value.mirrorMode,'auto');
});
test('storage denied does not crash the game',()=>{const s=new SettingsManager({getItem(){throw Error('denied');},setItem(){throw Error('denied');}});assert.ok(s.warning);assert.doesNotThrow(()=>s.update({sound:false}));assert.equal(s.value.sound,false);assert.ok(s.warning);});
test('auto preview follows measured raw direction, manual mirror never changes player mapping',()=>{
  const settings={value:{mirrorMode:'auto',calibration:{playerRightSign:1}}};const mirror=new MirrorController(settings);
  assert.equal(mirror.displayMirrored,false);settings.value.calibration.playerRightSign=-1;assert.equal(mirror.displayMirrored,true);
  settings.value.mirrorMode='normal';assert.equal(mirror.displayMirrored,false);settings.value.mirrorMode='mirror';assert.equal(mirror.displayMirrored,true);
  assert.equal(settings.value.calibration.playerRightSign,-1);
});
test('baseline cannot be recorded with both hands up or bent knees',()=>{
  const c=new CalibrationManager();c.reset({playerRightSign:-1,mirrorDirection:false});let time=0;
  for(let i=0;i<30;i++){const p=pose({raised:'left'});p[16].y=.14;c.update(poseFeatures(p),time+=40);}
  assert.equal(c.phase,'BASELINE');assert.equal(c.samples.length,0);
  assert.equal(standingCheck({...poseFeatures(pose()),kneeAngle:130}).ready,false);
});
