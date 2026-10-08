import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionProgress,ACTIONS} from '../src/motion/MotionProgress.js';
import {MotionDetector} from '../src/motion/MotionDetector.js';
import {neutral,syntheticTrace} from '../src/dev/self-test.js';

test('right dodge achievement survives neutral return, tracking loss and recovery',()=>{
  const detector=new MotionDetector(),progress=new MotionProgress();let now=0,result;
  const hold=(changes={},frames=15)=>{for(let i=0;i<frames;i++){now+=40;result=detector.update({...neutral(),...changes},now);progress.record(result.events);}};
  hold();hold({playerX:.22,playerShoulderX:.2});
  assert.equal(progress.snapshot().counts.DODGE_RIGHT,1);
  hold();assert.equal(result.state,'CENTER');assert.equal(progress.snapshot().lastAction,'DODGE_RIGHT');
  assert.equal(progress.snapshot().completed,1);
  progress.record(detector.update(null,now+=40,false).events);
  hold({playerX:.22,playerShoulderX:.2});assert.equal(progress.counts.DODGE_RIGHT,1);
  hold();hold({playerX:.22,playerShoulderX:.2});assert.equal(progress.counts.DODGE_RIGHT,2);
  hold();assert.equal(progress.snapshot().completed,1);
});

test('last of five achievements stays complete after returning to CENTER',()=>{
  const progress=new MotionProgress();
  for(const action of ACTIONS){const detector=new MotionDetector();let now=0;
    for(const frame of syntheticTrace(action)){now=frame.time;progress.record(detector.update(frame.f,now).events);}
    for(let i=0;i<20;i++)progress.record(detector.update(neutral(),now+=40).events);
  }
  assert.equal(progress.snapshot().allCompleted,true);assert.equal(progress.snapshot().completed,5);
  assert.equal(progress.snapshot().lastAction,'DODGE_RIGHT');assert.equal(progress.counts.DODGE_RIGHT,1);
  progress.reset();assert.equal(progress.snapshot().completed,0);assert.equal(progress.snapshot().lastAction,null);
});

test('disabled jump does not prevent completing the other four moves',()=>{
  const progress=new MotionProgress();progress.record(ACTIONS.filter(a=>a!=='JUMP'));
  assert.equal(progress.snapshot(false).total,4);assert.equal(progress.snapshot(false).allCompleted,true);
  assert.equal(progress.snapshot().allCompleted,false);
});
