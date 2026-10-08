import {CameraManager,cameraErrorMessage} from './camera/CameraManager.js';
import {PoseManager} from './pose/PoseManager.js';
import {SettingsManager} from './settings/SettingsManager.js';
import {MirrorController} from './motion/MirrorController.js';
import {CalibrationManager} from './motion/CalibrationManager.js';
import {PlayerCoordinateMapper} from './motion/PlayerCoordinateMapper.js';
import {TrackingManager} from './motion/TrackingManager.js';
import {MotionDetector} from './motion/MotionDetector.js';
import {poseFeatures} from './motion/pose-features.js';
import {AudioManager} from './audio/AudioManager.js';
import {runSelfTest} from './dev/self-test.js';
const $=id=>document.getElementById(id);
const settings=new SettingsManager(),mirror=new MirrorController(settings),calibration=new CalibrationManager();
const tracking=new TrackingManager(),detector=new MotionDetector(settings.value),audio=new AudioManager(settings);
let phase='HOME',epoch=0,device={},aspect=4/3,baseline=null,mapper=null,landmarks=null,features=null;
let lastPoseTime=-Infinity,lastRenderTime=null,countdownAt=null,lastCount=null,trackingPaused=true;
let elapsed=0,runTime=0,counters={},recent={},lastUI=0,renderFps=0,completions=0,feedbackTimer=null;
const names={RUN:'RUN ✓',JUMP:'JUMP ✓',CROUCH:'CROUCH ✓',DODGE_LEFT:'LEFT ✓',DODGE_RIGHT:'RIGHT ✓'};
const states={CENTER:'再試試五個招式！',RUNNING:'跑起來了！',JUMPING:'跳得好！',CROUCHING:'蹲下成功！',DODGE_LEFT:'左閃成功！ ←',DODGE_RIGHT:'右閃成功！ →',LOST_TRACKING:'回到框框裡～'};
const camera=new CameraManager($('cameraVideo'),{onEnded:()=>fail('鏡頭已中斷，請確認連接後重新開始。')});
const pose=new PoseManager({onResult:processPose,onError:()=>fail('動作小幫手暫時中斷，請重新開始。'),onStatus:text=>{if(phase==='LOADING')message(text,'第一次載入需要一點時間，請稍等。');}});
let motion={state:'CENTER',runState:'IDLE',runIntensity:0,events:[]};
function message(main,detail=''){if($('mainMessage').textContent!==main)$('mainMessage').textContent=main;$('detailMessage').textContent=detail;}
function applySettings(){mirror.apply($('cameraVideo'));$('homeLink').href=settings.value.gameHomeUrl;
  detector.jumpEnabled=settings.value.jumpEnabled;$('jumpHelp').textContent=settings.value.jumpEnabled?'輕輕跳，身體一起往上':'家長已關閉跳躍，練習其他四招';
  document.querySelector('[data-action="JUMP"]').classList.toggle('disabled',!settings.value.jumpEnabled);
}
function release(){epoch++;camera.stop();pose.close();tracking.reset();detector.lost();trackingPaused=true;landmarks=null;features=null;baseline=null;mapper=null;countdownAt=null;
  $('cameraBox').hidden=true;$('cameraStatus').textContent='● CAMERA OFF';$('stopBtn').hidden=true;$('recalibrateBtn').hidden=true;$('startBtn').hidden=false;$('startBtn').disabled=false;
  $('dojo').classList.remove('calibrating');motion={state:'CENTER',runState:'IDLE',runIntensity:0,events:[]};}
