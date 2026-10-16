export const SIZE = 5;
export const BEACONS = [0, 4, 12, 20, 24];
export const HOMES = [0, 24, 4, 20];
export const TURN_MS = 12000;
export const ROUNDS = 8;
const distance = (a, b) => Math.abs(a % 5 - b % 5) + Math.abs(Math.floor(a / 5) - Math.floor(b / 5));
export function random(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = Math.imul(a ^ a >>> 15, 1 | a); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function createGame(seed = 1) {
  const rng = random(seed), cells = Array(25).fill(0);
  for (let i = 0; i < 25; i++) if (!BEACONS.includes(i)) { const orbit = [i, 4 - Math.floor(i / 5) + 5 * (i % 5), 24 - i, Math.floor(i / 5) + 5 * (4 - i % 5)]; if (!cells[i]) { const amount = 1 + Math.floor(rng() * 3); orbit.forEach(n => cells[n] = amount); } }
  const waves = Array.from({ length: ROUNDS }, () => ({ axis: rng() < .5 ? 'row' : 'column', line: 1 + Math.floor(rng() * 3) }));
  return { seed, cells, waves, players: [], phase: 'lobby', seats: 2, round: 1, active: 0, turns: 0, dueAt: null, log: [], history: [] };
}
export function addPlayer(game, name, bot = false) {
  if (game.phase !== 'lobby' || game.players.length >= game.seats) throw new Error('This lobby is full or already sailing.');
  const id = game.players.length;
  game.players.push({ id, name: String(name || 'Sailor').trim().slice(0, 18) || 'Sailor', bot, position: HOMES[id], cargo: 0, score: 0 });
  return id;
}
function frame(g) { return { cells: [...g.cells], players: g.players.map(p => ({ ...p })), round: g.round, active: g.active, phase: g.phase, turns: g.turns }; }
export function startGame(g, now = Date.now()) {
  if (g.phase !== 'lobby') throw new Error('This match has already started.');
  while (g.players.length < g.seats) addPlayer(g, 'Buoy Bot ' + (g.players.length + 1), true);
  g.phase = 'playing'; g.dueAt = now + TURN_MS;
  g.history.push({ text: 'Cast off. Eight rounds; watch the tide.', frame: frame(g) });
  return g;
}
export function legalActions(g) {
  if (g.phase !== 'playing') return [];
  const p = g.players[g.active], actions = [];
  for (let to = 0; to < 25; to++) {
    if (distance(p.position, to) === 1) actions.push({ type: 'sail', to });
    if (distance(p.position, to) === 2 && p.cargo > 0) actions.push({ type: 'dash', to });
  }
  if (g.cells[p.position] > 0 && p.cargo < 6) actions.push({ type: 'harvest' });
  if (BEACONS.includes(p.position) && p.cargo > 0) actions.push({ type: 'bank' });
  for (const target of g.players) if (target.id !== p.id && distance(target.position, p.position) <= 1 && target.cargo > 0 && p.cargo < 6) actions.push({ type: 'raid', target: target.id });
  actions.push({ type: 'wait' });
  return actions;
}
function same(a, b) { return a.type === b.type && (a.to ?? null) === (b.to ?? null) && (a.target ?? null) === (b.target ?? null); }
export function applyAction(g, action, now = Date.now(), automatic = false) {
  if (!action || !legalActions(g).some(a => same(a, action))) throw new Error('That move is not legal. Refresh the match and try again.');
  const p = g.players[g.active]; let detail;
  if (action.type === 'sail' || action.type === 'dash') { p.position = action.to; if (action.type === 'dash') p.cargo--; detail = (action.type === 'dash' ? 'dashed' : 'sailed') + ' to ' + (p.position % 5 + 1) + ',' + (Math.floor(p.position / 5) + 1); }
  else if (action.type === 'harvest') { const n = Math.min(2, g.cells[p.position], 6 - p.cargo); p.cargo += n; g.cells[p.position] -= n; detail = 'salvaged ' + n + ' pearls'; }
  else if (action.type === 'bank') { const bonus = p.position === HOMES[p.id] && p.cargo >= 3 ? 1 : 0; detail = 'banked ' + p.cargo + (bonus ? ' + 1 home bonus' : ''); p.score += p.cargo + bonus; p.cargo = 0; }
  else if (action.type === 'raid') { g.players[action.target].cargo--; p.cargo++; detail = 'raided one pearl from ' + g.players[action.target].name; }
  else detail = 'held position';
  const event = { turn: g.turns + 1, player: p.id, action: { ...action }, automatic, text: p.name + ' ' + detail + (automatic ? ' (bot / timeout)' : '') };
  g.turns++; g.active++;
  if (g.active >= g.players.length) {
    const tide = g.waves[g.round - 1];
    const losses = [];
    for (const sailor of g.players) {
      if ((tide.axis === 'row' ? Math.floor(sailor.position / 5) : sailor.position % 5) === tide.line && sailor.cargo > 0) { const n = Math.min(2, sailor.cargo); sailor.cargo -= n; losses.push(sailor.name + ' lost ' + n); }
    }
    event.text += '. Tide: ' + (losses.join(', ') || 'everyone stayed safe');
    g.active = 0; g.round++;
    if (g.round > ROUNDS) { g.phase = 'finished'; g.dueAt = null; }
    else { const rng = random(g.seed + g.round * 997); const candidates = g.cells.map((_, i) => i).filter(i => !BEACONS.includes(i)); for (let n = 0; n < 4; n++) { const i = candidates[Math.floor(rng() * candidates.length)]; g.cells[i] = Math.min(4, g.cells[i] + 1); } }
  }
  if (g.phase === 'playing') g.dueAt = now + TURN_MS;
  g.log.push(event); g.history.push({ text: event.text, frame: frame(g) });
  return g;
}
export function standings(g) { return g.players.map(p => ({ ...p, total: p.score + Math.floor(p.cargo / 2) })).sort((a, b) => b.total - a.total || a.id - b.id); }
export function chooseBotAction(g, id = g.active) {
  const p = g.players[id], options = legalActions(g), tide = g.waves[g.round - 1];
  const targetBank = pos => Math.min(...BEACONS.map(i => distance(pos, i)));
  const targetLoot = pos => Math.min(99, ...g.cells.map((n, i) => n > 0 ? distance(pos, i) : 99));
  const values = options.map(a => {
    let v = -10;
    if (a.type === 'bank') v = p.cargo * 2 + (p.position === HOMES[p.id] ? 1 : 0);
    if (a.type === 'harvest') v = Math.min(2, g.cells[p.position], 6 - p.cargo) * 2.8 - (p.cargo >= 5 ? 3 : 0);
    if (a.type === 'raid') v = 2.5;
    if (a.type === 'sail' || a.type === 'dash') {
      const seekingBank = p.cargo >= 3 || (g.round >= 7 && p.cargo > 0);
      const before = seekingBank ? targetBank(p.position) : targetLoot(p.position), after = seekingBank ? targetBank(a.to) : targetLoot(a.to);
      v = (before - after) * 2 + (seekingBank && BEACONS.includes(a.to) ? 1 : 0) - (a.type === 'dash' ? 1.8 : 0);
      if ((tide.axis === 'row' ? Math.floor(a.to / 5) : a.to % 5) === tide.line && p.cargo) v -= 1.1;
    }
    return { action: a, value: v };
  });
  values.sort((a, b) => b.value - a.value);
  return values[0]?.action || { type: 'wait' };
}
export function advanceAutomatic(g, now = Date.now()) {
  for (let n = 0; n < 40 && g.phase === 'playing'; n++) {
    if (!g.players[g.active].bot && now < g.dueAt) break;
    applyAction(g, chooseBotAction(g), now, true);
  }
  return g;
}
