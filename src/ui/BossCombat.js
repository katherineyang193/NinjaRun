/** Presentation only: every cue derives from the existing paused game clock. */
export function bossCombat(s){
 const age=s.event?.successTime==null?-1:s.time-s.event.successTime;
 const tier=s.combo>=8?4:s.combo>=5?3:s.combo>=3?2:1;
 return {age,tier,launch:age>=160&&age<440,flight:Math.max(0,Math.min(1,(age-160)/280)),hit:age>=440&&age<740,recoil:age>=440&&age<740?Math.sin((age-440)/300*Math.PI):0};
}
export function drawCounter(c,s,w,h){
 const b=bossCombat(s);if(b.age<160||b.age>820)return;
 c.save();c.strokeStyle='#bfffff';c.fillStyle='#eaffff';c.lineWidth=4;
 if(b.launch){const pose=Math.sin(Math.PI*160/900),type=s.event.type,startX=.17+(type==='DODGE_LEFT'?-.07*pose:type==='DODGE_RIGHT'?.07*pose:0),startY=.69-(type==='JUMP'?.25*pose:type==='CROUCH'?-.05:0);const x=w*(startX+(.39-startX)*b.flight),y=h*(startY+(.47-startY)*b.flight);for(let i=0;i<b.tier;i++){const dy=(i-(b.tier-1)/2)*13;c.beginPath();c.moveTo(x-w*.1,y+dy+22);c.lineTo(x,y+dy);c.stroke();c.save();c.translate(x,y+dy);c.rotate(s.time/45+i);c.beginPath();for(let j=0;j<8;j++){const a=j*Math.PI/4,r=j%2?5:17+b.tier*2;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();if(b.tier>=3){c.beginPath();c.arc(0,0,26,0,Math.PI*1.6);c.stroke();}c.restore();}}
 if(b.hit){const p=(b.age-440)/300;c.globalAlpha=1-p;c.lineWidth=7;c.beginPath();c.arc(w*.39,h*.47,20+p*75,0,Math.PI*2);c.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.moveTo(w*.39+Math.cos(a)*25,h*.47+Math.sin(a)*25);c.lineTo(w*.39+Math.cos(a)*(45+p*55),h*.47+Math.sin(a)*(45+p*55));c.stroke();}}
 c.restore();
}
