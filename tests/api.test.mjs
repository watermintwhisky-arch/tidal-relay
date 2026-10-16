import test from 'node:test';
import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8787';
async function api(path,data){const response=await fetch(base+path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,body:await response.json()};}
test('real D1 API: permissions, optimistic concurrency, full match and replay',async()=>{
 const host=(await api('/api/matches',{name:'Host',seats:2})).body;
 assert.ok(host.token);assert.equal(host.playerId,0);const path='/api/matches/'+host.code;
 const guest=(await api(path+'/join',{name:'Guest'})).body;assert.equal(guest.playerId,1);
 assert.equal((await api(path+'/start',{token:guest.token})).status,403);
 let started=await api(path+'/start',{token:host.token});assert.equal(started.status,200);let state=started.body;
 assert.equal((await api(path+'/join',{name:'Intruder'})).status,409);
 assert.equal((await api(path+'/move',{token:'wrong',revision:state.revision,action:{type:'wait'}})).status,403);
 assert.equal((await api(path+'/move',{token:guest.token,revision:state.revision,action:{type:'wait'}})).status,409);
 assert.equal((await api(path+'/move',{token:host.token,revision:state.revision,action:{type:'sail',to:24}})).status,400);
 const results=await Promise.all([1,2].map(()=>api(path+'/move',{token:host.token,revision:state.revision,action:{type:'wait'}})));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 state=(await api(path)).body;assert.equal(state.game.turns,1);
 assert.equal(JSON.stringify(state).includes(host.token),false);assert.equal('tokens' in state,false);assert.equal('host' in state,false);
 while(state.game.phase==='playing'){
  const result=await api(path+'/move',{token:state.game.active===0?host.token:guest.token,revision:state.revision,action:{type:'wait'}});
  assert.equal(result.status,200);state=result.body;
 }
 assert.equal(state.game.turns,16);assert.equal(state.game.history.length,17);assert.equal(state.game.phase,'finished');
 assert.equal((await api(path+'/move',{token:host.token,revision:state.revision,action:{type:'wait'}})).status,409);
 assert.equal((await api('/api/matches/INVALID')).status,404);
 const bot=await fetch(base+'/sample-bot.py');assert.equal(bot.status,200);assert.ok((await bot.text()).includes('Python Skipper'));
});
