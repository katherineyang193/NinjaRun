let model=null;
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      const {PoseLandmarker,FilesetResolver}=await import(data.visionUrl);
      const files=await FilesetResolver.forVisionTasks(data.wasmUrl);
      const options={baseOptions:{modelAssetPath:data.modelUrl,delegate:'GPU'},runningMode:'VIDEO',numPoses:1,
        minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5};
      try{model=await PoseLandmarker.createFromOptions(files,options);}catch{options.baseOptions.delegate='CPU';model=await PoseLandmarker.createFromOptions(files,options);}
      self.postMessage({type:'ready'});
    }else if(data.type==='frame'){
      try{const result=model.detectForVideo(data.frame,data.time);self.postMessage({type:'result',landmarks:result.landmarks?.[0]??null,time:data.time});}
      finally{data.frame.close();}
    }
  }catch(error){self.postMessage({type:'error',message:String(error.message??error)});}
};
