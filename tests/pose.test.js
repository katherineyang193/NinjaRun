import test from 'node:test';
import assert from 'node:assert/strict';
import {PoseManager} from '../src/pose/PoseManager.js';
test('worker inference is serial and stale sessions cannot deliver landmarks',async()=>{
  const prior=globalThis.createImageBitmap;const frames=[];let delivered=0,worker;
  globalThis.createImageBitmap=async()=>({close(){}});
  const manager=new PoseManager({onResult(){delivered++;},onError(error){throw error;}});
  worker={postMessage(frame){frames.push(frame);},terminate(){}};manager.worker=worker;
  const video={readyState:2,currentTime:1};
  try{
    manager.start(video);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(frames.length,1);
    const first=frames[0];worker.onmessage({data:{type:'result',session:first.session-1,landmarks:[],time:first.time}});assert.equal(delivered,0);
    worker.onmessage({data:{type:'result',session:first.session,landmarks:[],time:first.time}});assert.equal(delivered,1);
    manager.stop();worker.onmessage({data:{type:'result',session:first.session,landmarks:[],time:first.time}});assert.equal(delivered,1);
    manager.start(video);await new Promise(resolve=>setTimeout(resolve,0));const second=frames.at(-1);assert.notEqual(second.session,first.session);
    worker.onmessage({data:{type:'result',session:first.session,landmarks:[],time:first.time}});assert.equal(delivered,1);
    worker.onmessage({data:{type:'result',session:second.session,landmarks:[],time:second.time}});assert.equal(delivered,2);
  }finally{manager.close();if(prior)globalThis.createImageBitmap=prior;else delete globalThis.createImageBitmap;}
});
