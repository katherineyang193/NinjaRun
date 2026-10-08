export const LANDMARK = Object.freeze({
  head: 0, leftShoulder: 11, rightShoulder: 12, leftElbow: 13,
  rightElbow: 14, leftWrist: 15, rightWrist: 16, leftHip: 23,
  rightHip: 24, leftKnee: 25, rightKnee: 26, leftAnkle: 27, rightAnkle: 28
});
const mean = (a, b) => (a + b) / 2;
export function visible(p, threshold = .5) {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.x > .01 && p.x < .99 && p.y > .01 && p.y < .99 &&
    Math.min(p.visibility ?? 0, p.presence ?? 1) >= threshold;
}
function angle(a, b, c, aspect) {
  if (![a,b,c].every(p => visible(p))) return null;
  const u = [(a.x-b.x)*aspect, a.y-b.y], v = [(c.x-b.x)*aspect, c.y-b.y];
  const size = Math.hypot(...u)*Math.hypot(...v);
  return size > .00001 ? Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/size)))*180/Math.PI : null;
}
export function poseFeatures(landmarks, aspect = 4/3) {
  if (!Array.isArray(landmarks) || landmarks.length < 29) return null;
  const p = Object.fromEntries(Object.entries(LANDMARK).map(([key,index])=>[key,landmarks[index]]));
  const required = ['head','leftShoulder','rightShoulder','leftHip','rightHip','leftKnee','rightKnee'];
  if (!required.every(key => visible(p[key]))) return null;
  const hipX=mean(p.leftHip.x,p.rightHip.x), hipY=mean(p.leftHip.y,p.rightHip.y);
  const shoulderX=mean(p.leftShoulder.x,p.rightShoulder.x), shoulderY=mean(p.leftShoulder.y,p.rightShoulder.y);
  const kneeY=mean(p.leftKnee.y,p.rightKnee.y);
  const anklesVisible=visible(p.leftAnkle)&&visible(p.rightAnkle);
  const ankleY=anklesVisible?mean(p.leftAnkle.y,p.rightAnkle.y):kneeY+(kneeY-hipY)*.95;
  return {p, hipX, hipY, shoulderX, shoulderY, kneeY, ankleY, anklesVisible,
    bodyHeight: Math.max(.15,ankleY-p.head.y),
    torsoHeight: hipY-shoulderY,
    leftLeg: p.leftKnee.y-p.leftHip.y, rightLeg:p.rightKnee.y-p.rightHip.y,
    kneeAngle: Math.min(angle(p.leftHip,p.leftKnee,p.leftAnkle,aspect)??180,
      angle(p.rightHip,p.rightKnee,p.rightAnkle,aspect)??180),
    confidence: Math.min(...required.map(key=>Math.min(p[key].visibility??0,p[key].presence??1)))
  };
}
export function standingCheck(f) {
  if (!f) return {ready:false,message:'回到框框裡～'};
  if (f.p.head.y < .055 || f.kneeY > .92 || f.bodyHeight > .9) return {ready:false,message:'再退後一點'};
  if (Math.abs(f.hipX-.5) > .15 || Math.abs(f.shoulderX-.5)>.16) return {ready:false,message:'請站到中央'};
  if (f.bodyHeight < .35) return {ready:false,message:'再靠近一點'};
  if (f.torsoHeight < .1 || f.kneeY-f.hipY < .055) return {ready:false,message:'請站直，讓我看看你'};
  return {ready:true,message:f.anklesVisible?'準備完成！':'我還看不到你的腳',warning:!f.anklesVisible};
}
