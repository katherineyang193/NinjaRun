import {RunCalibration} from '../motion/RunRhythm.js?v=run17';
import {drawTrackingOverlay} from '../ui/TrackingOverlay.js?v=run17';
import {ForestStage} from '../game/ForestStage.js?v=run17';
import {ForestView} from '../ui/ForestView.js?v=run17';
import {PromptView} from '../ui/PromptView.js?v=run17';
import {MotionDetector} from '../motion/MotionDetector.js?v=run17';
import {neutral} from './self-test.js?v=body3';
import {forestReportText} from '../ui/StageReport.js?v=run17';
const $=id=>document.getElementById(id),view=new ForestView($('forestScene')),prompt=new PromptView($('promptStage'));
let armMode=false,personalMode=false;
let stage=new ForestStage(),detector=new MotionDetector(),last=null,paused=false,miss=false,poseTime=0;
function input(){const f=neutral(),e=stage.currentEvent(),beat=Math.floor(stage.time/250)%2;if(!miss){if(e?.type==='RUN'){f.leftLift=beat?(personalMode?.008:armMode?.009:.03):0;f.rightLift=beat?0:(armMode?.009:.03);if(armMode)Object.assign(f,{armsVisible:true,armDifference:beat?.12:-.12,playerX:.19,playerShoulderX:.19});}
 if(e&&e.type!=='RUN'&&stage.time>=e.activeStart&&stage.time<e.activeStart+600)Object.assign(f,({JUMP:{hipRise:.14,shoulderRise:.14},CROUCH:{hipRise:-.12,shoulderRise:-.1},DODGE_LEFT:{playerX:-.22,playerShoulderX:-.2},DODGE_RIGHT:{playerX:.22,playerShoulderX:.2}})[e.type]);}return f;}
function step(){stage.advance(40);poseTime+=40;stage.observe(detector.update(input(),poseTime,true,{runRequested:stage.currentEvent()?.type==='RUN'}),40);stage.drainNotices();}
function reset(fail=false,assist=false,personal=false){personalMode=personal;armMode=assist;stage=new ForestStage();detector=new MotionDetector();if(personal){const c=new RunCalibration();let p;for(let t=0;t<=5040;t+=40){const beat=Math.floor(t/250)%2;p=c.observe({...neutral(),leftLift:beat?.008:0,rightLift:beat?0:.008},t);}detector.setRunProfile(p);}
 paused=false;miss=fail;poseTime=0;accumulator=0;view.reset();last=null;$('pause').textContent='暫停';$('previewReport').textContent='';}
function frame(now){drawTrackingOverlay($('previewCross'),{dataset:{},style:{}},{landmarks:null,tracked:false,enabled:false});const dt=last===null?0:Math.min(100,now-last);last=now;if(!paused&&!stage.finished){accumulator+=dt;while(accumulator>=40){step();accumulator-=40;}}
 const snap=stage.snapshot();view.update(snap,now);prompt.update(snap,false);$('previewStatus').textContent=`${paused?"手動暫停 · ":""}合成姿勢 25 Hz · 遊戲時鐘 ${(stage.time/1000).toFixed(1)} / ${stage.duration/1000} 秒 · Scene ${view.fps.toFixed(1)} FPS · Canvas ${view.lastCost.toFixed(2)}ms · 本頁不使用 Webcam。`;
 if(stage.finished)$('previewReport').textContent=forestReportText(stage.report()).replace('森林試玩紀錄（本局實際偵測，不含合成預覽）','合成動作整局結果（非真人成功率；Pose FPS 尚無資料）');requestAnimationFrame(frame);}
let accumulator=0;
$('replay').onclick=()=>reset();$('miss').onclick=()=>reset(true);$('pause').onclick=()=>{paused=!paused;stage.pause(paused);$('pause').textContent=paused?'繼續':'暫停';};
$('crate').onclick=()=>{reset();for(let i=0;i<175;i++)step();paused=true;stage.pause();$('pause').textContent='繼續';};
$('finish').onclick=()=>{reset(miss,armMode,personalMode);for(let i=0;i<stage.duration/40;i++)step();};requestAnimationFrame(frame);

$('jumpSuccess').onclick=()=>{reset();for(let i=0;i<190;i++)step();paused=true;stage.pause();$('pause').textContent='繼續';};

$('armTest').onclick=()=>reset(false,true);

$('rhythmTest').onclick=()=>reset(false,false,true);
