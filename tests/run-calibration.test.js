import test from 'node:test';
import assert from 'node:assert/strict';
import {RunCalibration,RunRhythm} from '../src/motion/RunRhythm.js';
import {MotionDetector} from '../src/motion/MotionDetector.js';
import {ForestStage} from '../src/game/ForestStage.js';
import {neutral} from '../src/dev/self-test.js';
function feet(t,lift=.008){return {...neutral(),leftLift:Math.floor(t/260)%2?lift:0,rightLift:Math.floor(t/260)%2?0:lift,lowerBodyVisible:true};}
function calibrate(lift=.008){const c=new RunCalibration();let profile;for(let t=0;t<=5040;t+=40)profile=c.observe(feet(t,lift),t);return profile;}
test('five actual sampled seconds produce a personal threshold for small natural steps',()=>{const p=calibrate();assert.equal(p.valid,true);assert.ok(p.amplitudeThreshold>=.006&&p.amplitudeThreshold<.01);const c=new RunCalibration();for(let t=0;t<5000;t+=40)assert.equal(c.observe(feet(t),t),null);});
test('standing, one-leg static bias and missing knees cannot establish a running profile',()=>{
 assert.equal(calibrate(0).valid,false);const c=new RunCalibration();let p;for(let t=0;t<=5040;t+=40)p=c.observe({...neutral(),leftLift:.06,rightLift:0},t);assert.equal(p.valid,false);
 for(let t=0;t<10000;t+=40)c.observe({...neutral(),lowerBodyVisible:false},t);assert.equal(c.elapsed,5040);
});
test('a tracking gap does not consume five-second calibration time',()=>{const c=new RunCalibration();c.observe(feet(0),0);c.observe(feet(40),40);c.pause();c.observe(feet(10000),10000);assert.equal(c.elapsed,40);c.observe(feet(10040),10040);assert.equal(c.elapsed,80);});
test('personal rhythm accepts small steps, survives normal cadence, and stops when feet stop',()=>{
 const p=calibrate(),d=new MotionDetector();d.setRunProfile(p);let m,hit=false;
 for(let t=40;t<=4000;t+=40){m=d.update(feet(t),t,true,{runRequested:true});hit||=m.runSource==='PERSONAL_RHYTHM';}assert.equal(hit,true);assert.equal(m.runState,'RUNNING');
 for(let t=4040;t<=6500;t+=40)m=d.update(neutral(),t);assert.equal(m.runState,'IDLE');
 d.lost();assert.equal(d.rhythm.rows.length,0);assert.equal(d.runProfile.valid,true);
});
test('rhythm rejects quiet jitter, clears missing-leg history, and other actions keep priority',()=>{
 const p=calibrate(),r=new RunRhythm();for(let t=0;t<4000;t+=40)assert.equal(r.update(feet(t,.001),t,p).running,false);
 r.update({...neutral(),lowerBodyVisible:false},4040,p);assert.equal(r.rows.length,0);
 const d=new MotionDetector();d.setRunProfile(p);let m;for(let t=40;t<3000;t+=40)m=d.update(feet(t),t,true,{runRequested:true});for(let t=3000;t<3400;t+=40)m=d.update({...neutral(),hipRise:-.12,shoulderRise:-.1},t);assert.equal(m.state,'CROUCHING');assert.equal(m.runState,'IDLE');
});
test('RUN diagnostic distinguishes detected samples from insufficient held credit',()=>{
 const s=new ForestStage();s.advance(3000);for(let i=0;i<5;i++){s.advance(40);s.observe({state:'RUNNING',runState:'RUNNING',runSource:'PERSONAL_RHYTHM',features:neutral(),events:[]},40);}for(let i=0;i<25;i++){s.advance(40);s.observe({state:'CENTER',runState:'IDLE',features:neutral(),events:[],runDiagnostic:{reason:'AMPLITUDE_LOW'}},40);}s.advance(2000);
 const e=s.events[0];assert.equal(e.result,'MISS');assert.equal(e.runDiagnostics.detectedMs,160);assert.equal(e.runDiagnostics.bestHeldMs,160);assert.equal(e.runDiagnostics.reasons.AMPLITUDE_LOW,25);
});

