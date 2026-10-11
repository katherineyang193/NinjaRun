import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionDetector} from '../src/motion/MotionDetector.js';
import {MotionProgress} from '../src/motion/MotionProgress.js';
import {ForestStage} from '../src/game/ForestStage.js';
import {neutral} from '../src/dev/self-test.js';
import {bodyTrackable,drawTrackingOverlay} from '../src/ui/TrackingOverlay.js';
function trace({arms=true,legs=true,offset=0,requested=false}={}){
 const d=new MotionDetector();let now=0,m,seen=false;
 for(let cycle=0;cycle<8;cycle++)for(let i=0;i<6;i++){
  const side=cycle%2?1:-1;
  m=d.update({...neutral(),playerX:offset,playerShoulderX:offset,armsVisible:arms,armDifference:side*.12,leftLift:legs&&side>0?.009:0,rightLift:legs&&side<0?.009:0},now+=40,true,{runRequested:requested});
  if(m.runSource==='ARMS_AND_LEGS')seen=true;
 }
 return {d,now,m,seen};
}
test('arm rhythm supports small alternating steps without requiring a higher knee lift',()=>{
 const assisted=trace();assert.equal(assisted.seen,true);assert.equal(assisted.m.runState,'RUNNING');
 assert.equal(trace({arms:false}).m.runState,'IDLE');
});
test('waving alone cannot RUN, and assistance expires after feet stop',()=>{
 assert.equal(trace({legs:false}).seen,false);
 const s=trace();for(let i=0;i<45;i++)s.m=s.d.update({...neutral(),armsVisible:true,armDifference:Math.floor(i/6)%2?.12:-.12},s.now+=40);
 assert.equal(s.m.runState,'IDLE');s.d.lost();assert.equal(s.d.armAssist.arms.length,0);
});
test('RUN slots tolerate lateral drift while dodge slots retain player-direction detection',()=>{
 const s=trace({offset:.19,requested:true});assert.equal(s.m.runState,'RUNNING');assert.equal(s.m.events.includes('DODGE_RIGHT'),false);
 const dodge=trace({offset:.19});assert.equal(dodge.m.state,'DODGE_RIGHT');
});
test('forest achievements count only resolved successes and match the final report',()=>{
 const s=new ForestStage(),p=new MotionProgress();
 for(const e of s.events){s.advance(e.activeStart-s.time);s.observe({state:'CENTER',runState:'IDLE',events:['CROUCH'],features:neutral()},40);if(!e.resolved)s.resolve(e,e.id%3?'SUCCESS':'MISS');p.recordResults(s.drainNotices());}
 for(const row of s.report().actions)assert.equal(p.counts[row.action],row.successes);
 const before={...p.counts};p.recordResults([{result:'CLEAR',type:'JUMP'},{result:'HIT',type:'CROUCH'}]);assert.deepEqual(p.counts,before);
});
test('visible torso at the frame edge remains trackable during play, but missing torso does not',()=>{
 const points=Array.from({length:33},()=>({x:.025,y:.5,visibility:.99,presence:.99}));
 assert.equal(bodyTrackable(points,false),false);assert.equal(bodyTrackable(points,true),true);
 points[23].visibility=.1;assert.equal(bodyTrackable(points,true),false);
});
test('center cross uses fitted video center and stays visible when skeleton is off',()=>{
 const lines=[],ctx={setTransform(){},clearRect(){},beginPath(){},moveTo(x,y){lines.push(['M',x,y]);},lineTo(x,y){lines.push(['L',x,y]);},stroke(){},arc(){}};
 drawTrackingOverlay({clientWidth:800,clientHeight:800,width:0,height:0,getContext:()=>ctx},{dataset:{},style:{}},{landmarks:null,tracked:false,enabled:false,aspect:4/3});
 assert.deepEqual(lines,[['M',400,100],['L',400,700],['M',0,400],['L',800,400]]);
});

test('real pose wrist features are body-scaled and raised hands disable arm assistance',async()=>{const {poseFeatures}=await import('../src/motion/pose-features.js');const {PlayerCoordinateMapper}=await import('../src/motion/PlayerCoordinateMapper.js');const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:.99,presence:.99}));p[0].y=.1;for(const i of [11,12])p[i].y=.3;for(const i of [23,24])p[i].y=.55;for(const i of [25,26])p[i].y=.75;p[15].y=.45;p[16].y=.6;const f=poseFeatures(p);assert.equal(f.armsVisible,true);const mapped=new PlayerCoordinateMapper({playerRightSign:-1}).map(f,{baselineBodyHeight:.8});assert.ok(Math.abs(mapped.armDifference-(-.15/.8))<1e-9);p[15].y=.2;assert.equal(poseFeatures(p).armsVisible,false);});
