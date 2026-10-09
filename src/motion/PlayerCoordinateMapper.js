/** Raw camera pixels -> normalized Pose -> anatomical Player -> Game.
 * Display mirroring never participates in motion decisions.
 * playerRightSign is measured by the two-hand calibration, not guessed from x.
 */
export class PlayerCoordinateMapper {
  constructor(calibration) {
    if (!calibration || ![-1,1].includes(calibration.playerRightSign)) throw new Error('請先完成左右校正');
    this.calibration=calibration;
  }
  map(features, baseline) {
    const scale=baseline.baselineBodyHeight;
    return {...features,
      playerX:(features.hipX-baseline.baselineHipX)*this.calibration.playerRightSign/scale,
      playerShoulderX:(features.shoulderX-baseline.baselineShoulderX)*this.calibration.playerRightSign/scale,
      hipRise:(baseline.baselineHipY-features.hipY)/scale,
      shoulderRise:(baseline.baselineShoulderY-features.shoulderY)/scale,
      baselineLeg:(baseline.baselineLeftLeg+baseline.baselineRightLeg)/2,
      runNoise:baseline.baselineRunNoise??0,
      leftLift:Number.isFinite(features.leftLeg)?(baseline.baselineLeftLeg-features.leftLeg)/scale:0,
      rightLift:Number.isFinite(features.rightLeg)?(baseline.baselineRightLeg-features.rightLeg)/scale:0
    };
  }
  toDisplayX(rawX, mirrorDisplay) { return mirrorDisplay ? 1-rawX : rawX; }
  toGame(action) {
    return ({DODGE_LEFT:{x:-1,arrow:'←',text:'往你的左邊閃'},
      DODGE_RIGHT:{x:1,arrow:'→',text:'往你的右邊閃'}})[action]??{x:0,arrow:'',text:''};
  }
}
