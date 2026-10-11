const words={RUN:'跑起來！',JUMP:'跳！',CROUCH:'蹲！',DODGE_LEFT:'往左閃！',DODGE_RIGHT:'往右閃！'};
/** Local Chinese speech only; fixed prompts, no pose or camera data. */
export class SpeechManager {
 constructor(settings,env=globalThis){this.settings=settings;this.env=env;this.synth=env.speechSynthesis;this.key=null;this.utterance=null;}
 voice(){try{const v=(this.synth?.getVoices()??[]).filter(v=>v.localService===true&&/^zh([_-]|$)/i.test(v.lang));return v.find(v=>/^zh[-_]TW$/i.test(v.lang))??v.find(v=>/^zh[-_](HK|Hant)/i.test(v.lang))??v[0]??null;}catch{return null;}}
 status(){return !this.synth||!this.env.SpeechSynthesisUtterance?'此瀏覽器沒有語音功能':this.voice()?'中文語音已準備好':'尚未找到本機中文語音，仍可使用提示音';}
 cancel(){try{this.synth?.cancel();}catch{}this.utterance=null;}
 reset(){this.cancel();this.key=null;}
 say(text,test=false){if((!test&&!this.settings.value.voiceHints)||!this.env.SpeechSynthesisUtterance||!this.voice())return false;try{this.cancel();const u=new this.env.SpeechSynthesisUtterance(text);u.voice=this.voice();u.lang=u.voice.lang;u.volume=1;u.rate=1.25;u.pitch=1.05;this.utterance=u;u.onerror=()=>{if(this.utterance===u)this.utterance=null;};u.onend=()=>{if(this.utterance===u)this.utterance=null;};this.synth.speak(u);return true;}catch{return false;}}
 update(s,paused=false){if(paused||!this.settings.value.voiceHints){this.reset();return;}const key=String(s.event?.id??s.promptStartTime??'')+':'+s.promptState;if(key===this.key)return;this.key=key;this.cancel();if(s.promptState==='ACTIVE'&&words[s.currentPrompt])this.say(words[s.currentPrompt]);}
}
