import test from 'node:test';
import assert from 'node:assert/strict';
import {CameraManager,cameraErrorMessage} from '../src/camera/CameraManager.js';
test('camera permissions, shared lifecycle, cleanup and late cancellation',async()=>{
  const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const originalSecure=Object.getOwnPropertyDescriptor(globalThis,'isSecureContext');
  let resolveRequest,stops=0,constraints;
  const track={readyState:'live',stop(){stops++;this.readyState='ended';},addEventListener(){},getSettings(){return {deviceId:'test-camera'};}};
  const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
  const video={srcObject:null,async play(){}};
  Object.defineProperty(globalThis,'isSecureContext',{value:true,configurable:true});
  Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia(options){constraints=options;return new Promise(resolve=>resolveRequest=resolve);}}},configurable:true});
  try{
    const camera=new CameraManager(video);let pending=camera.start();resolveRequest(stream);const device=await pending;
    assert.equal(device.deviceId,'test-camera');assert.equal(camera.active,true);assert.equal(constraints.audio,false);
    camera.stop();assert.equal(video.srcObject,null);assert.equal(camera.active,false);
    track.readyState='live';pending=camera.start();camera.stop();resolveRequest(stream);await assert.rejects(pending,{name:'AbortError'});assert.ok(stops>=2);assert.equal(camera.active,false);
  }finally{
    if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;
    if(originalSecure)Object.defineProperty(globalThis,'isSecureContext',originalSecure);else delete globalThis.isSecureContext;
  }
});
test('camera errors have readable recovery guidance',()=>{for(const name of ['NotAllowedError','NotFoundError','NotReadableError','SecurityError','NotSupportedError','TimeoutError'])assert.ok(cameraErrorMessage({name}).length>10);});
