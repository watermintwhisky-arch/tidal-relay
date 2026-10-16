import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,addPlayer,startGame,applyAction,legalActions,advanceAutomatic,chooseBotAction,standings,BEACONS} from '../lib/game.mjs';
function game(seats=2){const g=createGame(123);g.seats=seats;addPlayer(g,'Captain');startGame(g,0);return g;}
test('seeded board is reproducible and rotationally fair',()=>{
 const a=createGame(9),b=createGame(9);assert.deepEqual(a,b);
 for(let i=0;i<25;i++)assert.equal(a.cells[i],a.cells[4-Math.floor(i/5)+5*(i%5)]);
 for(const i of BEACONS)assert.equal(a.cells[i],0);
});
test('illegal teleport is rejected without changing state',()=>{
 const g=game(),before=structuredClone(g);assert.throws(()=>applyAction(g,{type:'sail',to:24},1));assert.deepEqual(g,before);
});
test('cargo cap and stock conservation during harvest',()=>{
 const g=game();g.players[0].position=1;g.players[0].cargo=5;g.cells[1]=3;applyAction(g,{type:'harvest'},1);
 assert.equal(g.players[0].cargo,6);assert.equal(g.cells[1],2);
});
test('home banking bonus is secured and cargo cleared',()=>{
 const g=game();g.players[0].cargo=3;applyAction(g,{type:'bank'},1);assert.equal(g.players[0].score,4);assert.equal(g.players[0].cargo,0);
});
test('tide waits for all seats and affects cargo only',()=>{
 const g=game();g.waves[0]={axis:'row',line:1};g.players[0].position=5;g.players[0].cargo=3;g.players[0].score=7;
 applyAction(g,{type:'wait'},1);assert.equal(g.players[0].cargo,3);applyAction(g,{type:'wait'},2);
 assert.equal(g.players[0].cargo,1);assert.equal(g.players[0].score,7);assert.equal(g.round,2);
});
test('dash costs exactly one; raid transfers exactly one',()=>{
 const g=game();g.waves[0]={axis:'row',line:4};g.players[0].cargo=2;applyAction(g,{type:'dash',to:2},1);assert.equal(g.players[0].cargo,1);
 g.players[1].position=3;applyAction(g,{type:'raid',target:0},2);assert.equal(g.players[1].cargo,1);assert.equal(g.players[0].cargo,0);
});
test('automatic play stops at a human with time remaining',()=>{
 const g=game();advanceAutomatic(g,1);assert.equal(g.turns,0);advanceAutomatic(g,12001);assert.equal(g.turns,2);assert.equal(g.active,0);
});
test('200 seeded games finish in 8 rounds with valid states and replay',()=>{
 for(let seed=1;seed<=200;seed++){
  const g=createGame(seed);g.seats=2+seed%3;for(let i=0;i<g.seats;i++)addPlayer(g,'Bot '+i,true);startGame(g,0);
  while(g.phase==='playing'){
   const action=chooseBotAction(g);assert.ok(legalActions(g).some(a=>JSON.stringify(a)===JSON.stringify(action)));applyAction(g,action,1,true);
   for(const p of g.players){assert.ok(p.cargo>=0&&p.cargo<=6);assert.ok(p.position>=0&&p.position<25);assert.ok(p.score>=0);}
   assert.ok(g.turns<=8*g.seats);
  }
  assert.equal(g.turns,8*g.seats);assert.equal(g.history.length,g.turns+1);assert.deepEqual(g.history.at(-1).frame.players,g.players);assert.equal(g.dueAt,null);
  assert.equal(standings(g)[0].total,Math.max(...g.players.map(p=>p.score+Math.floor(p.cargo/2))));
 }
});
