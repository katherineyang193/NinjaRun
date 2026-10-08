export class MirrorController {
  constructor(settings){this.settings=settings;}
  get displayMirrored(){
    const {mirrorMode,calibration}=this.settings.value;
    if(mirrorMode==='normal')return false;
    if(mirrorMode==='mirror')return true;
    return calibration?.playerRightSign!==1;
  }
  get mirrorDirection(){return this.settings.value.calibration?.mirrorDirection??null;}
  apply(video){video.style.transform=this.displayMirrored?'scaleX(-1)':'none';}
}
