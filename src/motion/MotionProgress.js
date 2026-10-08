export const ACTIONS=Object.freeze(['RUN','JUMP','CROUCH','DODGE_LEFT','DODGE_RIGHT']);

// Session achievements are independent of the detector's current pose/state.
export class MotionProgress {
  constructor(){this.reset();}
  reset(){this.counts=Object.fromEntries(ACTIONS.map(action=>[action,0]));this.lastAction=null;}
  record(events){for(const action of events){if(!ACTIONS.includes(action))continue;this.counts[action]++;this.lastAction=action;}}
  snapshot(jumpEnabled=true){
    const enabled=ACTIONS.filter(action=>jumpEnabled||action!=='JUMP');
    const completed=enabled.filter(action=>this.counts[action]>0).length;
    return {counts:{...this.counts},lastAction:this.lastAction,completed,total:enabled.length,allCompleted:completed===enabled.length};
  }
}
