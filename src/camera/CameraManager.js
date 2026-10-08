/** Extracted from CuteDart game.js requestCamera/stopCamera (a9755b7).
 * Shared lifecycle only: no game DOM, no recording, no uploads.
 */
export const cameraErrorMessage = err => ({
  NotAllowedError:'鏡頭還沒允許。請在網址列的網站權限，把相機改成允許後再試。',
  NotFoundError:'找不到鏡頭。請確認 Webcam 已連接。',
  NotReadableError:'鏡頭正在忙碌。請關閉其他使用鏡頭的程式後再試。',
  SecurityError:'請用 HTTPS 遊戲網址，或 localhost 開啟。',
  NotSupportedError:'這個瀏覽器無法開啟鏡頭，請使用 Chrome 或 Edge。',
  AbortError:'鏡頭已停止，可以再開一次。',
  TimeoutError:'鏡頭等待太久，請檢查瀏覽器的相機權限後再試。'
})[err?.name]??'鏡頭啟動失敗，請檢查連接與網站權限後再試。';
export class CameraManager {
  constructor(video,{onEnded=()=>{}}={}) {this.video=video;this.onEnded=onEnded;this.stream=null;this.epoch=0;}
  async start() {
    if(!globalThis.isSecureContext)throw Object.assign(new Error('secure context required'),{name:'SecurityError'});
    if(!navigator.mediaDevices?.getUserMedia)throw Object.assign(new Error('unsupported'),{name:'NotSupportedError'});
    this.stop();const epoch=this.epoch;
    let timer;
    const pending=navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},
      width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30}},audio:false});
    // Permission prompts cannot be cancelled; release any late stream after timeout/stop.
    pending.then(stream=>{if(epoch!==this.epoch)stream.getTracks().forEach(t=>t.stop());},()=>{});
    try {
      const stream=await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('timeout'),{name:'TimeoutError'})),30000);})]);
      if(epoch!==this.epoch){stream.getTracks().forEach(t=>t.stop());throw Object.assign(new Error('cancelled'),{name:'AbortError'});}
      this.stream=stream;this.video.srcObject=stream;await this.video.play();
      if(epoch!==this.epoch)throw Object.assign(new Error('cancelled'),{name:'AbortError'});
      stream.getVideoTracks()[0].addEventListener('ended',()=>{if(this.stream===stream){this.stop();this.onEnded();}},{once:true});
      return stream.getVideoTracks()[0].getSettings();
    }catch(error){if(epoch===this.epoch)this.stop();throw error;}finally{clearTimeout(timer);}
  }
  stop(){this.epoch++;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null;}
  get active(){return !!this.stream?.getVideoTracks().some(t=>t.readyState==='live');}
}
