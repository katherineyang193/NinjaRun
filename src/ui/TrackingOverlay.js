import {visible} from '../motion/pose-features.js';

// The same raw-video bounds drive both recognition and the displayed frame.
export const SAFE_BOUNDS=Object.freeze({left:.04,right:.96,top:.025,bottom:.975});
export const TRACKING_COLORS=Object.freeze({valid:'#fff000',invalid:'#42a5ff'});
const CORE=[0,11,12,23,24,25,26];
const BONES=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[28,30],[30,32]];
export function inSafeFrame(p){return !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=SAFE_BOUNDS.left&&p.x<=SAFE_BOUNDS.right&&p.y>=SAFE_BOUNDS.top&&p.y<=SAFE_BOUNDS.bottom;}
export function bodyInSafeFrame(points){return Array.isArray(points)&&CORE.every(i=>visible(points[i])&&inSafeFrame(points[i]));}
export function bodyTrackable(points,allowLowerBodyMissing=false){return bodyInSafeFrame(points)||(allowLowerBodyMissing&&Array.isArray(points)&&[0,11,12,23,24].every(i=>visible(points[i])&&inSafeFrame(points[i])));}
export function nodeRecognized(p,tracked){return tracked&&visible(p)&&inSafeFrame(p);}
export function fittedVideoRect(width,height,aspect=4/3){
  const w=Math.min(width,height*aspect),h=w/aspect;
  return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
}
export function overlayPoint(p,rect,mirrored=false){return {x:rect.x+(mirrored?1-p.x:p.x)*rect.width,y:rect.y+p.y*rect.height};}
export function drawTrackingOverlay(canvas,zone,{landmarks,tracked,fresh=tracked,mirrored,aspect=4/3,enabled=true,allowLowerBodyMissing=false}){
  const width=canvas.clientWidth,height=canvas.clientHeight;
  if(!width||!height)return;
  const ratio=Math.min(globalThis.devicePixelRatio||1,2),ctx=canvas.getContext('2d');
  if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
  const rect=fittedVideoRect(width,height,aspect),valid=tracked&&bodyTrackable(landmarks,allowLowerBodyMissing);
  zone.dataset.tracking=valid?'valid':'invalid';
  Object.assign(zone.style,{left:`${rect.x+rect.width*SAFE_BOUNDS.left}px`,top:`${rect.y+rect.height*SAFE_BOUNDS.top}px`,width:`${rect.width*(SAFE_BOUNDS.right-SAFE_BOUNDS.left)}px`,height:`${rect.height*(SAFE_BOUNDS.bottom-SAFE_BOUNDS.top)}px`});
  if(!enabled||!Array.isArray(landmarks))return;
  const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  const point=p=>overlayPoint({x:Math.max(0,Math.min(1,p.x)),y:Math.max(0,Math.min(1,p.y))},rect,mirrored);
  const color=p=>nodeRecognized(p,fresh)?TRACKING_COLORS.valid:TRACKING_COLORS.invalid;
  ctx.lineWidth=Math.max(3,Math.min(6,height/150));ctx.lineCap='round';
  for(const [a,b] of BONES){const pa=landmarks[a],pb=landmarks[b];if(!finite(pa)||!finite(pb))continue;
    ctx.strokeStyle=nodeRecognized(pa,fresh)&&nodeRecognized(pb,fresh)?TRACKING_COLORS.valid:TRACKING_COLORS.invalid;
    const p=point(pa),q=point(pb);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
  landmarks.forEach((p,i)=>{if(!finite(p))return;const xy=point(p),radius=Math.max(5,Math.min(10,height/85))*(i<11?.65:1);
    ctx.fillStyle=color(p);ctx.strokeStyle='#14243e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(xy.x,xy.y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();});
}
