import {ForestStage} from './ForestStage.js';
import {BossStage} from './BossStage.js';
/** A session coordinator, not another camera or render loop. */
export class AdventureStage {
 constructor(options={}){this.options={...options};this.forest=new ForestStage(options);this.boss=null;this.phase='FOREST';this.restTime=0;this.finished=false;this.paused=false;this.notices=[];}
 get time(){return this.forest.time+this.restTime+(this.boss?.time??0);}
 get duration(){return this.forest.duration+6000+(this.boss?.duration??55500);}
 currentEvent(){return this.phase==='FOREST'?this.forest.currentEvent():this.phase==='BOSS'?this.boss.currentEvent():null;}
 setJumpEnabled(v){this.options.jumpEnabled=v;this.forest.setJumpEnabled(v);this.boss?.setJumpEnabled(v);}
 pause(v=true){this.paused=v;this.forest.pause(v);this.boss?.pause(v);}
 observe(m,dt){if(this.paused)return false;return this.phase==='FOREST'?this.forest.observe(m,dt):this.phase==='BOSS'?this.boss.observe(m,dt):false;}
 advance(ms){if(this.paused||this.finished)return;
  if(this.phase==='FOREST'){this.forest.advance(ms);if(this.forest.finished){this.phase='ESCAPE';this.notices.push({result:'ESCAPE'});}}
  else if(this.phase==='ESCAPE'){this.restTime=Math.min(6000,this.restTime+Math.max(0,ms));if(this.restTime>=6000){this.boss=new BossStage({...this.options,energy:this.forest.energy});this.phase='BOSS';}}
  else {this.boss.advance(ms);if(this.boss.finished){this.phase='COMPLETE';this.finished=true;}}
 }
 snapshot(){if(this.phase==='FOREST')return this.forest.snapshot();if(this.phase==='ESCAPE')return {...this.forest.snapshot(),finished:false,paused:this.paused,promptState:'REST',currentPrompt:null,nextPrompt:[],showRunProgress:false,forestPrompt:false,rest:true};return this.boss.snapshot();}
 drainNotices(){return [...this.forest.drainNotices(),...(this.boss?.drainNotices()??[]),...this.notices.splice(0)];}
 notePerformance(p,r){(this.phase==='FOREST'?this.forest:this.phase==='BOSS'?this.boss:null)?.notePerformance(p,r);}
 report(){return {...this.forest.report(),boss:this.boss?.report()??null,totalDurationSeconds:this.time/1000};}
}
