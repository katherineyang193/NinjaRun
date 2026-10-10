import test from 'node:test';
import assert from 'node:assert/strict';
import {ForestStage,buildForestTimeline,SEGMENTS} from '../src/game/ForestStage.js';
import {MotionDetector} from '../src/motion/MotionDetector.js';
import {neutral} from '../src/dev/self-test.js';
const idle=()=>({state:'CENTER',runState:'IDLE',runIntensity:0,events:[],features:neutral()});
const run=()=>({...idle(),state:'RUNNING',runState:'RUNNING',runIntensity:.6});
const hit=a=>({...idle(),state:a,events:[a]});
test('RUN-extended four-part timeline has four original obstacles and no overlapping active/recovery windows',()=>{
 for(const difficulty of ['EASY','NORMAL','HARD']){const events=buildForestTimeline({difficulty});assert.equal(events.length,10);assert.equal(SEGMENTS.at(-1).end,120000);
 assert.deepEqual(new Set(events.filter(e=>e.obstacle).map(e=>e.obstacle)),new Set(['CRATE','BRANCH','RIGHT_BLOCK','LEFT_BLOCK']));
 for(let i=0;i<events.length;i++){const e=events[i];assert.ok(e.previewStart<e.activeStart&&e.activeStart<e.activeEnd&&e.activeEnd<e.impactTime);if(i)assert.ok(events[i-1].recoveryEnd<=e.previewStart);}
 }
 assert.ok(!buildForestTimeline({jumpEnabled:false}).some(e=>e.type==='JUMP'||e.obstacle==='CRATE'));
});
test('one clock accepts ACTIVE success once, ignores early/wrong/late events, and clears the same obstacle at impact',()=>{
 const s=new ForestStage();s.advance(13000);const e=s.currentEvent();assert.equal(e.type,'JUMP');assert.equal(s.observe(hit('JUMP'),40),false);
 s.advance(e.activeStart-s.time);assert.equal(s.observe(hit('CROUCH'),40),false);assert.equal(s.observe(hit('JUMP'),40),true);const score=s.score;
 assert.equal(s.observe(hit('JUMP'),40),false);assert.equal(s.score,score);s.advance(e.impactTime-s.time);assert.equal(e.result,'SUCCESS');assert.equal(e.impactResolved,true);const notices=s.drainNotices();assert.ok(notices.some(n=>n.id===e.id&&n.result==='CLEAR'));assert.ok(!notices.some(n=>n.id===e.id&&n.result==='HIT'));
 assert.ok(e.attempts.some(a=>a.reason==='outside active window'));assert.ok(e.attempts.some(a=>a.reason==='different action'));
});
test('miss resets combo with only a small energy penalty and never prevents finishing',()=>{
 const s=new ForestStage();s.advance(14000);s.observe(hit('JUMP'),40);assert.equal(s.combo,1);
 s.advance(26000-s.time);const e=s.currentEvent();assert.equal(e.type,'CROUCH');const energy=s.energy;s.advance(e.activeEnd-s.time);assert.equal(e.result,'MISS');assert.equal(s.combo,0);assert.ok(energy-s.energy<6);assert.equal(s.observe(hit('CROUCH'),40),false);
 s.advance(e.impactTime-s.time);assert.equal(s.snapshot().characterState,'HIT');s.advance(501);assert.notEqual(s.snapshot().characterState,'HIT');s.advance(s.duration-s.time);assert.equal(s.finished,true);
 const empty=new ForestStage();empty.advance(empty.duration);assert.equal(empty.report().miss,10);assert.equal(empty.finished,true);assert.ok(empty.report().score>=0);
});
test('tracking pause freezes timeline, scenery distance, score, energy and impacts',()=>{
 const s=new ForestStage();s.advance(14500);s.pause();const before=[s.time,s.distance,s.score,s.energy];s.advance(5000);assert.deepEqual([s.time,s.distance,s.score,s.energy],before);assert.equal(s.observe(hit('JUMP'),40),false);
 s.pause(false);assert.equal(s.observe(hit('JUMP'),40),true);s.advance(100);assert.equal(s.time,14600);
});
test('RUN continuously controls bounded speed, points, energy and normal stars, even after its segment succeeds',()=>{
 const s=new ForestStage();for(let i=0;i<240;i++){s.advance(40);s.observe(run(),40);}assert.equal(s.events[0].result,'SUCCESS');assert.ok(s.runTime>8);assert.ok(s.speed>=1&&s.speed<=1.15);assert.ok(s.stars>=3);const runningEnergy=s.energy;
 s.observe(idle(),40);for(let i=0;i<60;i++){s.advance(40);s.observe(idle(),40);}assert.ok(s.speed>=.6&&s.speed<.7);assert.ok(s.energy<=runningEnergy);
 s.advance(s.events.at(-1).previewStart-s.time);const e=s.currentEvent();s.observe(run(),40);assert.equal(e.result,null);assert.equal(s.runHeld,0);s.advance(e.activeStart-s.time);s.observe(run(),40);for(let i=0;i<24;i++){s.advance(40);assert.equal(s.observe(run(),40),false);}s.advance(40);assert.equal(s.observe(run(),40),true);
});
test('dodge waits in PREVIEW for a confirmed return to physical center',()=>{
 const s=new ForestStage();s.advance(37000);const e=s.currentEvent();assert.equal(e.type,'DODGE_LEFT');s.observe({...idle(),features:{...neutral(),playerX:.22,playerShoulderX:.2}},40);
 s.advance(e.activeStart-s.time+50);assert.ok(s.snapshot().waitingForCenter);assert.ok(s.time<e.activeStart);assert.equal(e.result,null);
 for(let i=0;i<3;i++)s.observe(idle(),40);s.advance(50);assert.ok(s.time<e.activeStart);s.observe(idle(),40);s.advance(50);assert.ok(s.time>=e.activeStart);assert.equal(s.observe(hit('DODGE_LEFT'),40),true);
});
test('synthetic full level uses real MotionDetector output and all five actions can pass',()=>{
 const s=new ForestStage(),d=new MotionDetector();for(let i=0;i<5000;i++){s.advance(40);const e=s.currentEvent();let f=neutral();const beat=Math.floor(s.time/250)%2;f.leftLift=beat?.03:0;f.rightLift=beat?0:.03;
 if(e&&e.type!=='RUN'&&s.time>=e.activeStart&&s.time<e.activeStart+600){const changes=({JUMP:{hipRise:.14,shoulderRise:.14},CROUCH:{hipRise:-.12,shoulderRise:-.1},DODGE_LEFT:{playerX:-.22,playerShoulderX:-.2},DODGE_RIGHT:{playerX:.22,playerShoulderX:.2}})[e.type];Object.assign(f,changes);}
 s.observe(d.update(f,s.time,true),40);
 }
 const r=s.report();assert.equal(s.finished,true);assert.equal(r.success,10,JSON.stringify(r.actions));assert.ok(r.actions.every(a=>a.rate===100));assert.ok(r.averageReactionMs>=0);assert.ok(r.latestSuccessTime<=s.duration);assert.equal(r.poseFpsAverage,null);
});
test('turning jump off during a level replaces pending jump obstacles, and sprint speed remains bounded',()=>{
 const s=new ForestStage();s.advance(13000);s.setJumpEnabled(false);assert.equal(s.currentEvent().type,'CROUCH');assert.ok(!s.events.some(e=>!e.resolved&&e.type==='JUMP'));
 s.advance(110000-s.time);s.observe({...run(),runIntensity:1},40);for(let i=0;i<20;i++)s.advance(40);assert.ok(s.speed<=1.2);
});

