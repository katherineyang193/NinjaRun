const labels={RUN:'跑！',JUMP:'跳！',CROUCH:'蹲！',DODGE_LEFT:'你的左邊',DODGE_RIGHT:'你的右邊'};
const arrows={JUMP:'↑',CROUCH:'↓',DODGE_LEFT:'←',DODGE_RIGHT:'→'};
const runner='<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="72" cy="19" r="10" fill="currentColor"/><path d="M61 37 47 62 68 76 85 102 M49 62 28 89 10 89 M59 42 81 54 105 44 M59 42 35 35 16 52" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="feet" aria-hidden="true"><span>◖</span><span>◗</span></div>';
export function promptIcon(action){if(action==='RUN')return runner;if(!arrows[action])return '';const angle={JUMP:0,CROUCH:180,DODGE_LEFT:-90,DODGE_RIGHT:90}[action];return `<svg viewBox="0 0 120 120" aria-hidden="true"><g transform="rotate(${angle} 60 60)"><path d="M60 104V18M24 52L60 16L96 52" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;}
export class PromptView {
  constructor(root){this.root=root;this.key='';
    root.querySelector('.next-row').insertAdjacentHTML('beforebegin','<div class="run-progress" hidden><span>跑動集氣</span><progress value="0" max="1" aria-label="跑動成功進度"></progress></div>');
    this.runProgress=root.querySelector('.run-progress');
  }
  update(snapshot,paused=false){const {promptState,currentPrompt,nextPrompt,combo}=snapshot;
    this.runProgress.hidden=snapshot.showRunProgress===false||paused||currentPrompt!=='RUN'||promptState!=='ACTIVE';
    this.runProgress.querySelector('progress').value=snapshot.runProgress??0;
    const key=JSON.stringify([promptState,currentPrompt,nextPrompt,paused,combo,snapshot.waitingForCenter]);if(key===this.key)return;this.key=key;
    this.root.dataset.state=paused?'PAUSED':promptState;this.root.dataset.action=currentPrompt??'';
    this.root.querySelector('.prompt-phase').textContent=paused?'回到框框裡～':snapshot.waitingForCenter?'先回中央':({PREVIEW:'準備',ACTIVE:'現在做！',SUCCESS:'NICE!',MISS:'再試試',RECOVERY:'站穩，慢慢來',FINISHED:'完成！'})[promptState];
    this.root.querySelector('.prompt-symbol').innerHTML=promptState==='SUCCESS'?'<span class="success-check">✓</span><span class="sparkles" aria-hidden="true">✦　✧　✦</span>':promptIcon(currentPrompt);
    this.root.querySelector('.prompt-label').textContent=paused?'找到身體就繼續':promptState==='RECOVERY'?'站穩，等下一招':labels[currentPrompt]??'';
    this.root.querySelector('.prompt-next').innerHTML=nextPrompt.map(a=>`<span aria-label="${labels[a]}">${promptIcon(a)}</span>`).join('');
    this.root.querySelector('.prompt-combo').textContent=combo>1?`COMBO ×${combo}`:'';
  }
}
