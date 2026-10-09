export const DEFAULTS=Object.freeze({promptSize:'LARGE',mirrorMode:'auto',difficulty:'EASY',sound:true,music:false,
  jumpEnabled:true,duration:180,rememberCalibration:true,calibration:null,gameHomeUrl:'https://katherineyang193.github.io/GameHome/'});
export class SettingsManager {
  constructor(storage) {this.storage=storage;this.warning='';this.value={...DEFAULTS};
    try{this.storage??=globalThis.localStorage;const saved=JSON.parse(this.storage.getItem('ninjaRun.settings.v1')??'{}');this.value=this.sanitize({...DEFAULTS,...saved});}
    catch{this.warning='設定暫時無法讀取，這次使用預設值。';}
  }
  sanitize(value){
    const out={...DEFAULTS};
    for(const key of ['sound','music','jumpEnabled','rememberCalibration'])if(typeof value[key]==='boolean')out[key]=value[key];
    if(['auto','mirror','normal'].includes(value.mirrorMode))out.mirrorMode=value.mirrorMode;
    if(['EASY','NORMAL','HARD'].includes(value.difficulty))out.difficulty=value.difficulty;
    if([60,120,180].includes(Number(value.duration)))out.duration=Number(value.duration);
    if(['STANDARD','LARGE','EXTRA_LARGE'].includes(value.promptSize))out.promptSize=value.promptSize;
    const c=value.calibration;
    if(c&&[-1,1].includes(c.playerRightSign)&&typeof c.mirrorDirection==='boolean'&&typeof c.deviceId==='string')out.calibration={
      playerRightSign:c.playerRightSign,mirrorDirection:c.mirrorDirection,deviceId:c.deviceId,aspect:Number(c.aspect)||4/3};
    try{const url=new URL(value.gameHomeUrl);if(url.protocol==='https:'||url.hostname==='localhost')out.gameHomeUrl=url.href;}catch{}
    return out;
  }
  update(patch){this.value=this.sanitize({...this.value,...patch});try{this.storage.setItem('ninjaRun.settings.v1',JSON.stringify(this.value));this.warning='';}
    catch{this.warning='瀏覽器無法保存設定，重新開啟後會使用預設值。';}return this.value;}
  calibrationFor(deviceId,aspect){const c=this.value.calibration;
    return !!deviceId&&this.value.rememberCalibration&&c?.deviceId===deviceId&&Math.abs(c.aspect-aspect)<.08?c:null;}
}
