/** CuteDart Web Audio oscillator feedback pattern, extracted and given an envelope/limiter. */
export class AudioManager {
  constructor(settings){this.settings=settings;this.context=null;}
  async unlock(){try{this.context??=new (globalThis.AudioContext||globalThis.webkitAudioContext)();await this.context.resume();}catch{}}
  play(kind='success'){
    if(!this.settings.value.sound||!this.context)return;
    const notes=({ENERGY_READY:[660,880,1046],BOSS_INTRO:[180,240,320],BOSS_TELEGRAPH:[260,300],GROUND_WAVE:[140,100],LEAF_SWEEP:[740,600,480],LEFT_IMPACT:[210,320],RIGHT_IMPACT:[320,210],BOSS_TIRED:[420,340],POWER:[440,554,659,880,1046],VICTORY:[523,659,784,1046],monster:[180,220,180],catch:[220,330,260,440],star:[880,1046],softHit:[330],count:[440],JUMP:[620,880],CROUCH:[440,660],DODGE_LEFT:[580,780],DODGE_RIGHT:[580,780],RUN:[500,700],success:[660,880],combo:[660,880,1046],finish:[523,659,784,1046]})[kind]??[660];
    notes.forEach((freq,index)=>{const ctx=this.context,t=ctx.currentTime+index*.085,o=ctx.createOscillator(),g=ctx.createGain();
      o.type='triangle';o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.18,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+.16);
      o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.18);o.onended=()=>{o.disconnect();g.disconnect();};});
  }
  close(){this.context?.close();this.context=null;}
}