test('isolated one-frame leg spikes cannot establish rhythm',()=>{const r=new RunRhythm(),p=calibrate();for(let t=0;t<=4000;t+=40){const spike=t%240===0;const f=feet(t,spike?.08:0);assert.equal(r.update(f,t,p).running,false);}});
test('calibrated small steps complete the four RUN windows in the real forest timeline',()=>{
 const d=new MotionDetector(),s=new ForestStage();d.setRunProfile(calibrate());
 for(let i=1;i<=3000;i++){s.advance(40);const e=s.currentEvent(),t=i*40;let f=neutral();if(e?.type==='RUN')f=feet(t);s.observe(d.update(f,t,true,{runRequested:e?.type==='RUN'}),40);}
 const rows=s.events.filter(e=>e.type==='RUN');assert.ok(rows.every(e=>e.result==='SUCCESS'));
 assert.ok(rows.every(e=>e.runDiagnostics.rhythmMs>0));assert.ok(rows.every(e=>e.runDiagnostics.legacyMs===0));assert.ok(s.duration<=120000);assert.equal(s.time,s.duration);
});

test('large calibration steps do not block slower small steps during play',()=>{const p=calibrate(.07),r=new RunRhythm();let hit=false;for(let t=0;t<6000;t+=40){const side=Math.floor(t/520)%2;r.update({...neutral(),leftLift:side?.008:0,rightLift:side?0:.008},t,p).running&&(hit=true);}assert.equal(hit,true);});
test('default rhythm works without a profile but rejects standing and missing knees',()=>{const r=new RunRhythm();let hit=false;for(let t=0;t<4000;t+=40)hit||=r.update(feet(t),t,null,true).running;assert.equal(hit,true);assert.equal(r.update({...neutral(),lowerBodyVisible:false},4040,null,true).reason,'KNEES_NOT_VISIBLE');for(let t=4080;t<8000;t+=40)assert.equal(r.update(neutral(),t,null,true).running,false);});
test('RUN retains credit across long detection gaps without awarding idle or pause time',()=>{const s=new ForestStage();s.advance(s.events[0].activeStart);const run={state:'RUNNING',runState:'RUNNING',features:neutral(),events:[]},idle={state:'CENTER',runState:'IDLE',features:neutral(),events:[]};s.observe(run,0);for(let i=0;i<13;i++){s.advance(40);s.observe(run,40);}assert.equal(s.runHeld,520);for(let i=0;i<23;i++){s.advance(40);s.observe(idle,40);}assert.equal(s.runHeld,520);s.pause();s.advance(2000);assert.equal(s.runHeld,520);s.pause(false);s.observe(run,0);for(let i=0;i<12;i++){s.advance(40);s.observe(run,40);}assert.equal(s.events[0].result,'SUCCESS');});
test('default game rhythm rejects repeated single-leg lifts and isolated spikes',()=>{for(const kind of ['one-leg','spikes']){const r=new RunRhythm();for(let t=0;t<5000;t+=40){const f=kind==='one-leg'?{...feet(t,.03),rightLift:0}:feet(t,t%240===0?.08:0);assert.equal(r.update(f,t,null,true).running,false);}}});

test('small bilateral steps survive a conservative noise baseline while quiet noise does not',()=>{const p={valid:true,amplitudeThreshold:.017},r=new RunRhythm();let detected=false;for(let t=0;t<5000;t+=40){const m=r.update({...feet(t,.0065),runNoise:.0034},t,p);detected||=m.running;}assert.equal(detected,true);const quiet=new RunRhythm();for(let t=0;t<5000;t+=40)assert.equal(quiet.update({...feet(t,.002),runNoise:.0034},t,p).running,false);});
