import {BossStage} from '../game/BossStage.js?v=boss22';
import {AdventureStage} from '../game/AdventureStage.js?v=boss22';
import {ForestView} from '../ui/ForestView.js?v=boss22';
import {PromptView} from '../ui/PromptView.js?v=boss22';
import {MotionDetector} from '../motion/MotionDetector.js';
import {neutral} from './self-test.js';
import {bossReportText,bossDebugText} from '../ui/BossReport.js?v=boss22';
import {AudioManager} from '../audio/AudioManager.js?v=boss22';
import {SpeechManager} from '../audio/SpeechManager.js';
import {SettingsManager} from '../settings/SettingsManager.js';
const $=id=>document.getElementById(id),view=new ForestView($('forestScene')),prompt=new PromptView($('promptStage')),settings=new SettingsManager(),audio=new AudioManager(settings),speech=new SpeechManager(settings);
let stage,detector,t=0,paused=false,miss=false,last=null,acc=0,finishedReport=false;
function reset({fail=false,noJump=false,adventure=false}={}){speech.reset();stage=adventure?new AdventureStage({difficulty:$('level').value}):new BossStage({difficulty:$('level').value,jumpEnabled:!noJump});detector=new MotionDetector({jumpEnabled:!noJump});t=0;acc=0;last=null;paused=false;miss=fail;finishedReport=false;view.reset();$('previewReport').textContent='';}
function tick(ms=40){stage.advance(ms);t+=ms;const e=stage.currentEvent(),s=stage.snapshot(),f=neutral();if(!miss&&e){const now=s.time;if(e.type==='RUN'){const beat=Math.floor(t/250)%2;f.leftLift=beat?.03:0;f.rightLift=beat?0:.03;}else if(now>=e.activeStart&&now<e.activeStart+600)Object.assign(f,({JUMP:{hipRise:.14,shoulderRise:.14},CROUCH:{hipRise:-.12,shoulderRise:-.1},DODGE_LEFT:{playerX:-.22,playerShoulderX:-.2},DODGE_RIGHT:{playerX:.22,playerShoulderX:.2}})[e.type]);}
 stage.observe(detector.update(f,t,true,{runRequested:e?.type==='RUN'}),ms);for(const n of stage.drainNotices())if(n.result==='SUCCESS')audio.play(n.type);else if(n.result==='HIT')audio.play('softHit');else audio.play(n.result);speech.update(stage.snapshot(),paused);
}
function draw(now){const s=stage.snapshot();view.update(s,now);prompt.update(s,paused);$('previewStatus').textContent=`CAMERA OFF · SYNTHETIC TEST · ${paused?'暫停':'執行中'} · ${stage.phase??'BOSS'} · ${(stage.time/1000).toFixed(1)}秒 · Scene ${view.fps.toFixed(1)} FPS · Canvas ${view.lastCost.toFixed(2)}ms`;
 if(stage.finished&&!finishedReport){const r=stage.report();$('previewReport').textContent='合成結果，非真人成功率\n'+bossReportText(r.boss??r);finishedReport=true;}else if(!stage.finished&&s.boss)$('previewReport').textContent=bossDebugText(s);
}
function frame(now){const dt=last===null?0:Math.min(100,now-last);last=now;if(!paused&&!stage.finished){acc+=dt;while(acc>=40){tick();acc-=40;}}draw(now);requestAnimationFrame(frame);}
function pause(){paused=!paused;stage.pause(paused);speech.reset();draw(performance.now());}
$('replay').onclick=()=>{audio.unlock();reset();};$('miss').onclick=()=>reset({fail:true});$('noJump').onclick=()=>reset({noJump:true});$('adventure').onclick=()=>reset({adventure:true});$('level').onchange=()=>reset();$('pause').onclick=pause;$('settingsPause').onclick=pause;
$('step').onclick=()=>{stage.pause(false);tick(100);paused=true;stage.pause();draw(performance.now());};
for(const [id,type] of Object.entries({jump:'JUMP',crouch:'CROUCH',left:'DODGE_LEFT',right:'DODGE_RIGHT'}))$(id).onclick=()=>{reset();const e=stage.events.find(e=>e.type===type);while(stage.time<e.previewStart)tick();paused=true;stage.pause();draw(performance.now());};
$('power').onclick=()=>{reset();while(stage.powerStart===null)tick();paused=true;stage.pause();draw(performance.now());};
$('finish').onclick=()=>{stage.pause(false);paused=false;for(let i=0;i<6000&&!stage.finished;i++)tick();draw(performance.now());};
reset();requestAnimationFrame(frame);
