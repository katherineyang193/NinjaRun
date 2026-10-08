// Same pinned Tasks Vision version and GPU -> CPU fallback as CuteDart gesture.js.
export const VISION_URL='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs';
export const WASM_URL='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
export const MODEL_URL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
export class PoseManager {
  constructor({onResult,onError,onStatus=()=>{}}) {
    this.onResult=onResult;this.onError=onError;this.onStatus=onStatus;
    this.worker=null;this.model=null;this.running=false;this.epoch=0;this.timer=null;
    this.mode='OFF';this.lastVideoTime=-1;this.fps=0;this.lastResultTime=null;
  }
  async initialize() {
    this.close();const epoch=this.epoch;this.onStatus('正在載入動作小幫手…');
    try {
      const worker=new Worker(new URL('./pose-worker.js',import.meta.url),{type:'module'});this.worker=worker;
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error('worker loading timeout')),25000);
        worker.onmessage=e=>{if(e.data.type==='ready'){clearTimeout(timeout);resolve();}else if(e.data.type==='error'){clearTimeout(timeout);reject(new Error(e.data.message));}};
        worker.onerror=()=>{clearTimeout(timeout);reject(new Error('worker unavailable'));};
        worker.postMessage({type:'init',visionUrl:VISION_URL,wasmUrl:WASM_URL,modelUrl:MODEL_URL});
      });
      if(epoch!==this.epoch)throw new Error('cancelled');
      this.mode='WORKER';this.onStatus('動作小幫手準備好了 ✓');return;
    }catch(error){
      if(epoch!==this.epoch)throw error;
      this.worker?.terminate();this.worker=null;this.onStatus('正在切換相容模式…');
    }
    const {PoseLandmarker,FilesetResolver}=await import(VISION_URL);
    const files=await FilesetResolver.forVisionTasks(WASM_URL);
    const options={baseOptions:{modelAssetPath:MODEL_URL,delegate:'GPU'},runningMode:'VIDEO',numPoses:1,
      minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5};
    let model;
    try{model=await PoseLandmarker.createFromOptions(files,options);}catch{options.baseOptions.delegate='CPU';model=await PoseLandmarker.createFromOptions(files,options);}
    if(epoch!==this.epoch){model.close();throw new Error('cancelled');}
    this.model=model;this.mode='COMPATIBILITY';this.onStatus('動作小幫手準備好了 ✓');
  }
  start(video) {
    this.stop();this.running=true;const epoch=this.epoch;this.lastVideoTime=-1;this.lastResultTime=null;
    if(this.worker){this.worker.onmessage=e=>{if(!this.running||epoch!==this.epoch)return;
      if(e.data.type==='result'){this.result(e.data.landmarks,e.data.time);this.schedule(()=>tick(),0);}
      else if(e.data.type==='error'){this.fail(new Error(e.data.message));}
    };this.worker.onerror=()=>this.fail(new Error('動作小幫手暫時中斷，請重新開始。'));}
    const tick=async()=>{
      if(!this.running||epoch!==this.epoch)return;
      if(video.readyState<2||video.currentTime===this.lastVideoTime){this.schedule(tick,30);return;}
      this.lastVideoTime=video.currentTime;const time=performance.now();
      try{
        if(this.worker){const frame=await createImageBitmap(video);
          if(!this.running||epoch!==this.epoch){frame.close();return;}
          this.worker.postMessage({type:'frame',frame,time},[frame]);
          this.timer=setTimeout(()=>this.fail(new Error('動作小幫手沒有回應，請重新開始。')),5000);
        }else{const result=this.model.detectForVideo(video,time);this.result(result.landmarks?.[0]??null,time);this.schedule(tick,Math.max(30,65-(performance.now()-time)));}
      }catch(error){this.fail(error);}
    };
    tick();
  }
  schedule(fn,delay){clearTimeout(this.timer);this.timer=setTimeout(fn,delay);}
  result(landmarks,time){clearTimeout(this.timer);if(this.lastResultTime!==null)this.fps=.8*this.fps+.2*1000/(time-this.lastResultTime);this.lastResultTime=time;this.onResult(landmarks,time);}
  fail(error){this.stop();this.onError(error);}
  stop(){this.running=false;this.epoch++;clearTimeout(this.timer);}
  close(){this.stop();this.worker?.terminate();this.worker=null;this.model?.close();this.model=null;this.mode='OFF';}
}
