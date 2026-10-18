import {bossCombat,drawCounter} from './BossCombat.js?v=boss23';
/** Drawn into ForestView's existing canvas. No RAF, timers or pose work. */
export function drawBossArena(c,s,w,h){
 const combat=bossCombat(s);c.save();if(combat.hit)c.translate(Math.sin(s.time/18)*3*combat.recoil,Math.cos(s.time/22)*2*combat.recoil);const t=s.time/1000,scale=Math.min(w*.003,h*.005),x=w*.39,y=h*.47;
 const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#1f496d');sky.addColorStop(1,'#b8e7ca');c.fillStyle=sky;c.fillRect(0,0,w,h);
 c.fillStyle='#537f74';for(let i=0;i<5;i++){c.fillRect(i*w*.16,h*.12,w*.035,h*.6);c.beginPath();c.ellipse(i*w*.16,h*.18,w*.12,h*.22,0,0,Math.PI*2);c.fill();}
 c.fillStyle='#a5c6a0';c.fillRect(0,h*.7,w,h*.3);c.fillStyle='#e9d6ad';c.beginPath();c.ellipse(w*.32,h*.83,w*.35,h*.15,0,0,Math.PI*2);c.fill();
 // Ancient rune platform and light shafts, bounded geometry.
 c.save();c.globalAlpha=.16;c.fillStyle='#b4ffff';for(let i=0;i<4;i++){c.beginPath();c.moveTo(w*(.08+i*.15),0);c.lineTo(w*(.18+i*.15),0);c.lineTo(w*(.08+i*.15),h*.75);c.lineTo(w*(i*.15),h*.75);c.fill();}c.restore();
 for(let i=0;i<4;i++){const px=w*(.035+i*.18);c.fillStyle='#476b76';c.fillRect(px,h*.36,w*.025,h*.37);c.strokeStyle='#8bffe4';c.lineWidth=3;c.beginPath();c.moveTo(px,h*.5);c.lineTo(px+w*.025,h*.46);c.lineTo(px+w*.012,h*.6);c.stroke();}
 c.strokeStyle='#9affef';c.lineWidth=3;for(let i=0;i<2;i++){c.beginPath();c.ellipse(w*.32,h*.83,w*(.29-i*.04),h*(.105-i*.02),0,0,Math.PI*2);c.stroke();}
 const e=s.event,p=e?Math.max(0,Math.min(1,(s.time-e.activeStart)/Math.max(1,(e.successTime==null?e.impactTime:e.successTime+220)-e.activeStart))):0;
 if(e&&s.time>=e.activeStart&&s.time<(e.visualImpactTime??e.impactTime)+500){c.save();c.lineWidth=9;c.strokeStyle='#ffcf64';c.fillStyle='#8db555';
  if(e.attack==='GROUND_WAVE'){c.beginPath();c.ellipse(w*.22,h*(.58+.26*p),w*(.08+.18*p),h*.035,0,0,Math.PI*2);c.stroke();c.strokeStyle='#fff6bd';c.lineWidth=4;for(let i=0;i<6;i++){const px=w*(.06+i*.055);c.beginPath();c.moveTo(px,h*.84);c.lineTo(px+10,h*.8);c.lineTo(px+25,h*.84);c.stroke();}for(let i=0;i<7;i++){c.globalAlpha=.6;c.fillStyle='#e8cc9b';c.beginPath();c.arc(w*(.04+i*.06),h*(.8-.08*Math.sin(p*Math.PI)),5+i%3*3,0,Math.PI*2);c.fill();}c.globalAlpha=1;}
  else if(e.attack==='LEAF_SWEEP'){for(let i=0;i<10;i++){c.beginPath();c.ellipse(w*(.08+i*.045),h*(.3+.35*p)+Math.sin(i+t)*15,19,8,-.4,0,Math.PI*2);c.fill();c.strokeStyle='#d3ffdf';c.lineWidth=3;c.beginPath();c.moveTo(w*(.08+i*.045)-45,h*(.3+.35*p)+Math.sin(i+t)*15-12);c.lineTo(w*(.08+i*.045),h*(.3+.35*p)+Math.sin(i+t)*15);c.stroke();}}
  else {const fromLeft=e.attackFrom==='PLAYER_LEFT',start=fromLeft?-.1:.64,end=.22,px=w*(start+(end-start)*p);c.fillStyle='#b7a3e3';c.beginPath();c.ellipse(px,h*.76,w*.065,h*.1,0,0,Math.PI*2);c.fill();c.stroke();c.strokeStyle='#b8ffff';c.lineWidth=5;for(let j=0;j<4;j++){c.beginPath();c.moveTo(px+(fromLeft?-90:90),h*.68+j*20);c.lineTo(px,h*.68+j*20);c.stroke();}}c.restore();}
 c.save();let fly=s.bossState==='DEFEATED'?Math.max(0,Math.min(1,(s.powerAge-1000)/2400)):0;c.translate(x+fly*w*.2+combat.recoil*22,y-fly*h*.3+Math.sin(t*3)*(s.bossStamina>=60?5:2));c.scale(scale*(1-fly*.65),scale*(1-fly*.65));c.rotate(fly*5);
 const lean=s.bossState==='TELEGRAPH_LEFT'?-.18:s.bossState==='TELEGRAPH_RIGHT'?.18:0;c.rotate(lean+combat.recoil*.13);
 c.strokeStyle='#34495d';c.lineWidth=4;c.fillStyle='#b7a3e3';
 for(const side of [-1,1]){const raised=s.bossState==='TELEGRAPH_CROUCH';c.beginPath();c.ellipse(side*53,raised?-48:18,16,32,side*(raised?.8:-.6),0,Math.PI*2);c.fill();c.stroke();}
 c.beginPath();c.ellipse(0,0,61,63,0,0,Math.PI*2);c.fill();c.stroke();
 // Wood armour, vine pauldrons and a luminous crest.
 c.fillStyle=combat.hit?'#d9ffff':'#775e4b';for(const side of [-1,1]){c.beginPath();c.roundRect(side*48-16,-35,32,37,9);c.fill();c.stroke();c.strokeStyle='#8ccca3';c.lineWidth=4;c.beginPath();c.moveTo(side*60,-30);c.quadraticCurveTo(side*20,-55,side*58,10);c.stroke();c.strokeStyle='#34495d';}
 c.fillStyle='#efe1a8';c.beginPath();c.ellipse(0,22,39,30,0,0,Math.PI*2);c.fill();
 c.fillStyle='#688d63';c.beginPath();c.moveTo(-30,-55);c.lineTo(-16,-83);c.lineTo(0,-64);c.lineTo(21,-85);c.lineTo(34,-53);c.closePath();c.fill();c.stroke();
 for(const side of [-1,1]){c.fillStyle='#fff';c.beginPath();c.ellipse(side*22,-17,13,17,0,0,Math.PI*2);c.fill();c.fillStyle='#34495d';if(s.bossState==='TIRED'||s.bossStamina>=75){c.fillRect(side*22-9,-18,18,4);}else {c.beginPath();c.arc(side*22,-14,5,0,Math.PI*2);c.fill();}c.fillStyle='#8770b1';c.beginPath();c.ellipse(side*30,58-(s.bossState==='TELEGRAPH_JUMP'&&side===-1?26:0),23,12,0,0,Math.PI*2);c.fill();c.stroke();}
 c.fillStyle='#99ffed';c.beginPath();c.moveTo(0,-57);c.lineTo(10,-43);c.lineTo(0,-30);c.lineTo(-10,-43);c.closePath();c.fill();
 c.strokeStyle='#34495d';c.beginPath();if(combat.hit)c.ellipse(0,18,10,12,0,0,Math.PI*2);else if(s.bossState==='SURPRISED')c.ellipse(0,18,10,15,0,0,Math.PI*2);else c.arc(0,10,15,0,Math.PI);c.stroke();
 if(s.bossStamina>=60){c.fillStyle='#88deff';c.beginPath();c.ellipse(49,-32,6,12,.2,0,Math.PI*2);c.fill();}c.restore();
 drawCounter(c,s,w,h);
 if(s.powerActive||s.finished){c.save();c.strokeStyle=s.weakVictory?'#e6f8ff':'#9cffff';c.lineWidth=12;
 const charge=Math.min(1,s.powerAge/1000);c.fillStyle='#bfffff';c.globalAlpha=.12*charge;c.beginPath();c.moveTo(w*.17,h*.8);c.lineTo(0,0);c.lineTo(w*.55,0);c.closePath();c.fill();c.globalAlpha=1;
 for(let j=0;j<3;j++){c.beginPath();c.ellipse(w*(.17+Math.min(1,s.powerAge/1800)*.2),h*.6,40+charge*w*.15,18+j*18,s.time/220+j,0,Math.PI*1.5);c.stroke();}
 const radius=30+Math.min(1,s.powerAge/1600)*w*.25;c.beginPath();c.ellipse(w*.24,h*.65,radius,radius*.35,-.3,0,Math.PI*2);c.stroke();c.font='bold 28px sans-serif';c.fillStyle='#ffe46b';for(let i=0;i<12;i++)c.fillText('✦',w*(.05+i*.047),h*(.25+.35*((i*.13+t*.15)%1)));c.restore();}
 c.restore();
}
