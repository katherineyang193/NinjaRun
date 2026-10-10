import {CameraManager,cameraErrorMessage} from './camera/CameraManager.js';
import {PoseManager} from './pose/PoseManager.js';
import {SettingsManager} from './settings/SettingsManager.js?v=prompt1';
import {MirrorController} from './motion/MirrorController.js';
import {CalibrationManager} from './motion/CalibrationManager.js';
import {PlayerCoordinateMapper} from './motion/PlayerCoordinateMapper.js?v=body3';
import {TrackingManager} from './motion/TrackingManager.js';
import {MotionDetector} from './motion/MotionDetector.js?v=body3';
import {MotionProgress} from './motion/MotionProgress.js';
import {poseFeatures} from './motion/pose-features.js?v=body3';
import {AudioManager} from './audio/AudioManager.js?v=run4';
import {runSelfTest} from './dev/self-test.js?v=body3';
import {bodyTrackable,drawTrackingOverlay} from './ui/TrackingOverlay.js?v=body3';
import {PromptSequence} from './game/PromptSequence.js?v=run2';
import {PromptView} from './ui/PromptView.js?v=run4';
import {ForestStage} from './game/ForestStage.js?v=run4';
import {forestDebugText,forestReportText} from './ui/StageReport.js';
import {ForestView} from './ui/ForestView.js?v=run4';
const $=id=>document.getElementById(id);
const settings=new SettingsManager(),mirror=new MirrorController(settings),calibration=new CalibrationManager();
const tracking=new TrackingManager(),detector=new MotionDetector(settings.value),audio=new AudioManager(settings);
const progress=new MotionProgress();
const promptView=new PromptView($('promptStage'));
const forestView=new ForestView($('forestScene'));
let forest=null,lastForestReport=null;
let playMode='forest',sequence=null,lastMotionTime=null,lastPromptState=null;
let phase='HOME',epoch=0,device={},aspect=4/3,baseline=null,mapper=null,landmarks=null,features=null;
let lastPoseTime=-Infinity,lastRenderTime=null,countdownAt=null,lastCount=null,trackingPaused=true;
let elapsed=0,runTime=0,recent={},lastUI=0,renderFps=0,completions=0,feedbackTimer=null;
const names={RUN:'RUN ✓',JUMP:'JUMP ✓',CROUCH:'CROUCH ✓',DODGE_LEFT:'LEFT ✓',DODGE_RIGHT:'RIGHT ✓'};
const actionLabels={RUN:'原地跑',JUMP:'跳躍',CROUCH:'蹲下',DODGE_LEFT:'左閃',DODGE_RIGHT:'右閃'};
const phaseLabels={HOME:'首頁',LOADING:'開啟鏡頭／載入模型',CALIBRATION:'站位與左右校正',COUNTDOWN:'出發倒數',PLAYING:'動作練習中',FINISHED:'練習完成',REST:'休息時間',ERROR:'等待重試'};
const states={CENTER:'再試試五個招式！',RUNNING:'跑起來了！',JUMPING:'跳得好！',CROUCHING:'蹲下成功！',DODGE_LEFT:'左閃成功！ ←',DODGE_RIGHT:'右閃成功！ →',LOST_TRACKING:'回到框框裡～'};
const camera=new CameraManager($('cameraVideo'),{onEnded:()=>fail('鏡頭已中斷，請確認連接後重新開始。')});
const pose=new PoseManager({onResult:processPose,onError:()=>fail('動作小幫手暫時中斷，請重新開始。'),onStatus:text=>{if(phase==='LOADING')message(text,'第一次載入需要一點時間，請稍等。');}});
let motion={state:'CENTER',runState:'IDLE',runIntensity:0,events:[]};
function message(main,detail=''){if($('mainMessage').textContent!==main)$('mainMessage').textContent=main;$('detailMessage').textContent=detail;}
function applySettings(){forest?.setJumpEnabled(settings.value.jumpEnabled);document.body.dataset.promptSize=settings.value.promptSize;mirror.apply($('cameraVideo'));$('homeLink').href=settings.value.gameHomeUrl;
  detector.jumpEnabled=settings.value.jumpEnabled;$('jumpHelp').textContent=settings.value.jumpEnabled?'輕輕跳，身體一起往上':'家長已關閉跳躍，練習其他四招';
  document.querySelector('[data-action="JUMP"]').classList.toggle('disabled',!settings.value.jumpEnabled);
}
function release(){$('forestScene').hidden=true;$('guidedBtn').hidden=false;forest?.pause();$('freeBtn').hidden=false;$('promptStage').hidden=true;document.body.dataset.mode='';epoch++;camera.stop();pose.close();tracking.reset();detector.lost();trackingPaused=true;landmarks=null;features=null;baseline=null;mapper=null;countdownAt=null;
  $('cameraBox').hidden=true;$('cameraStatus').textContent='● CAMERA OFF';$('trackingStatus').textContent='等待身體';$('safeZone').dataset.tracking='invalid';$('stopBtn').hidden=true;$('recalibrateBtn').hidden=true;$('startBtn').hidden=false;$('startBtn').disabled=false;
  $('dojo').classList.remove('calibrating');motion={state:'CENTER',runState:'IDLE',runIntensity:0,events:[]};}
