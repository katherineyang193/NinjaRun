import {ForestStage} from '../game/ForestStage.js?v=sync9';
import {ForestView} from '../ui/ForestView.js?v=sync9';
import {PromptView} from '../ui/PromptView.js?v=sync9';
import {MotionDetector} from '../motion/MotionDetector.js?v=sync9';
import {neutral} from './self-test.js?v=body3';
import {forestReportText} from '../ui/StageReport.js?v=sync9';
const $=id=>document.getElementById(id),view=new ForestView($('forestScene')),prompt=new PromptView($('promptStage'));
let stage=new ForestStage(),detector=new MotionDetector(),last=null,paused=false,miss=false,poseTime=0;
function input(){const f=neutral(),e=stage.currentEvent(),beat=Math.floor(stage.time/250)%2;if(!miss){if(e?.type==='RUN'){f.leftLift=beat?.03:0;f.rightLift=beat?0:.03;}
 if(e&&e.type!=='RUN'&&stage.time>=e.activeStart&&stage.time<e.activeStart+600)Object.assign(f,({JUMP:{hipRise:.14,shoulderRise:.14},CROUCH:{hipRise:-.12,shoulderRise:-.1},DODGE_LEFT:{playerX:-.22,playerShoulderX:-.2},DODGE_RIGHT:{playerX:.22,playerShoulderX:.2}})[e.type]);}return f;}
function step(){stage.advance(40);poseTime+=40;stage.observe(detector.update(input(),poseTime,true),40);stage.drainNotices();}
function reset(fail=false){stage=new ForestStage();detector=new MotionDetector();paused=false;miss=fail;poseTime=0;accumulator=0;view.reset();last=null;$('pause').textContent='暫停';$('previewReport').textContent='';}
function frame(now){const dt=last===null?0:Math.min(100,now-last);last=now;if(!paused&&!stage.finished){accumulator+=dt;while(accumulator>=40){step();accumulator-=40;}}
 const snap=stage.snapshot();view.update(snap,now);prompt.update(snap,false);$('previewStatus').textContent=`${paused?"手動暫停 · ":""}合成姿勢 25 Hz · 遊戲時鐘 ${(stage.time/1000).toFixed(1)} / ${stage.duration/1000} 秒 · Scene ${view.fps.toFixed(1)} FPS · Canvas ${view.lastCost.toFixed(2)}ms · 本頁不使用 Webcam。`;
 if(stage.finished)$('previewReport').textContent=forestReportText(stage.report()).replace('森林試玩紀錄（本局實際偵測，不含合成預覽）','合成動作整局結果（非真人成功率；Pose FPS 尚無資料）');requestAnimationFrame(frame);}
let accumulator=0;
$('replay').onclick=()=>reset();$('miss').onclick=()=>reset(true);$('pause').onclick=()=>{paused=!paused;stage.pause(paused);$('pause').textContent=paused?'繼續':'暫停';};
$('crate').onclick=()=>{reset();for(let i=0;i<175;i++)step();paused=true;stage.pause();$('pause').textContent='繼續';};
$('finish').onclick=()=>{reset(miss);for(let i=0;i<stage.duration/40;i++)step();};requestAnimationFrame(frame);

$('jumpSuccess').onclick=()=>{reset();for(let i=0;i<190;i++)step();paused=true;stage.pause();$('pause').textContent='繼續';};