test('RUN credit excludes preview time and repeated samples without advancing the game clock',()=>{
 const s=new ForestStage();s.advance(1990);s.observe(run(),40);s.advance(20);s.observe(run(),40);assert.equal(s.runHeld,10);
 for(let i=0;i<40;i++)s.observe(run(),40);assert.equal(s.runHeld,10);assert.equal(s.events[0].result,null);
 for(let i=0;i<24;i++){s.advance(40);s.observe(run(),40);}assert.equal(s.events[0].result,null);s.advance(40);assert.equal(s.observe(run(),40),true);assert.ok(s.events[0].successTime-s.events[0].activeStart>=1000);
});

test('scheduled time allocation is 48s dodge / 48s jump-crouch / 24s RUN without hidden RUN gaps',()=>{const s=new ForestStage();const totals={RUN:0,DODGE:0,JUMP_CROUCH:0};for(const e of s.events){totals[e.type==='RUN'?'RUN':e.type.startsWith('DODGE')?'DODGE':'JUMP_CROUCH']+=e.recoveryEnd-e.previewStart;}assert.deepEqual(totals,{RUN:24000,DODGE:48000,JUMP_CROUCH:48000});s.advance(23000);assert.equal(s.snapshot().currentPrompt,null);assert.equal(s.snapshot().promptState,'RECOVERY');});
test('120 second stage matches 40% dodge, 40% jump/crouch, 20% RUN on all difficulties',()=>{for(const difficulty of ['EASY','NORMAL','HARD']){const s=new ForestStage({difficulty});assert.equal(s.duration,120000);assert.equal(s.events.filter(e=>e.type.startsWith('DODGE')).length,4);assert.equal(s.events.filter(e=>['JUMP','CROUCH'].includes(e.type)).length,4);assert.equal(s.events.filter(e=>e.type==='RUN').length,2);}});
test('RUN reacquires after obstacles with two fresh alternating steps; standing still cannot resume',()=>{for(const type of ['JUMP','CROUCH','DODGE_LEFT','DODGE_RIGHT']){const d=new MotionDetector();let time=0;const sample=f=>d.update(f,time+=40,true);const shape=({JUMP:{hipRise:.14,shoulderRise:.14},CROUCH:{hipRise:-.12,shoulderRise:-.1},DODGE_LEFT:{playerX:-.22,playerShoulderX:-.2},DODGE_RIGHT:{playerX:.22,playerShoulderX:.2}})[type];sample(neutral());for(let i=0;i<10;i++)sample({...neutral(),...shape});for(let i=0;i<14;i++)assert.notEqual(sample(neutral()).runState,'RUNNING');let out;for(const left of [true,false])for(let i=0;i<6;i++)out=sample({...neutral(),leftLift:left?.03:0,rightLift:left?0:.03});assert.equal(out.runState,'RUNNING',type);}});
test('slower 350ms pose cadence keeps alternating RUN instead of repeatedly resetting tracking',()=>{const d=new MotionDetector();let out;for(let i=0;i<8;i++)out=d.update({...neutral(),leftLift:Math.floor(i/2)%2?.03:0,rightLift:Math.floor(i/2)%2?0:.03},i*350,true);assert.equal(out.runState,'RUNNING');assert.equal(d.update(neutral(),4000,true).state,'LOST_TRACKING');});

test('RUN recognizes alternating knees after a persistent unequal standing baseline without accepting static stance',()=>{const d=new MotionDetector();let t=0,out;for(let i=0;i<35;i++){out=d.update({...neutral(),leftLift:.04,rightLift:0},t+=40,true);assert.equal(out.runState,'IDLE');}for(let i=0;i<48;i++){const left=Math.floor(i/6)%2===0;out=d.update({...neutral(),leftLift:.04+(left?.025:0),rightLift:left?0:.025},t+=40,true);}assert.equal(out.runState,'RUNNING');});
test('short neutral RUN gaps preserve credit but do not award time during gaps',()=>{const s=new ForestStage();s.advance(2000);s.observe(run(),0);for(let i=0;i<15;i++){s.advance(40);s.observe(run(),40);}assert.equal(s.runHeld,600);for(let i=0;i<10;i++){s.advance(40);s.observe(idle(),40);}assert.equal(s.runHeld,600);for(let i=0;i<10;i++){s.advance(40);s.observe(run(),40);}assert.equal(s.events[0].result,'SUCCESS');});
