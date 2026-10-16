import { env } from 'cloudflare:workers';
import { createGame, addPlayer, startGame, applyAction, legalActions, advanceAutomatic, standings } from './game.mjs';
type Stored = { game: any; tokens: string[]; host: string; created: number };
export class GameError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
export async function body(request: Request) { const text = await request.text(); if (text.length > 8192) throw new GameError('Request is too large.', 413); try { return JSON.parse(text); } catch { throw new GameError('Send a JSON object.'); } }
function database() { if (!env.DB) throw new GameError('Match storage is not ready yet.', 503); return env.DB; }
async function digest(value: string) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join(''); }
const token = () => crypto.randomUUID() + crypto.randomUUID();
function view(code: string, stored: Stored, revision: number) { const g = stored.game; return { code, revision, game: g, legalActions: legalActions(g), standings: standings(g), now: Date.now(), rules: { rounds: 8, secondsPerTurn: 12, cargoLimit: 6, tideLoss: 2 } }; }
export async function createRoom(input: any) {
  if (!input || typeof input !== 'object') throw new GameError('Send a JSON object.');
  const seats = Number(input.seats ?? 2); if (![2,3,4].includes(seats)) throw new GameError('Choose two, three or four seats.');
  const g = createGame(crypto.getRandomValues(new Uint32Array(1))[0]); g.seats = seats; addPlayer(g, input.name || 'Captain');
  const secret = token(), hash = await digest(secret), code = crypto.randomUUID().replaceAll('-', '').slice(0,8).toUpperCase();
  const stored: Stored = { game:g, tokens:[hash], host:hash, created:Date.now() };
  await database().prepare('INSERT INTO matches (code, revision, payload, updated_at) VALUES (?, 0, ?, ?)').bind(code,JSON.stringify(stored),Date.now()).run();
  return { ...view(code,stored,0), token:secret, playerId:0 };
}
export async function room(code: string, method = 'get', input: any = {}) {
  code = code.toUpperCase(); if (!/^[A-F0-9]{8}$/.test(code)) throw new GameError('Use the eight-character match code.',404);
  if (!input || typeof input !== 'object') throw new GameError('Send a JSON object.');
  const supplied = typeof input.token === 'string' ? await digest(input.token) : '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await database().prepare('SELECT payload, revision FROM matches WHERE code = ?').bind(code).first<{payload:string;revision:number}>();
    if (!row) throw new GameError('That match does not exist.',404);
    const stored: Stored = JSON.parse(row.payload), g = stored.game;
    if (Date.now()-stored.created > 7*86400000) throw new GameError('This match has expired.',410);
    const before = JSON.stringify(g); advanceAutomatic(g); let extra: any = {};
    if (method === 'join') { if (g.phase !== 'lobby' || g.players.length >= g.seats) throw new GameError('This lobby is full or already sailing.',409); const secret = token(); extra = { playerId:addPlayer(g,input.name || 'Sailor'), token:secret }; stored.tokens.push(await digest(secret)); }
    else if (method === 'start') { if (supplied !== stored.host) throw new GameError('Only the host can start.',403); if (g.phase !== 'lobby') throw new GameError('This match has already started.',409); startGame(g); advanceAutomatic(g); }
    else if (method === 'move') {
      const id = stored.tokens.indexOf(supplied); if (id < 0) throw new GameError('A player token is required.',403);
      if (input.revision !== row.revision || before !== JSON.stringify(g)) throw new GameError('The turn changed. Refresh before moving.',409);
      if (g.phase !== 'playing' || id !== g.active) throw new GameError('Wait for your turn.',409);
      if (!input.action || !legalActions(g).some((a:any)=>a.type===input.action.type && (a.to??null)===(input.action.to??null) && (a.target??null)===(input.action.target??null))) throw new GameError('That move is not legal.',400);
      applyAction(g,input.action); advanceAutomatic(g);
    } else if (method !== 'get') throw new GameError('Unknown match action.',404);
    if (method === 'get' && before === JSON.stringify(g)) return view(code,stored,row.revision);
    const result = await database().prepare('UPDATE matches SET payload = ?, revision = revision + 1, updated_at = ? WHERE code = ? AND revision = ?').bind(JSON.stringify(stored),Date.now(),code,row.revision).run();
    if (result.meta.changes === 1) return { ...view(code,stored,row.revision+1), ...extra };
    if (method === 'move') throw new GameError('Another action arrived first. Refresh before moving.',409);
  }
  throw new GameError('Match is busy. Try again.',409);
}
export async function respond(work:()=>Promise<unknown>) { try { return json(await work()); } catch(e) { return json({error:e instanceof GameError ? e.message : 'Could not load the match.'},e instanceof GameError ? e.status : 500); } }
