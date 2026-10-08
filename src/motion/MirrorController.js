export class MirrorController {
  constructor(settings){this.settings=settings;}
  get displayMirrored(){return this.settings.value.mirrorMode!=='normal';}
  get mirrorDirection(){return this.settings.value.calibration?.mirrorDirection??null;}
  apply(video){video.style.transform=this.displayMirrored?'scaleX(-1)':'none';}
}