function fail(text){release();phase='ERROR';$('phaseLabel').textContent='LET’S TRY AGAIN';message(text,'準備好後，再按一次開啟鏡頭。');$('startBtn').textContent='再試一次開啟鏡頭 →';}
async function start(mode='forest'){playMode=mode;
  release();$('guidedBtn').hidden=true;$('freeBtn').hidden=true;forest=playMode==='forest'?new ForestStage(settings.value):null;forestView.reset();lastForestReport=null;$('stageReport').hidden=true;sequence=new PromptSequence(settings.value);lastMotionTime=null;lastPromptState=null;const token=epoch;phase='LOADING';elapsed=0;runTime=0;recent={};progress.reset();
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
  if(!camera.active)return;document.body.dataset.mode='';$('forestScene').hidden=true;$('promptStage').hidden=true;forest?.pause();lastMotionTime=null;
  settings.update({calibration:null});calibration.reset();baseline=null;mapper=null;countdownAt=null;tracking.reset();detector.reset();phase='CALIBRATION';
  $('dojo').classList.add('calibrating');applySettings();message('站在框框裡，重新看看你的左右','請面向鏡頭。');
}
function processPose(lm,now){
  lastPoseTime=performance.now();landmarks=lm;features=poseFeatures(lm,aspect,{allowLowerBodyMissing:phase==='PLAYING'});
  const result=tracking.update(bodyTrackable(lm,phase==='PLAYING')?features:null,now);trackingPaused=result.paused;
  $('trackingStatus').textContent=result.message;
  if(trackingPaused){forest?.pause();lastMotionTime=null;if(sequence){sequence.runHeld=0;sequence.runGap=0;}motion=detector.lost();countdownAt=null;
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
    if($('settingsDialog').open){forest?.pause();lastMotionTime=null;return;}
    motion=detector.update(mapper.map(features,baseline),now,true);
    progress.record(motion.events);
    if(playMode==='forest'){forest.pause(false);const gap=lastMotionTime===null?0:now-lastMotionTime;lastMotionTime=now;forest.observe(motion,gap);forestFeedback();promptView.update(forest.snapshot(),false);}
    if(playMode==='guided'){const gap=lastMotionTime===null?0:Math.min(120,now-lastMotionTime);lastMotionTime=now;if(sequence.observe(motion,gap))audio.play('success');promptView.update(sequence.snapshot(),false);}
    const achievement=progress.snapshot(settings.value.jumpEnabled);
    message(motion.state==='CENTER'?(achievement.allCompleted?'每一招都完成了！ ✦':'回到中央了，準備下一招！'):(states[motion.state]??'再試試忍者招式！'),
      motion.state==='CENTER'?'成功的勾勾會保留，可以繼續累積次數。':'做得很好！閃完先回中央，再試下一招。');
    for(const action of motion.events){recent[action]=performance.now()+850;if(playMode==='forest')continue;
      audio.play(action);$('feedback').textContent=names[action]+' ✦';$('feedback').classList.remove('pop');void $('feedback').offsetWidth;$('feedback').classList.add('pop');
      clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>{$('feedback').textContent='';},650);}
  }
}
function forestFeedback(){for(const n of forest.drainNotices()){if(n.result==='SUCCESS')audio.play(n.type);else if(n.result==='STAR')audio.play('star');else if(n.result==='HIT')audio.play('softHit');}}
function finish(){if(playMode==='forest'){lastForestReport=forest.report();$('stageReport').hidden=false;$('stageReport').textContent=forestReportText(lastForestReport);}
const promptReport=playMode==='guided'?sequence.report():null;const report={...progress.counts,elapsed,runTime};release();phase='FINISHED';completions++;
  $('summary').hidden=false;$('summary').querySelector('h2').textContent=lastForestReport?'森林冒險完成！ ✦':'動作練習完成！ ✦';$('summaryText').textContent=`動動時間 ${Math.round(report.elapsed)} 秒　·　跑動 ${Math.round(report.runTime)} 秒　·　跳躍 ${report.JUMP} 次　·　蹲下 ${report.CROUCH} 次　·　閃避 ${report.DODGE_LEFT+report.DODGE_RIGHT} 次。超級有活力！`;
  if(promptReport)$('summaryText').textContent+=' 提示挑戰：'+promptReport.map(r=>`${actionLabels[r.action]} ${r.successes}/${r.attempts}（${r.rate===null?'未出題':r.rate+'%'}）`).join(' · ')+`；最高 Combo ${sequence.bestCombo}。`;
  if(lastForestReport)$('summaryText').textContent=`森林冒險完成！ ${Math.round(lastForestReport.durationSeconds)} 秒 · Score ${lastForestReport.score} · 星星 ${lastForestReport.stars} · 活力值 ${lastForestReport.energy} · 跑動 ${lastForestReport.runSeconds.toFixed(1)} 秒 · 最高 Combo ${lastForestReport.bestCombo}。`+' 動作成功率：'+lastForestReport.actions.map(r=>`${actionLabels[r.action]} ${r.successes}/${r.attempts}（${r.rate===null?'未出題':r.rate+'%'}）`).join(' · ');
  audio.play('finish');message(lastForestReport?'森林冒險完成！':'動作練習完成！','準備好了，就可以再練一次。');$('phaseLabel').textContent='NICE MOVES, NINJA!';
  if(completions>=3){phase='REST';message('休息一下，喝口水！','休息好了，按下面的按鈕再繼續。');$('startBtn').hidden=true;$('guidedBtn').hidden=true;$('freeBtn').hidden=true;$('continueBtn').hidden=false;}
}
function drawSkeleton(){
  if($('cameraBox').hidden)return;
  drawTrackingOverlay($('skeleton'),$('safeZone'),{landmarks,tracked:!trackingPaused,fresh:camera.active&&performance.now()-lastPoseTime<=450,mirrored:mirror.displayMirrored,aspect,enabled:$('skeletonToggle').checked,allowLowerBodyMissing:phase==='PLAYING'});
  $('frameStatus').textContent=trackingPaused?'◇ 請讓頭、肩膀和髖部入鏡':features?.lowerBodyVisible===false?'✓ 身體已找到，蹲下也看得到':'✓ 已辨識到身體';
}
function frame(now){
  const rawDt=lastRenderTime===null?0:(now-lastRenderTime)/1000,dt=Math.min(.1,rawDt);if(rawDt>0)renderFps=renderFps*.9+.1/rawDt;lastRenderTime=now;
  if(['PLAYING','COUNTDOWN','CALIBRATION'].includes(phase)&&now-lastPoseTime>450){
    if(!trackingPaused){trackingPaused=true;forest?.pause();lastMotionTime=null;if(sequence)sequence.runHeld=0;motion=detector.lost();tracking.reset();countdownAt=null;if(phase==='CALIBRATION')calibration.update(null,now);}
    $('trackingStatus').textContent='回到框框裡～';message('回到框框裡～','找到你的身體就會繼續，不會扣分。');
  }
  if(phase==='COUNTDOWN'&&!trackingPaused){countdownAt??=now;const n=3-Math.floor((now-countdownAt)/1000);
    if(n>0){message(String(n),'站穩，準備出發！');if(lastCount!==n){audio.play('count');lastCount=n;}}
    else {phase='PLAYING';$('dojo').classList.remove('calibrating');detector.reset();document.body.dataset.mode=playMode;$('promptStage').hidden=playMode==='free';$('forestScene').hidden=playMode!=='forest';forest?.pause(false);$('phaseLabel').textContent='MOVE LIKE A NINJA';}}
  if(phase==='PLAYING'&&!trackingPaused&&!document.hidden&&!$('settingsDialog').open){if(playMode==='forest'){forest.pause(false);forest.advance(dt*1000);elapsed=forest.time/1000;forestFeedback();}else elapsed+=dt;if(motion.runState==='RUNNING')runTime+=dt;if(playMode==='guided'){sequence.advance(dt*1000);const snap=sequence.snapshot();if(snap.promptState==='ACTIVE'&&lastPromptState!=='ACTIVE')audio.play('count');lastPromptState=snap.promptState;promptView.update(snap,false);if(snap.promptState==='FINISHED')finish();}else if(playMode==='forest'){promptView.update(forest.snapshot(),false);const snap=forest.snapshot(),key=`${snap.event?.id}:${snap.promptState}`;if(snap.promptState==='ACTIVE'&&key!==lastPromptState)audio.play('count');lastPromptState=key;if(forest.finished)finish();}else if(elapsed>=settings.value.duration)finish();}
  if(phase==='PLAYING'&&playMode==='guided')promptView.update(sequence.snapshot(),trackingPaused);
  if(phase==='PLAYING'&&playMode==='forest'){forest.pause(trackingPaused||document.hidden||$('settingsDialog').open);const snap=forest.snapshot();promptView.update(snap,trackingPaused||document.hidden||$('settingsDialog').open);forestView.update(snap,now,pose.fps);}
  if(now-lastUI>100){if(phase==='PLAYING'&&playMode==='forest')forest.notePerformance(pose.fps,renderFps);lastUI=now;document.body.dataset.phase=phase;$('sessionClock').textContent=phase==='PLAYING'?`${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')} / ${playMode==='forest'?'2:00':playMode==='guided'?'1:04':settings.value.duration/60+':00'}`:phase==='LOADING'?'正在準備…':phase==='CALIBRATION'?'左右校正':phase==='COUNTDOWN'?'準備出發':phase==='FINISHED'||phase==='REST'?'練習完成':'準備出發';
    for(const action of Object.keys(names)){const active=phase==='PLAYING'&&!trackingPaused&&((recent[action]??0)>now||(action==='RUN'&&motion.state==='RUNNING')||(action==='CROUCH'&&motion.state==='CROUCHING')||motion.state===action);
      const card=document.querySelector(`[data-action="${action}"]`),count=progress.counts[action];
      card.classList.toggle('active',active);card.classList.toggle('completed',count>0);
      $('count'+action).textContent=count>0?`✓ ${count} 次`:'尚未完成';
      $('status'+action).textContent=action==='JUMP'&&!settings.value.jumpEnabled?'已關閉跳躍':active?'● 正在做':count>0?'✓ 已完成':'等你出招';}
    const achievement=progress.snapshot(settings.value.jumpEnabled);
    $('practiceProgress').textContent=`已完成 ${achievement.completed} / ${achievement.total} 招${achievement.allCompleted?' ✓':''}`;
    $('lastSuccess').textContent=achievement.lastAction?`上一招：${actionLabels[achievement.lastAction]} ✓（已保留）`:'成功勾勾會保留';
    $('runMeter').value=motion.runIntensity;$('runLabel').textContent=motion.runState==='RUNNING'?'跑起來了 ✓':motion.stepCount>0?`踏步 ${motion.stepCount}／3 · 繼續左右交替`:'左右腳小步踏起來';
    document.querySelector('.ninja-zone').dataset.state=trackingPaused?'CENTER':motion.state;
    if(!$('debugPanel').hidden){$('debugSummary').textContent=`流程：${phaseLabels[phase]}　｜　身體：${camera.active?(trackingPaused?'暫時沒看到，等待站回框內':'正在追蹤'):'鏡頭尚未開啟'}　｜　動作辨識：${pose.fps.toFixed(1)} 次／秒`;
      const v=x=>Number.isFinite(x)?x.toFixed(3):'—';$('debugValues').textContent=[
      `Render FPS: ${renderFps.toFixed(1)}   Pose FPS: ${pose.fps.toFixed(1)}   Engine: ${pose.mode}`,
      pose.fallbackReason?`Worker fallback: ${pose.fallbackReason}`:'',
      `Pose confidence: ${v(features?.confidence)}   Hip X: ${v(features?.hipX)}   Hip Y: ${v(features?.hipY)}`,
      `baseline X: ${v(baseline?.baselineHipX)}   baseline Y: ${v(baseline?.baselineHipY)}   average frames: ${baseline?.frames??0}`,
      `motionState: ${motion.state}   runState: ${motion.runState}   runIntensity: ${v(motion.runIntensity)}`,
      `Knees visible: ${features?.lowerBodyVisible??'—'}   partial-body tracking: ${phase==='PLAYING'}   Run steps: ${motion.stepCount??0}   knee difference: ${v(motion.features?(motion.features.leftLift-motion.features.rightLift):null)}   run threshold: ${v(motion.runThreshold)}`,
      `mirrorMode: ${settings.value.mirrorMode}   displayMirrored: ${mirror.displayMirrored}   mirrorDirection: ${mirror.mirrorDirection??'uncalibrated'}`,
      `Player right raw sign: ${mapper?.calibration.playerRightSign??'—'}   Player X: ${v(motion.features?.playerX)}`,
      `trackingState: ${trackingPaused?'LOST_TRACKING':'TRACKING'}   phase: ${phase}`,
      ...(sequence&&playMode==='guided'?[`promptState: ${sequence.state}   currentPrompt: ${sequence.snapshot().currentPrompt}   nextPrompt: ${sequence.snapshot().nextPrompt.join(',')}`,`promptStartTime: ${sequence.snapshot().promptStartTime}ms   activeWindow: ${sequence.snapshot().activeWindow.join('–')}ms`, `motionDetected: ${sequence.motionDetected??'—'}   successTimestamp: ${sequence.successTimestamp??'—'}ms`, `RUN progress: ${sequence.runHeld.toFixed(0)}/1000ms   missed sample gap: ${sequence.runGap.toFixed(0)}ms`]:[]),
      ...(forest&&playMode==='forest'?[forestDebugText(forest.snapshot()),`Scene FPS: ${forestView.fps.toFixed(1)}   Canvas cost: ${forestView.lastCost.toFixed(2)}ms`]:[]),
      Object.keys(names).map(a=>`${a}: ${progress.counts[a]}`).join('   '),settings.warning].filter(Boolean).join('\n');}
    drawSkeleton();
  }
  requestAnimationFrame(frame);
}
$('startBtn').addEventListener('click',()=>start('forest'));$('testStageBtn').addEventListener('click',()=>{if(camera.active)return;$('debugPanel').hidden=true;start('forest');});$('guidedBtn').addEventListener('click',()=>start('guided'));$('freeBtn').addEventListener('click',()=>start('free'));$('stopBtn').addEventListener('click',()=>{release();phase='HOME';message('休息一下，準備好再出發！');});$('recalibrateBtn').addEventListener('click',recalibrate);
$('continueBtn').addEventListener('click',()=>{completions=0;$('continueBtn').hidden=true;$('startBtn').hidden=false;$('guidedBtn').hidden=false;$('freeBtn').hidden=false;phase='HOME';message('準備好，再動一動！');});
$('debugToggle').addEventListener('click',()=>{const hidden=!$('debugPanel').hidden;$('debugPanel').hidden=hidden;$('debugToggle').setAttribute('aria-expanded',String(!hidden));});
$('closeDebugBtn').addEventListener('click',()=>{$('debugPanel').hidden=true;$('debugToggle').setAttribute('aria-expanded','false');});
$('fullscreenBtn').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
  catch{$('viewStatus').textContent='可按 F11 放大瀏覽器畫面。';}});
