export class TrackingManager {
  constructor() { this.reset(); }
  reset() {this.state='LOST_TRACKING';this.frames=0;this.since=null;this.lastTime=null;}
  update(features, now) {
    if (!features || (this.lastTime!==null&&now-this.lastTime>300)) {
      this.state='LOST_TRACKING';this.frames=0;this.since=null;
    }
    this.lastTime=now;
    if (features) {
      this.since??=now;this.frames++;
      if(this.frames>=4&&now-this.since>=100)this.state='TRACKING';
    }
    return {state:this.state,paused:this.state!=='TRACKING',message:this.state==='TRACKING'?'身體已找到 ✓':'回到框框裡～'};
  }
}
