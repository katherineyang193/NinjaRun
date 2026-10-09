import test from 'node:test';
import assert from 'node:assert/strict';
import {poseFeatures} from '../src/motion/pose-features.js';
import {PlayerCoordinateMapper} from '../src/motion/PlayerCoordinateMapper.js';
import {MotionDetector} from '../src/motion/MotionDetector.js';
import {TrackingManager} from '../src/motion/TrackingManager.js';
import {bodyTrackable,drawTrackingOverlay,TRACKING_COLORS} from '../src/ui/TrackingOverlay.js';
import {neutral} from '../src/dev/self-test.js';
function points(){const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:.99,presence:.99}));
 for(const [i,y] of [[0,.13],[11,.29],[12,.29],[23,.53],[24,.53],[25,.73],[26,.73],[27,.91],[28,.91]])p[i].y=y;
 p[11].x=.6;p[12].x=.4;p[23].x=.56;p[24].x=.44;p[25].x=.56;p[26].x=.44;return p;}
const baseline={baselineHipX:.5,baselineHipY:.53,baselineShoulderX:.5,baselineShoulderY:.29,baselineBodyHeight:.78,baselineLeftLeg:.2,baselineRightLeg:.2};
test('calibration still requires knees, but playing retains torso tracking during a crouch',()=>{
 const p=points();p[25].y=1.05;p[26].visibility=.1;p[27].y=1.1;p[28].y=1.1;
 assert.equal(poseFeatures(p),null);assert.equal(bodyTrackable(p),false);assert.equal(bodyTrackable(p,true),true);
 const f=poseFeatures(p,4/3,{allowLowerBodyMissing:true});assert.ok(f);assert.equal(f.lowerBodyVisible,false);assert.equal(f.leftLeg,null);assert.equal(f.bodyHeight,null);
 const mapper=new PlayerCoordinateMapper({playerRightSign:1});const d=new MotionDetector(),tracker=new TrackingManager();let now=0,events=[];
 for(let i=0;i<8;i++){const good=poseFeatures(points());tracker.update(good,now+=40);d.update(mapper.map(good,baseline),now);}
 p[11].y+=.08;p[12].y+=.08;p[23].y+=.08;p[24].y+=.08;
 for(let i=0;i<10;i++){const partial=poseFeatures(p,4/3,{allowLowerBodyMissing:true});assert.equal(tracker.update(bodyTrackable(p,true)?partial:null,now+=40).paused,false);events.push(...d.update(mapper.map(partial,baseline),now).events);}
 assert.deepEqual(events,['CROUCH']);p[23].visibility=.1;assert.equal(bodyTrackable(p,true),false);assert.equal(poseFeatures(p,4/3,{allowLowerBodyMissing:true}),null);
});
test('downward shoulders alone and downward hips alone never count; torso descent works without knees',()=>{
 for(const changes of [{hipRise:-.09},{shoulderRise:-.09}]){const d=new MotionDetector();let events=[];for(let i=0;i<12;i++)events.push(...d.update({...neutral(),...changes,lowerBodyVisible:false},i*40).events);assert.deepEqual(events,[]);}
 const d=new MotionDetector();let events=[];for(let i=0;i<12;i++)events.push(...d.update({...neutral(),hipRise:-.09,shoulderRise:-.08,lowerBodyVisible:false},i*40).events);assert.deepEqual(events,['CROUCH']);
});
test('missing knee samples cannot award run/jump/dodge; brief gaps preserve prior rhythm only',()=>{
 const d=new MotionDetector();let now=0,m;for(let cycle=0;cycle<5;cycle++)for(let i=0;i<6;i++)m=d.update({...neutral(),leftLift:cycle%2?0:.025,rightLift:cycle%2?.025:0},now+=40);
 assert.equal(m.runState,'RUNNING');const steps=m.stepCount;
 for(let i=0;i<4;i++){m=d.update({...neutral(),lowerBodyVisible:false},now+=40);assert.equal(m.runState,'IDLE');assert.deepEqual(m.events,[]);assert.equal(m.stepCount,steps);}
 for(let i=0;i<5;i++)m=d.update({...neutral(),leftLift:0,rightLift:.025},now+=40);assert.equal(m.runState,'RUNNING');
 for(let i=0;i<8;i++)m=d.update({...neutral(),lowerBodyVisible:false},now+=40);assert.equal(m.stepCount,0);
});
test('running uses bilateral difference even after both legs drift from standing height',()=>{
 const d=new MotionDetector();let now=0,m;for(let cycle=0;cycle<6;cycle++)for(let i=0;i<6;i++)m=d.update({...neutral(),leftLift:-.05+(cycle%2?0:.025),rightLift:-.05+(cycle%2?.025:0)},now+=40);
 assert.equal(m.runState,'RUNNING');
});
test('accepted partial torso lights the frame but unseen knees stay blue',()=>{
 const fills=[],ctx={setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){fills.push(this.fillStyle);}};
 const canvas={clientWidth:800,clientHeight:600,width:0,height:0,getContext:()=>ctx},zone={dataset:{},style:{}};
 const p=points();p[25].visibility=.1;p[26].y=1.05;
 drawTrackingOverlay(canvas,zone,{landmarks:p,tracked:true,allowLowerBodyMissing:true});assert.equal(zone.dataset.tracking,'valid');assert.equal(fills[23],TRACKING_COLORS.valid);assert.equal(fills[25],TRACKING_COLORS.invalid);
});
