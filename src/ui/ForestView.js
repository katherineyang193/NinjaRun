import {obstacleProgress} from '../game/ForestStage.js?v=sync8';
/** Lightweight original canvas scenery; throttled independently of Pose. */
export class ForestView {
 constructor(root){this.root=root;root.innerHTML='<canvas aria-label="原創森林：天空、樹木、道路與障礙"></canvas><div class="forest-character" aria-label="小忍者"><img alt="原創小忍者"></div><div class="forest-hud"><strong class="forest-score">0</strong><label>活力值 <progress max="100" value="20" aria-label="活力值"></progress></label><strong class="forest-combo"></strong></div><div class="forest-segment"></div>';
  this.canvas=root.querySelector('canvas');this.actor=root.querySelector('.forest-character');this.actor.querySelector('img').src=new URL('../../assets/ninja.svg',import.meta.url).href;this.lastDraw=-Infinity;this.lastCost=0;this.frames=0;this.started=null;this.fps=0;this.hudAt=-Infinity;
 }
 reset(){this.lastDraw=-Infinity;this.frames=0;this.started=null;this.fps=0;}
 update(s,now,poseFps=0){this.root.dataset.paused=String(s.paused);this.actor.dataset.state=s.characterState;if(now-this.hudAt>=100)this.actor.style.animationDuration=`${.7/Math.max(.6,s.speed)}s`;
  if(now-this.hudAt>=100){this.hudAt=now;this.root.querySelector('.forest-score').textContent=`★ ${s.score} · ✦ ${s.stars}`;this.root.querySelector('progress').value=s.energy;this.root.querySelector('.forest-combo').textContent=s.combo>1?`COMBO ×${s.combo}`:'';this.root.querySelector('.forest-segment').textContent=s.finalRun?'FINAL RUN · 衝向終點！':`${s.segment.id} · ${s.segment.label}`;}
  if(now-this.lastDraw<(poseFps>0&&poseFps<12?50:33))return;this.lastDraw=now;const start=performance.now();
  const w=this.root.clientWidth,h=this.root.clientHeight;if(!w||!h)return;const ratio=Math.min(globalThis.devicePixelRatio||1,1.5);if(this.canvas.width!==Math.round(w*ratio)||this.canvas.height!==Math.round(h*ratio)){this.canvas.width=Math.round(w*ratio);this.canvas.height=Math.round(h*ratio);}
  const c=this.canvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);
  const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#83ddf2');sky.addColorStop(.65,'#e7f7cd');c.fillStyle=sky;c.fillRect(0,0,w,h);
  c.fillStyle='#fff4ba';c.beginPath();c.arc(w*.12,h*.18,38,0,Math.PI*2);c.fill();
  for(let layer=0;layer<2;layer++){const spacing=layer?230:310;for(let i=-1;i<w/spacing+2;i++){const x=i*spacing-(s.distance*(layer?30:12))%spacing,y=h*(layer?.77:.69);this.tree(c,x,y,layer?1:.75,layer?'#4b9d77':'#a4c7a2');}}
  c.fillStyle='#81c96b';c.fillRect(0,h*.76,w,h*.24);c.fillStyle='#e1c89b';c.fillRect(0,h*.84,w,h*.16);
  c.strokeStyle='#f9ebc9';c.lineWidth=3;for(let i=0;i<12;i++){const x=(i*w/10-s.distance*55)%(w+150);c.beginPath();c.moveTo(x,h*.93);c.lineTo(x+60,h*.93);c.stroke();}
  c.font='bold 26px sans-serif';for(let i=0;i<5;i++){const x=((i*w/4-s.distance*65)%(w+160)+w+160)%(w+160)-50;c.fillStyle='#ffdc52';c.strokeStyle='#8c622c';c.lineWidth=2;c.strokeText('★',x,h*.8);c.fillText('★',x,h*.8);}
  const e=s.event;if(e?.obstacle&&s.time<(e.visualImpactTime??e.impactTime)+500){const p=obstacleProgress(e,s.time);const lane=e.obstacle==='RIGHT_BLOCK'?.055:e.obstacle==='LEFT_BLOCK'?-.055:0;const actorX=this.actor.offsetLeft+this.actor.offsetWidth/2;const x=w*.93-(w*.93-actorX)*p+w*lane*p;this.obstacle(c,e,x,h*.84,s.time);}
  const feedback=s.lastFeedback,age=feedback?s.time-feedback.time:Infinity;if(feedback?.result==='SUCCESS'&&age<650){c.fillStyle='#ffe163';for(let i=0;i<6;i++){const a=i*Math.PI/3,r=30+age*.12;c.fillText('✦',w*.23+Math.cos(a)*r,h*.74+Math.sin(a)*r);}}
  this.frames++;this.started??=now;if(now>this.started)this.fps=(this.frames-1)*1000/(now-this.started);this.lastCost=performance.now()-start;
 }
 tree(c,x,y,scale,color){c.fillStyle='#967650';c.fillRect(x-9*scale,y-145*scale,18*scale,150*scale);c.fillStyle=color;for(const [dx,dy,r] of [[0,-190,70],[-45,-145,58],[45,-150,60]]){c.beginPath();c.arc(x+dx*scale,y+dy*scale,r*scale,0,Math.PI*2);c.fill();}}
 obstacle(c,e,x,y,time){const success=e.result==='SUCCESS';c.save();c.translate(x,y);const scale=Math.max(1.5,Math.min(2.5,this.root.clientHeight/340));c.scale(scale,scale);x=0;y=0;c.globalAlpha=success?.65:1;c.strokeStyle='#714e33';c.lineWidth=4;
  if(e.obstacle==='CRATE'){c.fillStyle='#dba25d';c.fillRect(x-30,y-60,60,60);c.strokeRect(x-30,y-60,60,60);c.beginPath();c.moveTo(x-25,y-55);c.lineTo(x+25,y-5);c.moveTo(x+25,y-55);c.lineTo(x-25,y-5);c.stroke();}
  else if(e.obstacle==='BRANCH'){c.strokeStyle='#926c40';c.lineWidth=18;c.beginPath();c.moveTo(x-65,y-108);c.lineTo(x+65,y-100);c.stroke();c.fillStyle='#80ba67';for(const dx of [-40,0,35]){c.beginPath();c.ellipse(x+dx,y-118,20,10,-.5,0,Math.PI*2);c.fill();}}
  else {c.fillStyle='#879fc9';c.beginPath();c.roundRect(x-35,y-65,70,65,20);c.fill();c.stroke();c.fillStyle='#eaf2ff';c.beginPath();c.arc(x-10,y-46,8,0,Math.PI*2);c.fill();c.fillStyle='#50785c';c.beginPath();c.ellipse(x,y-68,42,15,0,0,Math.PI*2);c.fill();}
  if(success){c.fillStyle='#fff000';c.strokeStyle='#213955';c.lineWidth=3;c.font='bold 36px sans-serif';c.strokeText('✓',x-18,y-140);c.fillText('✓',x-18,y-140);}c.restore();
 }
}
