import test from 'node:test';
import assert from 'node:assert/strict';
import {BossStage} from '../src/game/BossStage.js';
import {bossCombat} from '../src/ui/BossCombat.js';
test('counter launches after dodge and hits once; pause freezes presentation and sound',()=>{
 const b=new BossStage();b.advance(3300);b.observe({state:'JUMP',events:['JUMP']});b.drainNotices();
 b.advance(160);assert.equal(bossCombat(b.snapshot()).launch,true);assert.equal(b.drainNotices().filter(n=>n.result==='COUNTER_THROW').length,1);
 const before=bossCombat(b.snapshot());b.pause();b.advance(500);assert.deepEqual(bossCombat(b.snapshot()),before);b.pause(false);b.advance(280);
 assert.equal(bossCombat(b.snapshot()).hit,true);assert.equal(b.drainNotices().filter(n=>n.result==='COUNTER_HIT').length,1);b.advance(20);assert.equal(b.drainNotices().filter(n=>n.result==='COUNTER_HIT').length,0);
 assert.equal(b.success,1);assert.equal(b.energy,40);assert.equal(b.bossStamina,15);
});
test('four visual combo tiers do not alter scoring or windows',()=>{for(const [combo,tier] of [[1,1],[2,1],[3,2],[4,2],[5,3],[7,3],[8,4]])assert.equal(bossCombat({time:200,combo,event:{successTime:0}}).tier,tier);assert.equal(bossCombat({time:200,combo:0,event:{successTime:null}}).launch,false);});