function fail(text){release();phase='ERROR';$('phaseLabel').textContent='LET’S TRY AGAIN';message(text,'準備好後，再按一次開啟鏡頭。');$('startBtn').textContent='再試一次開啟鏡頭 →';}
async function start(){
  release();const token=epoch;phase='LOADING';elapsed=0;runTime=0;recent={};counters={RUN:0,JUMP:0,CROUCH:0,DODGE_LEFT:0,DODGE_RIGHT:0};
  $('summary').hidden=true;$('startBtn').hidden=true;$('stopBtn').hidden=false;$('phaseLabel').textContent='LET’S GET READY';message('正在開啟鏡頭…','瀏覽器會詢問相機權限。');
  await audio.unlock();if(token!==epoch)return;
  let loadingTimer;
  try{
    device=await camera.start();if(token!==epoch)return;
    aspect=($('cameraVideo').videoWidth||640)/($('cameraVideo').videoHeight||480);
    $('cameraBox').hidden=false;$('cameraStatus').textContent='● CAMERA ON';$('dojo').classList.add('calibrating');applySettings();
    await Promise.race([pose.initialize(),new Promise((_,reject)=>{loadingTimer=setTimeout(()=>reject(new Error('model timeout')),60000);})]);
    if(token!==epoch)return;
    calibration.reset(settings.calibrationFor(device.deviceId??'',aspect));tracking.reset();phase='CALIBRATION';
    $('recalibrateBtn').hidden=false;message('站在框框裡，讓我看看你','請面向鏡頭，留出左右移動的空間。');
    pose.start($('cameraVideo'));lastPoseTime=performance.now();
  }catch(error){if(token!==epoch)return;fail(camera.active?'動作小幫手載入失敗，請檢查網路後再試。':cameraErrorMessage(error));}
  finally{clearTimeout(loadingTimer);}
}
function recalibrate(){
  if(!camera.active)return;
  settings.update({calibration:null});calibration.reset();baseline=null;mapper=null;countdownAt=null;tracking.reset();detector.reset();phase='CALIBRATION';
  $('dojo').classList.add('calibrating');applySettings();message('站在框框裡，重新看看你的左右','請面向鏡頭。');
}
function processPose(lm,now){
  lastPoseTime=performance.now();landmarks=lm;features=poseFeatures(lm,aspect);
  const result=tracking.update(features,now);trackingPaused=result.paused;
  $('trackingStatus').textContent=result.message;
  if(trackingPaused){motion=detector.lost();countdownAt=null;
    if(phase==='CALIBRATION')calibration.update(null,now);
    if(phase==='PLAYING'||phase==='COUNTDOWN'||phase==='CALIBRATION')message('回到框框裡～','找到你的身體就會繼續，不會扣分。');return;}
  if(phase==='CALIBRATION'){
    const result=calibration.update(features,now);message(result.message,'左右都以你自己為準，跟著文字做就好。');
    if(result.phase==='READY'){
      baseline=result.baseline;mapper=new PlayerCoordinateMapper(result.direction);
      settings.update({calibration:{...result.direction,deviceId:device.deviceId??'',aspect}});
      applySettings();
      phase='COUNTDOWN';countdownAt=performance.now();lastCount=null;
    }
  }else if(phase==='COUNTDOWN'){
    // Re-acquire a fresh standing average if the player moved before the countdown ends.
    const f=mapper.map(features,baseline);
    if(Math.abs(f.playerX)>.065||Math.abs(f.hipRise)>.05||Math.abs(f.shoulderRise)>.065){
      calibration.reset(calibration.direction);phase='CALIBRATION';countdownAt=null;message('回到中央站穩，準備出發！');
    }
  }else if(phase==='PLAYING'){
    motion=detector.update(mapper.map(features,baseline),now,true);
    message(states[motion.state]??'再試試五個招式！',motion.state==='CENTER'?'原地跑、蹲下，或往自己的左右閃一下。':'做得很好！閃完先回中央，再試下一招。');
    for(const action of motion.events){counters[action]++;recent[action]=performance.now()+850;
      audio.play(action);$('feedback').textContent=names[action]+' ✦';$('feedback').classList.remove('pop');void $('feedback').offsetWidth;$('feedback').classList.add('pop');
      clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>{$('feedback').textContent='';},650);}
  }
}
function finish(){const report={...counters,elapsed,runTime};release();phase='FINISHED';completions++;
  $('summary').hidden=false;$('summaryText').textContent=`動動時間 ${Math.round(report.elapsed)} 秒　·　跑動 ${Math.round(report.runTime)} 秒　·　跳躍 ${report.JUMP} 次　·　蹲下 ${report.CROUCH} 次　·　閃避 ${report.DODGE_LEFT+report.DODGE_RIGHT} 次。超級有活力！`;
  audio.play('finish');message('動作練習完成！','準備好了，就可以再練一次。');$('phaseLabel').textContent='NICE MOVES, NINJA!';
  if(completions>=3){phase='REST';message('休息一下，喝口水！','休息好了，按下面的按鈕再繼續。');$('startBtn').hidden=true;$('continueBtn').hidden=false;}
}
function drawSkeleton(){
  const canvas=$('skeleton'),ctx=canvas.getContext('2d');const width=$('cameraVideo').clientWidth,height=$('cameraVideo').clientHeight;
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}ctx.clearRect(0,0,width,height);
  if(!$('skeletonToggle').checked||!landmarks||trackingPaused)return;
  const videoAspect=$('cameraVideo').videoWidth/$('cameraVideo').videoHeight;
  const fittedWidth=Math.min(width,height*videoAspect),fittedHeight=fittedWidth/videoAspect;
  const pt=p=>[(width-fittedWidth)/2+(mirror.displayMirrored?1-p.x:p.x)*fittedWidth,(height-fittedHeight)/2+p.y*fittedHeight];
  ctx.strokeStyle='#ffe09c';ctx.fillStyle='#ffe09c';ctx.lineWidth=2;
  for(const [a,b] of [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]]){
    if((landmarks[a].visibility??0)<.5||(landmarks[b].visibility??0)<.5)continue;ctx.beginPath();ctx.moveTo(...pt(landmarks[a]));ctx.lineTo(...pt(landmarks[b]));ctx.stroke();}
  for(const p of landmarks){if((p.visibility??0)<.5)continue;ctx.beginPath();ctx.arc(...pt(p),2.5,0,Math.PI*2);ctx.fill();}
}
function frame(now){
  const dt=lastRenderTime===null?0:Math.min(.1,(now-lastRenderTime)/1000);if(dt>0)renderFps=renderFps*.9+.1/dt;lastRenderTime=now;
  if(['PLAYING','COUNTDOWN','CALIBRATION'].includes(phase)&&now-lastPoseTime>450){
    if(!trackingPaused){trackingPaused=true;motion=detector.lost();tracking.reset();countdownAt=null;if(phase==='CALIBRATION')calibration.update(null,now);}
    $('trackingStatus').textContent='回到框框裡～';message('回到框框裡～','找到你的身體就會繼續，不會扣分。');
  }
  if(phase==='COUNTDOWN'&&!trackingPaused){countdownAt??=now;const n=3-Math.floor((now-countdownAt)/1000);
    if(n>0){message(String(n),'站穩，準備出發！');if(lastCount!==n){audio.play('count');lastCount=n;}}
    else {phase='PLAYING';$('dojo').classList.remove('calibrating');detector.reset();$('phaseLabel').textContent='MOVE LIKE A NINJA';}}
  if(phase==='PLAYING'&&!trackingPaused&&!document.hidden){elapsed+=dt;if(motion.runState==='RUNNING')runTime+=dt;if(elapsed>=settings.value.duration)finish();}
  if(now-lastUI>100){lastUI=now;$('sessionClock').textContent=phase==='PLAYING'?`${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')} / ${settings.value.duration/60}:00`:phase==='LOADING'?'正在準備…':phase==='CALIBRATION'?'左右校正':phase==='COUNTDOWN'?'準備出發':phase==='FINISHED'||phase==='REST'?'練習完成':'準備出發';
    for(const action of Object.keys(names)){const active=phase==='PLAYING'&&!trackingPaused&&((recent[action]??0)>now||(action==='RUN'&&motion.state==='RUNNING')||(action==='CROUCH'&&motion.state==='CROUCHING')||motion.state===action);
      document.querySelector(`[data-action="${action}"]`).classList.toggle('active',active);$('count'+action).textContent=active?'✓':(counters[action]||'—');}
    $('runMeter').value=motion.runIntensity;$('runLabel').textContent=motion.runState==='RUNNING'?'跑起來了 ✓':'等你跑起來';
    document.querySelector('.ninja-zone').dataset.state=trackingPaused?'CENTER':motion.state;
    $('cameraOverlay').textContent=phase==='PLAYING'?(trackingPaused?'回到框框裡～':'你的左 ←　→ 你的右'):$('mainMessage').textContent;
    if(!$('debugPanel').hidden){const v=x=>Number.isFinite(x)?x.toFixed(3):'—';$('debugValues').textContent=[
      `Render FPS: ${renderFps.toFixed(1)}   Pose FPS: ${pose.fps.toFixed(1)}   Engine: ${pose.mode}`,
      pose.fallbackReason?`Worker fallback: ${pose.fallbackReason}`:'',
      `Pose confidence: ${v(features?.confidence)}   Hip X: ${v(features?.hipX)}   Hip Y: ${v(features?.hipY)}`,
      `baseline X: ${v(baseline?.baselineHipX)}   baseline Y: ${v(baseline?.baselineHipY)}   average frames: ${baseline?.frames??0}`,
      `motionState: ${motion.state}   runState: ${motion.runState}   runIntensity: ${v(motion.runIntensity)}`,
      `mirrorMode: ${settings.value.mirrorMode}   displayMirrored: ${mirror.displayMirrored}   mirrorDirection: ${mirror.mirrorDirection??'uncalibrated'}`,
      `Player right raw sign: ${mapper?.calibration.playerRightSign??'—'}   Player X: ${v(motion.features?.playerX)}`,
      `trackingState: ${trackingPaused?'LOST_TRACKING':'TRACKING'}   phase: ${phase}`,
      Object.keys(names).map(a=>`${a}: ${counters[a]??0}`).join('   '),settings.warning].filter(Boolean).join('\n');}
    drawSkeleton();
  }
  requestAnimationFrame(frame);
}
$('startBtn').addEventListener('click',start);$('stopBtn').addEventListener('click',()=>{release();phase='HOME';message('休息一下，準備好再出發！');});$('recalibrateBtn').addEventListener('click',recalibrate);
$('continueBtn').addEventListener('click',()=>{completions=0;$('continueBtn').hidden=true;$('startBtn').hidden=false;phase='HOME';message('準備好，再動一動！');});
$('debugToggle').addEventListener('click',()=>{const hidden=!$('debugPanel').hidden;$('debugPanel').hidden=hidden;$('debugToggle').setAttribute('aria-expanded',String(!hidden));});
$('selfTestBtn').addEventListener('click',()=>{const results=runSelfTest();$('selfTestResult').textContent=results.map(r=>`${names[r.action]} ${r.pass?'通過':'失敗'}`).join('　');});
$('modelTestBtn').addEventListener('click',async()=>{
  if(camera.active||phase==='LOADING'){$('selfTestResult').textContent='鏡頭已在使用動作模型，請先結束練習。';return;}
  const token=epoch;$('modelTestBtn').disabled=true;$('startBtn').disabled=true;$('selfTestResult').textContent='正在檢查 Pose 模型…';
  let timer;try{await Promise.race([pose.initialize(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),60000);})]);
    const probe=document.createElement('canvas');probe.width=64;probe.height=64;probe.getContext('2d').fillRect(0,0,64,64);
    await pose.probe(probe);
    if(token===epoch)$('selfTestResult').textContent=`Pose 模型載入與推論成功 ✓ · ${pose.mode}（空白測試影格）`;
  }catch{if(token===epoch)$('selfTestResult').textContent='Pose 模型載入或推論失敗，請檢查 CDN／模型網址是否可連線。';}
  finally{clearTimeout(timer);pose.close();$('modelTestBtn').disabled=false;$('startBtn').disabled=false;}
});
$('settingsBtn').addEventListener('click',()=>{for(const key of ['mirrorMode','difficulty','duration','gameHomeUrl'])$(key).value=settings.value[key];
  for(const key of ['jumpEnabled','sound','music','rememberCalibration'])$(key).checked=settings.value[key];$('settingsWarning').textContent=settings.warning;$('settingsDialog').showModal();});
$('saveSettings').addEventListener('click',()=>{const patch={};for(const key of ['mirrorMode','difficulty','duration','gameHomeUrl'])patch[key]=$(key).value;
  for(const key of ['jumpEnabled','sound','rememberCalibration'])patch[key]=$(key).checked;settings.update(patch);applySettings();});
$('clearCalibration').addEventListener('click',()=>{settings.update({calibration:null});if(camera.active)recalibrate();$('settingsWarning').textContent='左右校正已清除，下次開始會重新確認。';});
document.addEventListener('visibilitychange',()=>{lastRenderTime=null;if(document.hidden){pose.stop();trackingPaused=true;tracking.reset();motion=detector.lost();}
  else if(camera.active&&['CALIBRATION','COUNTDOWN','PLAYING'].includes(phase)){lastPoseTime=performance.now();countdownAt=null;pose.start($('cameraVideo'));}});
globalThis.addEventListener('pagehide',()=>{release();audio.close();});
applySettings();requestAnimationFrame(frame);
