import test from 'node:test';
import assert from 'node:assert/strict';
import {PromptSequence} from '../src/game/PromptSequence.js';
import {SettingsManager} from '../src/settings/SettingsManager.js';
const movement=a=>({state:a,events:[a],runState:a==='RUN'?'RUNNING':'IDLE'});
test('preview rejects all events; RUN needs a fresh continuous active second',()=>{
 const p=new PromptSequence();assert.equal(p.observe(movement('RUN'),100),false);p.advance(2000);
 for(let i=0;i<9;i++)assert.equal(p.observe(movement('RUN'),100),false);
 assert.equal(p.observe(movement('RUN'),100),true);assert.equal(p.state,'SUCCESS');
 p.advance(6000);assert.equal(p.snapshot().currentPrompt,'JUMP');assert.equal(p.state,'PREVIEW');
 assert.equal(p.observe(movement('JUMP'),40),false);p.advance(2000);assert.equal(p.observe(movement('CROUCH'),40),false);assert.equal(p.observe(movement('JUMP'),40),true);
});
test('all five actions score only during active and level remains 64 seconds',()=>{
 const p=new PromptSequence();for(let slot=0;slot<8;slot++){p.advance(2000);const a=p.snapshot().currentPrompt;
 if(a==='RUN')for(let i=0;i<10;i++)p.observe(movement(a),100);else assert.equal(p.observe(movement(a),40),true);
 p.advance(6000);}
 assert.equal(p.time,64000);assert.equal(p.state,'FINISHED');assert.equal(p.bestCombo,8);assert.ok(p.report().every(r=>r.rate===100));
});
test('misses, discontinuous running, and jump disabled reports are honest',()=>{
 const p=new PromptSequence({jumpEnabled:false});p.advance(2000);p.observe(movement('RUN'),100);p.observe(movement('CENTER'),100);assert.equal(p.runHeld,0);
 p.advance(62000);assert.equal(p.state,'FINISHED');assert.ok(!p.order.includes('JUMP'));assert.equal(p.report().find(r=>r.action==='JUMP').rate,null);assert.ok(p.report().filter(r=>r.attempts).every(r=>r.rate===0));
});
test('prompt size survives saved settings and invalid size uses large',()=>{
 let saved=null;const storage={getItem:()=>saved,setItem:(k,v)=>saved=v};const s=new SettingsManager(storage);assert.equal(s.value.promptSize,'LARGE');s.update({promptSize:'EXTRA_LARGE'});assert.equal(new SettingsManager(storage).value.promptSize,'EXTRA_LARGE');s.update({promptSize:'tiny'});assert.equal(s.value.promptSize,'LARGE');
});
import {MotionDetector} from '../src/motion/MotionDetector.js';
import {syntheticTrace} from '../src/dev/self-test.js';
test('real MotionDetector outputs feed each active prompt, rather than button simulation',()=>{
 const p=new PromptSequence();for(let slot=0;slot<8;slot++){
 p.advance(2000);const action=p.snapshot().currentPrompt;const d=new MotionDetector();const trace=syntheticTrace(action);
 for(const {f,time} of trace)p.observe(d.update(f,time,true),40);
 if(action==='RUN'){for(let i=0;i<60;i++){const f={...trace[0].f,leftLift:Math.floor(i/5)%2?.022:0,rightLift:Math.floor(i/5)%2?0:.022};p.observe(d.update(f,trace.at(-1).time+(i+1)*40,true),40);}}
 assert.equal(p.state,'SUCCESS',action);p.advance(6000);}
 assert.equal(p.report().filter(r=>r.rate===100).length,5);
});