document.addEventListener('fullscreenchange',()=>{$('fullscreenBtn').textContent=document.fullscreenElement?'縮回視窗 ↙':'放大全螢幕 ↗';});
if(!document.fullscreenEnabled)$('fullscreenBtn').hidden=true;
$('selfTestBtn').addEventListener('click',()=>{const results=runSelfTest();$('selfTestResult').textContent='程式檢查（合成資料）：'+results.map(r=>`${names[r.action]} ${r.pass?'通過':'失敗'}`).join('　');});
$('modelTestBtn').addEventListener('click',async()=>{
  if(camera.active||phase==='LOADING'){$('selfTestResult').textContent='鏡頭已在使用動作模型，請先結束練習。';return;}
  const token=epoch;$('modelTestBtn').disabled=true;$('startBtn').disabled=true;$('guidedBtn').disabled=true;$('freeBtn').disabled=true;$('testStageBtn').disabled=true;$('selfTestResult').textContent='正在檢查 Pose 模型…';
  let timer;try{await Promise.race([pose.initialize(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),60000);})]);
    const probe=document.createElement('canvas');probe.width=64;probe.height=64;probe.getContext('2d').fillRect(0,0,64,64);
    await pose.probe(probe);
    if(token===epoch)$('selfTestResult').textContent=`Pose 模型載入與推論成功 ✓ · ${pose.mode}（空白測試影格）`;
  }catch{if(token===epoch)$('selfTestResult').textContent='Pose 模型載入或推論失敗，請檢查 CDN／模型網址是否可連線。';}
  finally{clearTimeout(timer);pose.close();$('modelTestBtn').disabled=false;$('startBtn').disabled=false;$('guidedBtn').disabled=false;$('freeBtn').disabled=false;$('testStageBtn').disabled=false;}
});
$('settingsBtn').addEventListener('click',()=>{for(const key of ['promptSize','mirrorMode','difficulty','duration','gameHomeUrl'])$(key).value=settings.value[key];
  for(const key of ['jumpEnabled','sound','music','rememberCalibration'])$(key).checked=settings.value[key];$('settingsWarning').textContent=settings.warning;$('settingsDialog').showModal();});
$('saveSettings').addEventListener('click',()=>{const patch={};for(const key of ['promptSize','mirrorMode','difficulty','duration','gameHomeUrl'])patch[key]=$(key).value;
  for(const key of ['jumpEnabled','sound','rememberCalibration'])patch[key]=$(key).checked;settings.update(patch);applySettings();});
$('clearCalibration').addEventListener('click',()=>{settings.update({calibration:null});if(camera.active)recalibrate();$('settingsWarning').textContent='左右校正已清除，下次開始會重新確認。';});
document.addEventListener('visibilitychange',()=>{lastRenderTime=null;if(document.hidden){forest?.pause();pose.stop();trackingPaused=true;tracking.reset();motion=detector.lost();}
  else if(camera.active&&['CALIBRATION','COUNTDOWN','PLAYING'].includes(phase)){lastPoseTime=performance.now();countdownAt=null;pose.start($('cameraVideo'));}});
globalThis.addEventListener('pagehide',()=>{release();audio.close();});
applySettings();requestAnimationFrame(frame);
